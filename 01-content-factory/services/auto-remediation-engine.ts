import { db } from "../../server/db";
import {
  remediationRules,
  remediationExecutions,
  failureSimulations,
  healingMetrics,
  providerMetrics,
  healingActionsLog,
  activityLogs,
  type RemediationRule,
  type RemediationExecution,
  type FailureSimulation,
} from "../../shared/schema";
import { eq, and, desc, sql, gt, gte, lte } from "drizzle-orm";
import { healthMonitor, PROVIDER_CONFIG, type ProviderName } from "./provider-health-monitor";

interface TriggerConditions {
  threshold?: number;
  windowMinutes?: number;
  consecutiveCount?: number;
  minSampleSize?: number;
}

interface ActionParams {
  cooldownMinutes?: number;
  fallbackProvider?: string;
  notifyChannel?: string;
  diagnosticType?: string;
}

interface TriggerEvaluation {
  shouldTrigger: boolean;
  details: Record<string, unknown>;
  currentValue?: number;
  threshold?: number;
}

interface RemediationResult {
  success: boolean;
  message: string;
  recoveryConfirmed: boolean;
  affectedRequests?: number;
  recoveredRequests?: number;
}

export interface ActiveSimulation {
  simulationId: string;
  targetProvider?: string | null;
  failureType: string;
  failureParams: Record<string, unknown>;
  startedAt: Date;
  endsAt: Date;
}

class AutoRemediationEngine {
  private static instance: AutoRemediationEngine;
  private isRunning = false;
  private monitorInterval: NodeJS.Timeout | null = null;
  private activeSimulations: Map<string, ActiveSimulation> = new Map();
  private lastExecutionTime: Map<string, Date> = new Map();
  private executionCountPerHour: Map<string, number> = new Map();

  private constructor() {}

  static getInstance(): AutoRemediationEngine {
    if (!AutoRemediationEngine.instance) {
      AutoRemediationEngine.instance = new AutoRemediationEngine();
    }
    return AutoRemediationEngine.instance;
  }

  async initialize(): Promise<void> {
    await this.initializeDefaultRules();
    console.log("[AutoRemediation] Engine initialized");
  }

  private async initializeDefaultRules(): Promise<void> {
    const defaultRules: Array<{
      ruleId: string;
      name: string;
      description: string;
      triggerType: string;
      triggerConditions: TriggerConditions;
      actionType: string;
      actionParams?: ActionParams;
      mode: string;
      priority: number;
    }> = [
      {
        ruleId: "rule_error_rate_high",
        name: "High Error Rate Auto-Rotate",
        description: "Automatically rotate to fallback when error rate exceeds 50%",
        triggerType: "error_rate_threshold",
        triggerConditions: { threshold: 0.5, windowMinutes: 15, minSampleSize: 5 },
        actionType: "rotate_to_fallback",
        mode: "auto",
        priority: 90,
      },
      {
        ruleId: "rule_consecutive_failures",
        name: "Consecutive Failures Quarantine",
        description: "Quarantine provider after 5 consecutive failures",
        triggerType: "consecutive_failures",
        triggerConditions: { consecutiveCount: 5 },
        actionType: "quarantine_provider",
        actionParams: { cooldownMinutes: 30 },
        mode: "auto",
        priority: 85,
      },
      {
        ruleId: "rule_rate_limit_detected",
        name: "Rate Limit Auto-Cooldown",
        description: "Automatically apply cooldown when rate limit is detected",
        triggerType: "rate_limit_detected",
        triggerConditions: {},
        actionType: "scale_cooldown",
        actionParams: { cooldownMinutes: 5 },
        mode: "auto",
        priority: 95,
      },
      {
        ruleId: "rule_health_score_critical",
        name: "Critical Health Score Response",
        description: "Trigger diagnostics and notify when health score drops below 30",
        triggerType: "health_score_drop",
        triggerConditions: { threshold: 30 },
        actionType: "run_diagnostic",
        mode: "semi_auto",
        priority: 80,
      },
      {
        ruleId: "rule_latency_spike",
        name: "Latency Spike Rotation",
        description: "Rotate to faster provider when latency exceeds 30 seconds",
        triggerType: "latency_spike",
        triggerConditions: { threshold: 30000, windowMinutes: 10 },
        actionType: "rotate_to_fallback",
        mode: "semi_auto",
        priority: 70,
      },
    ];

    for (const rule of defaultRules) {
      const existing = await db.select()
        .from(remediationRules)
        .where(eq(remediationRules.ruleId, rule.ruleId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(remediationRules).values({
          ...rule,
          triggerConditions: JSON.stringify(rule.triggerConditions),
          actionParams: rule.actionParams ? JSON.stringify(rule.actionParams) : null,
        });
        console.log(`[AutoRemediation] Initialized rule: ${rule.name}`);
      }
    }
  }

  startMonitoring(intervalMs = 30000): void {
    if (this.isRunning) {
      console.log("[AutoRemediation] Monitoring already running");
      return;
    }

    this.isRunning = true;
    console.log(`[AutoRemediation] Starting monitoring (interval: ${intervalMs}ms)`);

    this.monitorInterval = setInterval(async () => {
      try {
        await this.runMonitoringCycle();
      } catch (error) {
        console.error("[AutoRemediation] Monitoring cycle error:", error);
      }
    }, intervalMs);

    this.runMonitoringCycle();
  }

  stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.isRunning = false;
    console.log("[AutoRemediation] Monitoring stopped");
  }

  private async runMonitoringCycle(): Promise<void> {
    const rules = await db.select()
      .from(remediationRules)
      .where(eq(remediationRules.isActive, true))
      .orderBy(desc(remediationRules.priority));

    const providers = await db.select().from(providerMetrics);

    for (const rule of rules) {
      for (const provider of providers) {
        if (rule.providerPattern && !this.matchesPattern(provider.providerName, rule.providerPattern)) {
          continue;
        }
        if (rule.serviceType && rule.serviceType !== provider.serviceType) {
          continue;
        }

        try {
          const evaluation = await this.evaluateTrigger(rule, provider);
          
          if (evaluation.shouldTrigger) {
            const canExecute = await this.checkExecutionLimits(rule);
            
            if (canExecute) {
              if (rule.mode === "auto") {
                await this.executeRemediation(rule, provider.providerName, provider.serviceType, evaluation);
              } else {
                await this.createPendingRemediation(rule, provider.providerName, provider.serviceType, evaluation);
              }
            }
          }
        } catch (error) {
          console.error(`[AutoRemediation] Error evaluating rule ${rule.ruleId} for ${provider.providerName}:`, error);
        }
      }
    }

    await this.checkActiveSimulations();
    this.resetHourlyCountersIfNeeded();
  }

  private matchesPattern(providerName: string, pattern: string): boolean {
    if (pattern === "*") return true;
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      return regex.test(providerName);
    }
    return providerName === pattern;
  }

  private async evaluateTrigger(
    rule: RemediationRule,
    provider: { providerName: string; serviceType: string; [key: string]: unknown }
  ): Promise<TriggerEvaluation> {
    const conditions: TriggerConditions = JSON.parse(rule.triggerConditions || "{}");

    switch (rule.triggerType) {
      case "error_rate_threshold":
        return this.evaluateErrorRate(provider, conditions);
      
      case "consecutive_failures":
        return this.evaluateConsecutiveFailures(provider, conditions);
      
      case "rate_limit_detected":
        return this.evaluateRateLimit(provider);
      
      case "health_score_drop":
        return this.evaluateHealthScore(provider, conditions);
      
      case "latency_spike":
        return this.evaluateLatency(provider, conditions);
      
      default:
        return { shouldTrigger: false, details: { reason: "Unknown trigger type" } };
    }
  }

  private async evaluateErrorRate(
    provider: { providerName: string; [key: string]: unknown },
    conditions: TriggerConditions
  ): Promise<TriggerEvaluation> {
    const { threshold = 0.5, windowMinutes = 15, minSampleSize = 5 } = conditions;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const recentRequests = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'failed') as failures,
        COUNT(*) as total
      FROM provider_requests
      WHERE provider_name = ${provider.providerName}
        AND created_at >= ${windowStart}
    `);

    const failures = Number((recentRequests.rows[0] as { failures: number })?.failures || 0);
    const total = Number((recentRequests.rows[0] as { total: number })?.total || 0);

    if (total < minSampleSize) {
      return { shouldTrigger: false, details: { reason: "Insufficient samples", total } };
    }

    const errorRate = failures / total;
    return {
      shouldTrigger: errorRate > threshold,
      currentValue: errorRate,
      threshold,
      details: { failures, total, errorRate, windowMinutes },
    };
  }

  private async evaluateConsecutiveFailures(
    provider: { providerName: string; [key: string]: unknown },
    conditions: TriggerConditions
  ): Promise<TriggerEvaluation> {
    const { consecutiveCount = 5 } = conditions;

    const recentRequests = await db.execute(sql`
      SELECT status
      FROM provider_requests
      WHERE provider_name = ${provider.providerName}
      ORDER BY created_at DESC
      LIMIT ${consecutiveCount}
    `);

    const statuses = (recentRequests.rows as Array<{ status: string }>).map(r => r.status);
    const allFailed = statuses.length >= consecutiveCount && statuses.every(s => s === "failed");

    return {
      shouldTrigger: allFailed,
      currentValue: statuses.filter(s => s === "failed").length,
      threshold: consecutiveCount,
      details: { recentStatuses: statuses },
    };
  }

  private async evaluateRateLimit(
    provider: { providerName: string; rateLimitResetAt?: unknown; [key: string]: unknown }
  ): Promise<TriggerEvaluation> {
    const rateLimitActive = provider.rateLimitResetAt && new Date(provider.rateLimitResetAt as string) > new Date();
    return {
      shouldTrigger: Boolean(rateLimitActive),
      details: { rateLimitResetAt: provider.rateLimitResetAt },
    };
  }

  private async evaluateHealthScore(
    provider: { providerName: string; healthScore?: unknown; [key: string]: unknown },
    conditions: TriggerConditions
  ): Promise<TriggerEvaluation> {
    const { threshold = 30 } = conditions;
    const healthScore = parseFloat(String(provider.healthScore) || "100");

    return {
      shouldTrigger: healthScore < threshold,
      currentValue: healthScore,
      threshold,
      details: { healthScore },
    };
  }

  private async evaluateLatency(
    provider: { providerName: string; avgLatencyMs?: unknown; [key: string]: unknown },
    conditions: TriggerConditions
  ): Promise<TriggerEvaluation> {
    const { threshold = 30000, windowMinutes = 10 } = conditions;
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

    const recentLatency = await db.execute(sql`
      SELECT AVG(latency_ms) as avg_latency
      FROM provider_requests
      WHERE provider_name = ${provider.providerName}
        AND created_at >= ${windowStart}
        AND latency_ms IS NOT NULL
    `);

    const avgLatency = Number((recentLatency.rows[0] as { avg_latency: number })?.avg_latency || 0);

    return {
      shouldTrigger: avgLatency > threshold,
      currentValue: avgLatency,
      threshold,
      details: { avgLatency, windowMinutes },
    };
  }

  private async checkExecutionLimits(rule: RemediationRule): Promise<boolean> {
    const lastExecution = this.lastExecutionTime.get(rule.ruleId);
    if (lastExecution) {
      const cooldownMs = (rule.cooldownMinutes || 15) * 60 * 1000;
      if (Date.now() - lastExecution.getTime() < cooldownMs) {
        return false;
      }
    }

    const hourlyCount = this.executionCountPerHour.get(rule.ruleId) || 0;
    if (rule.maxExecutionsPerHour && hourlyCount >= rule.maxExecutionsPerHour) {
      return false;
    }

    return true;
  }

  private resetHourlyCountersIfNeeded(): void {
    const now = new Date();
    if (now.getMinutes() === 0 && now.getSeconds() < 30) {
      this.executionCountPerHour.clear();
    }
  }

  async executeRemediation(
    rule: RemediationRule,
    providerName: string,
    serviceType: string,
    evaluation: TriggerEvaluation
  ): Promise<RemediationResult> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const failureDetectedAt = new Date();
    const remediationStartedAt = new Date();

    const execution = await db.insert(remediationExecutions).values({
      executionId,
      ruleId: rule.ruleId,
      providerName,
      serviceType,
      failureDetectedAt,
      alertCreatedAt: new Date(),
      remediationStartedAt,
      triggerDetails: JSON.stringify(evaluation.details),
      actionTaken: rule.actionType,
      actionParams: rule.actionParams,
      status: "in_progress",
    }).returning();

    console.log(`[AutoRemediation] Executing ${rule.actionType} for ${providerName}`);

    try {
      const result = await this.performAction(rule, providerName, serviceType);
      const remediationCompletedAt = new Date();
      const recoveryConfirmedAt = result.recoveryConfirmed ? new Date() : null;

      const mttdSeconds = Math.floor((remediationStartedAt.getTime() - failureDetectedAt.getTime()) / 1000);
      const mttrSeconds = recoveryConfirmedAt 
        ? Math.floor((recoveryConfirmedAt.getTime() - remediationStartedAt.getTime()) / 1000)
        : null;

      await db.update(remediationExecutions)
        .set({
          status: result.success ? "success" : "failed",
          wasSuccessful: result.success,
          remediationCompletedAt,
          recoveryConfirmedAt,
          mttdSeconds,
          mttrSeconds,
          affectedRequests: result.affectedRequests || 0,
          recoveredRequests: result.recoveredRequests || 0,
          errorMessage: result.success ? null : result.message,
        })
        .where(eq(remediationExecutions.executionId, executionId));

      this.lastExecutionTime.set(rule.ruleId, new Date());
      this.executionCountPerHour.set(
        rule.ruleId, 
        (this.executionCountPerHour.get(rule.ruleId) || 0) + 1
      );

      await this.logAction(providerName, rule.actionType, result.message, evaluation.details);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await db.update(remediationExecutions)
        .set({
          status: "failed",
          wasSuccessful: false,
          remediationCompletedAt: new Date(),
          errorMessage,
        })
        .where(eq(remediationExecutions.executionId, executionId));

      return { success: false, message: errorMessage, recoveryConfirmed: false };
    }
  }

  private async performAction(
    rule: RemediationRule,
    providerName: string,
    serviceType: string
  ): Promise<RemediationResult> {
    const params: ActionParams = JSON.parse(rule.actionParams || "{}");

    switch (rule.actionType) {
      case "restart_provider":
        return this.actionRestartProvider(providerName);
      
      case "rotate_to_fallback":
        return this.actionRotateToFallback(providerName, serviceType, params);
      
      case "clear_rate_limit":
        return this.actionClearRateLimit(providerName);
      
      case "quarantine_provider":
        return this.actionQuarantineProvider(providerName, params);
      
      case "scale_cooldown":
        return this.actionScaleCooldown(providerName, params);
      
      case "requeue_failed_content":
        return this.actionRequeueFailedContent(providerName);
      
      case "run_diagnostic":
        return this.actionRunDiagnostic(providerName, params);
      
      case "notify_admin":
        return this.actionNotifyAdmin(providerName, params);
      
      default:
        return { success: false, message: `Unknown action: ${rule.actionType}`, recoveryConfirmed: false };
    }
  }

  private async actionRestartProvider(providerName: string): Promise<RemediationResult> {
    const config = PROVIDER_CONFIG[providerName as ProviderName];
    if (!config) {
      return { success: false, message: `Unknown provider: ${providerName}`, recoveryConfirmed: false };
    }

    await db.update(providerMetrics)
      .set({
        isHealthy: true,
        healthScore: "75",
        priority: config.basePriority,
        rateLimitHits: 0,
        rateLimitResetAt: null,
        updatedAt: new Date(),
      })
      .where(eq(providerMetrics.providerName, providerName));

    await healthMonitor.releaseFromQuarantine(providerName);

    return { 
      success: true, 
      message: `Provider ${providerName} restarted with reset metrics`,
      recoveryConfirmed: true 
    };
  }

  private async actionRotateToFallback(
    providerName: string,
    serviceType: string,
    params: ActionParams
  ): Promise<RemediationResult> {
    await db.update(providerMetrics)
      .set({
        priority: 0,
        isHealthy: false,
        updatedAt: new Date(),
      })
      .where(eq(providerMetrics.providerName, providerName));

    const fallbackProviders = await healthMonitor.getSmartProviderOrder(serviceType, {
      excludeProviders: [providerName],
    });

    if (fallbackProviders.length === 0) {
      return { 
        success: false, 
        message: `No fallback providers available for ${serviceType}`,
        recoveryConfirmed: false 
      };
    }

    return {
      success: true,
      message: `Rotated from ${providerName} to fallback chain: ${fallbackProviders.slice(0, 3).join(", ")}`,
      recoveryConfirmed: true,
    };
  }

  private async actionClearRateLimit(providerName: string): Promise<RemediationResult> {
    const config = PROVIDER_CONFIG[providerName as ProviderName];
    
    await db.update(providerMetrics)
      .set({
        rateLimitHits: 0,
        rateLimitResetAt: null,
        isHealthy: true,
        priority: config?.basePriority || 50,
        updatedAt: new Date(),
      })
      .where(eq(providerMetrics.providerName, providerName));

    return {
      success: true,
      message: `Rate limit cleared for ${providerName}`,
      recoveryConfirmed: true,
    };
  }

  private async actionQuarantineProvider(
    providerName: string,
    params: ActionParams
  ): Promise<RemediationResult> {
    const cooldownMinutes = params.cooldownMinutes || 30;
    const resetAt = new Date(Date.now() + cooldownMinutes * 60 * 1000);

    await db.update(providerMetrics)
      .set({
        isHealthy: false,
        priority: 0,
        rateLimitResetAt: resetAt,
        updatedAt: new Date(),
      })
      .where(eq(providerMetrics.providerName, providerName));

    return {
      success: true,
      message: `Provider ${providerName} quarantined for ${cooldownMinutes} minutes`,
      recoveryConfirmed: false,
    };
  }

  private async actionScaleCooldown(
    providerName: string,
    params: ActionParams
  ): Promise<RemediationResult> {
    const cooldownMinutes = params.cooldownMinutes || 5;
    const resetAt = new Date(Date.now() + cooldownMinutes * 60 * 1000);

    await db.update(providerMetrics)
      .set({
        rateLimitResetAt: resetAt,
        isHealthy: false,
        updatedAt: new Date(),
      })
      .where(eq(providerMetrics.providerName, providerName));

    return {
      success: true,
      message: `Cooldown applied to ${providerName} for ${cooldownMinutes} minutes`,
      recoveryConfirmed: false,
    };
  }

  private async actionRequeueFailedContent(providerName: string): Promise<RemediationResult> {
    const recentFailures = await db.execute(sql`
      SELECT DISTINCT project_id, scene_id
      FROM provider_requests
      WHERE provider_name = ${providerName}
        AND status = 'failed'
        AND created_at >= NOW() - INTERVAL '1 hour'
        AND project_id IS NOT NULL
    `);

    const count = recentFailures.rowCount || 0;
    
    return {
      success: true,
      message: `Identified ${count} failed requests for potential requeue`,
      recoveryConfirmed: false,
      affectedRequests: count,
    };
  }

  private async actionRunDiagnostic(
    providerName: string,
    params: ActionParams
  ): Promise<RemediationResult> {
    const diagnosticResults = {
      provider: providerName,
      timestamp: new Date().toISOString(),
      checks: {
        healthScore: await this.getProviderHealth(providerName),
        recentErrors: await this.getRecentErrors(providerName),
        latencyTrend: await this.getLatencyTrend(providerName),
      },
    };

    await db.insert(activityLogs).values({
      runId: `diagnostic_${providerName}`,
      eventType: "diagnostic_complete",
      level: "info",
      message: `Diagnostic completed for ${providerName}`,
      metadata: JSON.stringify(diagnosticResults),
    });

    return {
      success: true,
      message: `Diagnostic completed for ${providerName}`,
      recoveryConfirmed: false,
    };
  }

  private async actionNotifyAdmin(
    providerName: string,
    params: ActionParams
  ): Promise<RemediationResult> {
    await db.insert(activityLogs).values({
      runId: `notify_${providerName}`,
      eventType: "admin_notification",
      level: "warning",
      message: `Admin notification: Provider ${providerName} requires attention`,
      metadata: JSON.stringify({ providerName, channel: params.notifyChannel }),
    });

    return {
      success: true,
      message: `Admin notification sent for ${providerName}`,
      recoveryConfirmed: false,
    };
  }

  private async getProviderHealth(providerName: string): Promise<number> {
    const [provider] = await db.select()
      .from(providerMetrics)
      .where(eq(providerMetrics.providerName, providerName))
      .limit(1);
    
    return parseFloat(provider?.healthScore || "0");
  }

  private async getRecentErrors(providerName: string): Promise<number> {
    const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM provider_requests
      WHERE provider_name = ${providerName}
        AND status = 'failed'
        AND created_at >= NOW() - INTERVAL '1 hour'
    `);
    return Number((result.rows[0] as { count: number })?.count || 0);
  }

  private async getLatencyTrend(providerName: string): Promise<string> {
    const result = await db.execute(sql`
      SELECT 
        AVG(CASE WHEN created_at >= NOW() - INTERVAL '30 minutes' THEN latency_ms END) as recent,
        AVG(CASE WHEN created_at < NOW() - INTERVAL '30 minutes' THEN latency_ms END) as older
      FROM provider_requests
      WHERE provider_name = ${providerName}
        AND created_at >= NOW() - INTERVAL '1 hour'
        AND latency_ms IS NOT NULL
    `);
    
    const recent = Number((result.rows[0] as { recent: number })?.recent || 0);
    const older = Number((result.rows[0] as { older: number })?.older || 0);
    
    if (older === 0) return "insufficient_data";
    if (recent > older * 1.5) return "increasing";
    if (recent < older * 0.7) return "decreasing";
    return "stable";
  }

  private async createPendingRemediation(
    rule: RemediationRule,
    providerName: string,
    serviceType: string,
    evaluation: TriggerEvaluation
  ): Promise<void> {
    const executionId = `pending_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    await db.insert(remediationExecutions).values({
      executionId,
      ruleId: rule.ruleId,
      providerName,
      serviceType,
      failureDetectedAt: new Date(),
      alertCreatedAt: new Date(),
      triggerDetails: JSON.stringify(evaluation.details),
      actionTaken: rule.actionType,
      actionParams: rule.actionParams,
      status: "pending",
    });

    console.log(`[AutoRemediation] Created pending remediation ${executionId} for ${providerName}`);
  }

  async approvePendingRemediation(executionId: string): Promise<RemediationResult> {
    const [execution] = await db.select()
      .from(remediationExecutions)
      .where(eq(remediationExecutions.executionId, executionId))
      .limit(1);

    if (!execution) {
      return { success: false, message: "Execution not found", recoveryConfirmed: false };
    }

    if (execution.status !== "pending") {
      return { success: false, message: "Execution is not pending", recoveryConfirmed: false };
    }

    const [rule] = await db.select()
      .from(remediationRules)
      .where(eq(remediationRules.ruleId, execution.ruleId))
      .limit(1);

    if (!rule) {
      return { success: false, message: "Rule not found", recoveryConfirmed: false };
    }

    return this.executeRemediation(
      rule,
      execution.providerName || "",
      execution.serviceType || "",
      { shouldTrigger: true, details: JSON.parse(execution.triggerDetails || "{}") }
    );
  }

  async rejectPendingRemediation(executionId: string, reason?: string): Promise<void> {
    await db.update(remediationExecutions)
      .set({
        status: "rolled_back",
        wasSuccessful: false,
        errorMessage: reason || "Rejected by user",
        remediationCompletedAt: new Date(),
      })
      .where(eq(remediationExecutions.executionId, executionId));
  }

  private async logAction(
    providerName: string,
    actionType: string,
    message: string,
    details: Record<string, unknown>
  ): Promise<void> {
    await db.insert(healingActionsLog).values({
      providerName,
      actionType,
      reason: message,
      triggeredBy: "auto_remediation",
      metadata: JSON.stringify(details),
    });
  }

  async startFailureSimulation(params: {
    name: string;
    description?: string;
    targetProvider?: string;
    targetServiceType?: string;
    failureType: string;
    failureParams: Record<string, unknown>;
    durationMinutes: number;
  }): Promise<FailureSimulation> {
    const simulationId = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + params.durationMinutes * 60 * 1000);

    const [simulation] = await db.insert(failureSimulations).values({
      simulationId,
      name: params.name,
      description: params.description,
      targetProvider: params.targetProvider,
      targetServiceType: params.targetServiceType,
      failureType: params.failureType,
      failureParams: JSON.stringify(params.failureParams),
      status: "running",
      startedAt,
      scheduledDurationMinutes: params.durationMinutes,
    }).returning();

    this.activeSimulations.set(simulationId, {
      simulationId,
      targetProvider: params.targetProvider,
      failureType: params.failureType,
      failureParams: params.failureParams,
      startedAt,
      endsAt,
    });

    console.log(`[AutoRemediation] Started simulation ${simulationId}: ${params.failureType}`);

    return simulation;
  }

  async stopFailureSimulation(simulationId: string): Promise<void> {
    this.activeSimulations.delete(simulationId);

    await db.update(failureSimulations)
      .set({
        status: "completed",
        completedAt: new Date(),
      })
      .where(eq(failureSimulations.simulationId, simulationId));
  }

  private async checkActiveSimulations(): Promise<void> {
    const now = new Date();
    
    const entries = Array.from(this.activeSimulations.entries());
    for (const [simulationId, simulation] of entries) {
      if (now >= simulation.endsAt) {
        await this.completeSimulation(simulationId);
      }
    }
  }

  private async completeSimulation(simulationId: string): Promise<void> {
    const simulation = this.activeSimulations.get(simulationId);
    if (!simulation) return;

    const remediations = await db.select()
      .from(remediationExecutions)
      .where(and(
        gte(remediationExecutions.createdAt, simulation.startedAt),
        lte(remediationExecutions.createdAt, new Date())
      ));

    const firstRemediation = remediations[0];
    const detectionTimeSeconds = firstRemediation 
      ? Math.floor((firstRemediation.failureDetectedAt.getTime() - simulation.startedAt.getTime()) / 1000)
      : null;

    const successfulRemediation = remediations.find(r => r.wasSuccessful);
    const remediationTimeSeconds = successfulRemediation?.mttrSeconds || null;

    const passedDetection = detectionTimeSeconds !== null && detectionTimeSeconds <= 60;
    const passedRemediation = remediationTimeSeconds !== null && remediationTimeSeconds <= 300;
    const overallScore = ((passedDetection ? 50 : 0) + (passedRemediation ? 50 : 0)).toString();

    await db.update(failureSimulations)
      .set({
        status: "completed",
        completedAt: new Date(),
        detectionTimeSeconds,
        remediationTimeSeconds,
        totalAffectedRequests: remediations.length,
        correctlyHandledRequests: remediations.filter(r => r.wasSuccessful).length,
        passedDetection,
        passedRemediation,
        overallScore,
      })
      .where(eq(failureSimulations.simulationId, simulationId));

    this.activeSimulations.delete(simulationId);
    console.log(`[AutoRemediation] Completed simulation ${simulationId}`);
  }

  isSimulationActive(providerName?: string): ActiveSimulation | null {
    const simulations = Array.from(this.activeSimulations.values());
    for (const simulation of simulations) {
      if (!providerName || !simulation.targetProvider || simulation.targetProvider === providerName) {
        return simulation;
      }
    }
    return null;
  }

  shouldInjectFailure(providerName: string): { inject: boolean; failureType?: string; params?: Record<string, unknown> } {
    const simulation = this.isSimulationActive(providerName);
    if (!simulation) {
      return { inject: false };
    }

    const errorRate = (simulation.failureParams.error_rate as number) || 1.0;
    if (Math.random() > errorRate) {
      return { inject: false };
    }

    return {
      inject: true,
      failureType: simulation.failureType,
      params: simulation.failureParams,
    };
  }

  async getHealingMetrics(options: {
    granularity?: string;
    providerName?: string;
    serviceType?: string;
    hours?: number;
  } = {}): Promise<{
    current: { avgMttd: number; avgMttr: number; failureRate: number; successRate: number };
    trend: { mttdChange: number; mttrChange: number; failureRateChange: number };
    byProvider: Array<{ provider: string; mttd: number; mttr: number; failures: number }>;
  }> {
    const { hours = 24 } = options;
    const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);

    const executions = await db.select()
      .from(remediationExecutions)
      .where(gte(remediationExecutions.createdAt, windowStart));

    const successful = executions.filter(e => e.wasSuccessful);
    const avgMttd = executions.length > 0
      ? executions.reduce((sum, e) => sum + (e.mttdSeconds || 0), 0) / executions.length
      : 0;
    const avgMttr = successful.length > 0
      ? successful.reduce((sum, e) => sum + (e.mttrSeconds || 0), 0) / successful.length
      : 0;

    const totalRequests = await db.execute(sql`
      SELECT COUNT(*) as count FROM provider_requests WHERE created_at >= ${windowStart}
    `);
    const totalCount = Number((totalRequests.rows[0] as { count: number })?.count || 1);
    const failureRate = executions.length / totalCount;
    const successRate = executions.length > 0 ? successful.length / executions.length : 1;

    const byProvider = await db.execute(sql`
      SELECT 
        provider_name,
        AVG(mttd_seconds) as avg_mttd,
        AVG(mttr_seconds) as avg_mttr,
        COUNT(*) as failure_count
      FROM remediation_executions
      WHERE created_at >= ${windowStart}
      GROUP BY provider_name
    `);

    return {
      current: { avgMttd, avgMttr, failureRate, successRate },
      trend: { mttdChange: 0, mttrChange: 0, failureRateChange: 0 },
      byProvider: (byProvider.rows as Array<{ provider_name: string; avg_mttd: number; avg_mttr: number; failure_count: number }>).map(r => ({
        provider: r.provider_name,
        mttd: Number(r.avg_mttd || 0),
        mttr: Number(r.avg_mttr || 0),
        failures: Number(r.failure_count || 0),
      })),
    };
  }

  async getRules(): Promise<RemediationRule[]> {
    return db.select().from(remediationRules).orderBy(desc(remediationRules.priority));
  }

  async updateRule(ruleId: string, updates: Partial<RemediationRule>): Promise<void> {
    await db.update(remediationRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(remediationRules.ruleId, ruleId));
  }

  async getPendingRemediations(): Promise<RemediationExecution[]> {
    return db.select()
      .from(remediationExecutions)
      .where(eq(remediationExecutions.status, "pending"))
      .orderBy(desc(remediationExecutions.createdAt));
  }

  async getRecentExecutions(limit = 50): Promise<RemediationExecution[]> {
    return db.select()
      .from(remediationExecutions)
      .orderBy(desc(remediationExecutions.createdAt))
      .limit(limit);
  }

  async getSimulations(): Promise<FailureSimulation[]> {
    return db.select()
      .from(failureSimulations)
      .orderBy(desc(failureSimulations.createdAt));
  }
}

export const autoRemediationEngine = AutoRemediationEngine.getInstance();
