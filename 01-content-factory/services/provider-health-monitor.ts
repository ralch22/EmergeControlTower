import { db } from "../../server/db";
import { 
  providerMetrics, 
  providerRequests, 
  providerErrorPatterns,
  providerFallbackChains,
  healingActionsLog,
  activityLogs 
} from "../../shared/schema";
import { eq, and, desc, sql, gt } from "drizzle-orm";

// Provider configuration with cost and tier information
export const PROVIDER_CONFIG = {
  // Video providers
  veo31: { 
    serviceType: 'video', 
    isFree: true, 
    costPerRequest: 0, 
    basePriority: 90,
    constraints: { maxDuration: 8 }
  },
  runway: { 
    serviceType: 'video', 
    isFree: false, 
    costPerRequest: 0.05,
    basePriority: 70,
    constraints: { allowedDurations: [5, 10] }
  },
  
  // Image providers
  gemini_image: { 
    serviceType: 'image', 
    isFree: true, 
    costPerRequest: 0, 
    basePriority: 90,
    constraints: {}
  },
  adobe_firefly: { 
    serviceType: 'image', 
    isFree: false, 
    costPerRequest: 0.04,
    basePriority: 85,
    constraints: { maxWidth: 2048, maxHeight: 2048 }
  },
  fal_ai: { 
    serviceType: 'image', 
    isFree: false, 
    costPerRequest: 0.01, 
    basePriority: 80,
    constraints: {}
  },
  dashscope: { 
    serviceType: 'image', 
    isFree: false, 
    costPerRequest: 0.008, 
    basePriority: 70,
    constraints: {}
  },
  
  // Audio providers
  elevenlabs: { 
    serviceType: 'audio', 
    isFree: false, 
    costPerRequest: 0.015, 
    basePriority: 90,
    constraints: { charLimit: 5000 }
  },
  openai_tts: { 
    serviceType: 'audio', 
    isFree: false, 
    costPerRequest: 0.015, 
    basePriority: 70,
    constraints: {}
  },
  
  // Text providers
  anthropic: { 
    serviceType: 'text', 
    isFree: false, 
    costPerRequest: 0.01, 
    basePriority: 90,
    constraints: {}
  },
  gemini_text: { 
    serviceType: 'text', 
    isFree: true, 
    costPerRequest: 0, 
    basePriority: 80,
    constraints: {}
  },
  
  // OpenRouter providers (unified gateway)
  openrouter_deepseek_r1: { 
    serviceType: 'text', 
    isFree: true, 
    costPerRequest: 0, 
    basePriority: 85,
    constraints: { contextLength: 164000, capabilities: ['reasoning'] }
  },
  openrouter_llama4_maverick: { 
    serviceType: 'text', 
    isFree: true, 
    costPerRequest: 0, 
    basePriority: 82,
    constraints: { contextLength: 128000, capabilities: ['vision'] }
  },
  openrouter_mistral_small: { 
    serviceType: 'text', 
    isFree: true, 
    costPerRequest: 0, 
    basePriority: 78,
    constraints: { contextLength: 96000 }
  },
  openrouter_qwen3: { 
    serviceType: 'text', 
    isFree: false, 
    costPerRequest: 0.0012, 
    basePriority: 75,
    constraints: { contextLength: 131000, capabilities: ['reasoning'] }
  },
  openrouter_deepseek_v3: { 
    serviceType: 'text', 
    isFree: false, 
    costPerRequest: 0.0002, 
    basePriority: 72,
    constraints: { contextLength: 128000 }
  },
} as const;

export type ProviderName = keyof typeof PROVIDER_CONFIG;

export interface ProviderHealthStatus {
  providerName: string;
  serviceType: string;
  isHealthy: boolean;
  healthScore: number;
  successRate: number;
  avgLatencyMs: number;
  rateLimitActive: boolean;
  lastError?: string;
  priority: number;
  isFreeProvider: boolean;
}

export interface RequestResult {
  success: boolean;
  latencyMs: number;
  errorCode?: string;
  errorMessage?: string;
  costIncurred?: number;
}

class ProviderHealthMonitor {
  private static instance: ProviderHealthMonitor;
  
  private constructor() {}
  
  static getInstance(): ProviderHealthMonitor {
    if (!ProviderHealthMonitor.instance) {
      ProviderHealthMonitor.instance = new ProviderHealthMonitor();
    }
    return ProviderHealthMonitor.instance;
  }

  async initializeProviders(): Promise<void> {
    for (const [name, config] of Object.entries(PROVIDER_CONFIG)) {
      const existing = await db.select()
        .from(providerMetrics)
        .where(eq(providerMetrics.providerName, name))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(providerMetrics).values({
          providerName: name,
          serviceType: config.serviceType,
          isFreeProvider: config.isFree,
          costPerRequest: config.costPerRequest.toString(),
          priority: config.basePriority,
          healthScore: "100",
        });
        console.log(`[HealthMonitor] Initialized provider: ${name}`);
      }
    }
    
    await this.initializeDefaultFallbackChains();
  }

  private async initializeDefaultFallbackChains(): Promise<void> {
    const chains = [
      { 
        serviceType: 'video', 
        chainName: 'video_default', 
        providerOrder: JSON.stringify(['veo31', 'runway']),
        isDefault: true 
      },
      { 
        serviceType: 'video', 
        chainName: 'video_free_only', 
        providerOrder: JSON.stringify(['veo31']),
        conditions: JSON.stringify({ freeOnly: true })
      },
      { 
        serviceType: 'image', 
        chainName: 'image_default', 
        providerOrder: JSON.stringify(['gemini_image', 'adobe_firefly', 'fal_ai', 'dashscope']),
        isDefault: true 
      },
      { 
        serviceType: 'image', 
        chainName: 'image_premium', 
        providerOrder: JSON.stringify(['adobe_firefly', 'fal_ai', 'dashscope', 'gemini_image']),
        conditions: JSON.stringify({ premiumFirst: true })
      },
      { 
        serviceType: 'image', 
        chainName: 'image_free_only', 
        providerOrder: JSON.stringify(['gemini_image']),
        conditions: JSON.stringify({ freeOnly: true })
      },
      { 
        serviceType: 'audio', 
        chainName: 'audio_default', 
        providerOrder: JSON.stringify(['elevenlabs', 'openai_tts']),
        isDefault: true 
      },
      { 
        serviceType: 'text', 
        chainName: 'text_default', 
        providerOrder: JSON.stringify(['anthropic', 'openrouter_deepseek_r1', 'openrouter_llama4_maverick', 'gemini_text']),
        isDefault: true 
      },
      { 
        serviceType: 'text', 
        chainName: 'text_free_only', 
        providerOrder: JSON.stringify(['openrouter_deepseek_r1', 'openrouter_llama4_maverick', 'openrouter_mistral_small', 'gemini_text']),
        conditions: JSON.stringify({ freeOnly: true })
      },
      { 
        serviceType: 'text', 
        chainName: 'text_reasoning', 
        providerOrder: JSON.stringify(['openrouter_deepseek_r1', 'openrouter_qwen3', 'anthropic']),
        conditions: JSON.stringify({ capability: 'reasoning' })
      },
      { 
        serviceType: 'text', 
        chainName: 'text_bulk_content', 
        providerOrder: JSON.stringify(['openrouter_deepseek_v3', 'openrouter_mistral_small', 'openrouter_llama4_maverick', 'gemini_text']),
        conditions: JSON.stringify({ bulkGeneration: true, costOptimized: true })
      },
    ];

    for (const chain of chains) {
      const existing = await db.select()
        .from(providerFallbackChains)
        .where(and(
          eq(providerFallbackChains.serviceType, chain.serviceType),
          eq(providerFallbackChains.chainName, chain.chainName)
        ))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(providerFallbackChains).values(chain);
        console.log(`[HealthMonitor] Initialized fallback chain: ${chain.chainName}`);
      }
    }
  }

  async recordRequest(
    providerName: string,
    serviceType: string,
    requestId: string,
    result: RequestResult,
    projectId?: string,
    sceneId?: string,
    requestParams?: Record<string, unknown>
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      await db.insert(providerRequests).values({
        providerName,
        serviceType,
        requestId,
        status: result.success ? 'success' : 'failed',
        latencyMs: result.latencyMs,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        costIncurred: result.costIncurred?.toString(),
        projectId,
        sceneId,
        requestParams: requestParams ? JSON.stringify(requestParams) : undefined,
      });

      await this.updateProviderMetrics(providerName, result);

      if (!result.success && result.errorMessage) {
        await this.learnErrorPattern(providerName, result, requestParams);
      }

      if (this.isRateLimitError(result.errorCode, result.errorMessage)) {
        await this.handleRateLimit(providerName);
      }

    } catch (error) {
      console.error(`[HealthMonitor] Error recording request:`, error);
    }
  }

  private async updateProviderMetrics(
    providerName: string, 
    result: RequestResult
  ): Promise<void> {
    const metrics = await db.select()
      .from(providerMetrics)
      .where(eq(providerMetrics.providerName, providerName))
      .limit(1);

    if (metrics.length === 0) {
      console.warn(`[HealthMonitor] Provider ${providerName} not found in metrics`);
      return;
    }

    const current = metrics[0];
    const newSuccessCount = current.successCount + (result.success ? 1 : 0);
    const newFailureCount = current.failureCount + (result.success ? 0 : 1);
    const newTotalRequests = current.totalRequests + 1;
    
    const currentAvgLatency = parseFloat(current.avgLatencyMs || '0');
    const newAvgLatency = currentAvgLatency === 0 
      ? result.latencyMs 
      : (currentAvgLatency * (newTotalRequests - 1) + result.latencyMs) / newTotalRequests;

    const successRate = newTotalRequests > 0 ? (newSuccessCount / newTotalRequests) * 100 : 100;
    const latencyPenalty = Math.min(newAvgLatency / 10000, 20); // Up to 20 point penalty for slow responses
    const rateLimitPenalty = current.rateLimitHits > 0 ? Math.min(current.rateLimitHits * 5, 30) : 0;
    
    const healthScore = Math.max(0, Math.min(100, successRate - latencyPenalty - rateLimitPenalty));
    const isHealthy = healthScore >= 50 && successRate >= 60;

    const config = PROVIDER_CONFIG[providerName as ProviderName];
    const basePriority = config?.basePriority || 50;
    const newPriority = Math.round(basePriority * (healthScore / 100));

    const currentTotalCost = parseFloat(current.totalCost || '0');
    const newTotalCost = currentTotalCost + (result.costIncurred || 0);

    await db.update(providerMetrics)
      .set({
        successCount: newSuccessCount,
        failureCount: newFailureCount,
        totalRequests: newTotalRequests,
        avgLatencyMs: newAvgLatency.toFixed(2),
        lastSuccessAt: result.success ? new Date() : current.lastSuccessAt,
        lastFailureAt: result.success ? current.lastFailureAt : new Date(),
        lastErrorMessage: result.success ? current.lastErrorMessage : result.errorMessage,
        healthScore: healthScore.toFixed(2),
        isHealthy,
        priority: newPriority,
        totalCost: newTotalCost.toFixed(4),
        updatedAt: new Date(),
      })
      .where(eq(providerMetrics.providerName, providerName));

    if (current.isHealthy && !isHealthy) {
      await this.logHealingAction(providerName, 'priority_adjusted', {
        healthScore: current.healthScore,
        priority: current.priority,
        isHealthy: current.isHealthy,
      }, {
        healthScore: healthScore.toFixed(2),
        priority: newPriority,
        isHealthy,
      }, `Health score dropped below threshold (${healthScore.toFixed(1)}%)`, 'system_auto');
    }
  }

  private async learnErrorPattern(
    providerName: string,
    result: RequestResult,
    requestParams?: Record<string, unknown>
  ): Promise<void> {
    const patternType = this.detectPatternType(result.errorMessage || '', result.errorCode);
    const patternKey = this.generatePatternKey(patternType, requestParams, result);

    const existing = await db.select()
      .from(providerErrorPatterns)
      .where(and(
        eq(providerErrorPatterns.providerName, providerName),
        eq(providerErrorPatterns.patternKey, patternKey)
      ))
      .limit(1);

    if (existing.length > 0) {
      const newCount = existing[0].occurrenceCount + 1;
      const newConfidence = Math.min(0.99, 0.5 + (newCount * 0.1));
      
      await db.update(providerErrorPatterns)
        .set({
          occurrenceCount: newCount,
          lastOccurrence: new Date(),
          confidenceScore: newConfidence.toFixed(4),
        })
        .where(eq(providerErrorPatterns.id, existing[0].id));
    } else {
      const suggestedFix = this.generateSuggestedFix(providerName, patternType, requestParams);
      
      await db.insert(providerErrorPatterns).values({
        providerName,
        patternType,
        patternKey,
        errorCode: result.errorCode,
        errorMessagePattern: result.errorMessage?.substring(0, 500),
        suggestedFix,
        confidenceScore: "0.5",
      });

      await this.logHealingAction(providerName, 'error_pattern_learned', null, {
        patternType,
        patternKey,
        suggestedFix,
      }, `New error pattern detected: ${patternType}`, 'ml_prediction');
    }
  }

  private detectPatternType(errorMessage: string, errorCode?: string): string {
    const lowercaseError = errorMessage.toLowerCase();
    
    if (lowercaseError.includes('duration') || lowercaseError.includes('expected 5') || lowercaseError.includes('expected 10')) {
      return 'duration_constraint';
    }
    if (lowercaseError.includes('rate limit') || lowercaseError.includes('too many requests') || errorCode === '429') {
      return 'rate_limit';
    }
    if (lowercaseError.includes('content') && (lowercaseError.includes('filter') || lowercaseError.includes('policy'))) {
      return 'content_filter';
    }
    if (lowercaseError.includes('prompt') && lowercaseError.includes('length')) {
      return 'prompt_length';
    }
    if (lowercaseError.includes('not found') || lowercaseError.includes('404')) {
      return 'api_version';
    }
    if (lowercaseError.includes('quota') || lowercaseError.includes('limit exceeded')) {
      return 'quota_exceeded';
    }
    
    return 'unknown';
  }

  private generatePatternKey(
    patternType: string, 
    requestParams?: Record<string, unknown>,
    result?: RequestResult
  ): string {
    switch (patternType) {
      case 'duration_constraint':
        return `duration:${requestParams?.duration || 'unknown'}`;
      case 'prompt_length':
        const promptLength = requestParams?.promptLength || 
          (typeof requestParams?.prompt === 'string' ? requestParams.prompt.length : 0);
        return `prompt_length:${Math.floor(Number(promptLength) / 100) * 100}`;
      case 'rate_limit':
        return `rate_limit:${new Date().toISOString().slice(0, 13)}`; // Hourly bucket
      case 'content_filter':
        return `content_filter:${result?.errorCode || 'unknown'}`;
      default:
        return `${patternType}:${result?.errorCode || 'generic'}`;
    }
  }

  private generateSuggestedFix(
    providerName: string,
    patternType: string,
    requestParams?: Record<string, unknown>
  ): string {
    switch (patternType) {
      case 'duration_constraint':
        if (providerName === 'runway') {
          return 'Runway only accepts 5 or 10 second durations. Use veo31 for other durations.';
        }
        return `Adjust duration to supported values for ${providerName}`;
      case 'rate_limit':
        return `Rate limited. Automatically falling back to alternative provider. Consider adding delay between requests.`;
      case 'content_filter':
        return 'Content was filtered. Modify prompt to avoid triggering content policies.';
      case 'prompt_length':
        return 'Prompt too long. Consider shortening or using a provider with higher limits.';
      case 'quota_exceeded':
        return 'Quota exceeded. Switch to free tier provider or wait for quota reset.';
      default:
        return 'Unknown error. Review logs and consider using alternative provider.';
    }
  }

  private isRateLimitError(errorCode?: string, errorMessage?: string): boolean {
    if (errorCode === '429') return true;
    if (!errorMessage) return false;
    const lower = errorMessage.toLowerCase();
    return lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('quota exceeded');
  }

  private async handleRateLimit(providerName: string): Promise<void> {
    const cooldownMinutes = 5;
    const resetAt = new Date(Date.now() + cooldownMinutes * 60 * 1000);

    await db.update(providerMetrics)
      .set({
        rateLimitHits: sql`${providerMetrics.rateLimitHits} + 1`,
        rateLimitResetAt: resetAt,
        isHealthy: false,
        priority: 0,
        updatedAt: new Date(),
      })
      .where(eq(providerMetrics.providerName, providerName));

    await this.logHealingAction(providerName, 'rate_limit_cooldown', null, {
      resetAt: resetAt.toISOString(),
      cooldownMinutes,
    }, `Rate limit detected. Provider disabled until ${resetAt.toISOString()}`, 'system_auto');

    console.log(`[HealthMonitor] Rate limit detected for ${providerName}, cooldown until ${resetAt.toISOString()}`);
  }

  async getSmartProviderOrder(serviceType: string, options?: {
    freeOnly?: boolean;
    excludeProviders?: string[];
    requestParams?: Record<string, unknown>;
  }): Promise<string[]> {
    const now = new Date();

    let query = db.select()
      .from(providerMetrics)
      .where(and(
        eq(providerMetrics.serviceType, serviceType),
        eq(providerMetrics.isHealthy, true)
      ))
      .orderBy(desc(providerMetrics.priority));

    let providers = await query;

    providers = providers.filter(p => {
      if (p.rateLimitResetAt && new Date(p.rateLimitResetAt) > now) {
        return false;
      }
      return true;
    });

    if (options?.freeOnly) {
      providers = providers.filter(p => p.isFreeProvider);
    }

    if (options?.excludeProviders) {
      providers = providers.filter(p => !options.excludeProviders!.includes(p.providerName));
    }

    if (options?.requestParams) {
      providers = await this.filterByErrorPatterns(providers, options.requestParams);
    }

    return providers.map(p => p.providerName);
  }

  private async filterByErrorPatterns<T extends { providerName: string }>(
    providers: T[],
    requestParams: Record<string, unknown>
  ): Promise<T[]> {
    const filtered: T[] = [];

    for (const provider of providers) {
      const shouldSkip = await this.checkErrorPatterns(provider.providerName, requestParams);
      if (!shouldSkip) {
        filtered.push(provider);
      }
    }

    return filtered;
  }

  private async checkErrorPatterns(
    providerName: string,
    requestParams: Record<string, unknown>
  ): Promise<boolean> {
    const config = PROVIDER_CONFIG[providerName as ProviderName];
    if (!config) return false;

    if (providerName === 'runway' && requestParams.duration) {
      const duration = Number(requestParams.duration);
      const allowedDurations = (config as { constraints: { allowedDurations?: number[] } }).constraints.allowedDurations;
      if (allowedDurations && !allowedDurations.includes(duration)) {
        console.log(`[HealthMonitor] Skipping ${providerName}: duration ${duration}s not in allowed durations ${allowedDurations}`);
        return true;
      }
    }

    const patterns = await db.select()
      .from(providerErrorPatterns)
      .where(and(
        eq(providerErrorPatterns.providerName, providerName),
        eq(providerErrorPatterns.isActive, true),
        gt(providerErrorPatterns.confidenceScore, "0.7")
      ));

    for (const pattern of patterns) {
      if (pattern.patternType === 'duration_constraint' && requestParams.duration) {
        const patternDuration = pattern.patternKey.split(':')[1];
        if (patternDuration === String(requestParams.duration)) {
          console.log(`[HealthMonitor] Skipping ${providerName}: learned error pattern for duration ${patternDuration}`);
          return true;
        }
      }
    }

    return false;
  }

  async getAllProviderStatus(): Promise<ProviderHealthStatus[]> {
    const now = new Date();
    const metrics = await db.select()
      .from(providerMetrics)
      .orderBy(desc(providerMetrics.priority));

    return metrics.map(m => ({
      providerName: m.providerName,
      serviceType: m.serviceType,
      isHealthy: m.isHealthy && (!m.rateLimitResetAt || new Date(m.rateLimitResetAt) <= now),
      healthScore: parseFloat(m.healthScore || '100'),
      successRate: m.totalRequests > 0 ? (m.successCount / m.totalRequests) * 100 : 100,
      avgLatencyMs: parseFloat(m.avgLatencyMs || '0'),
      rateLimitActive: m.rateLimitResetAt ? new Date(m.rateLimitResetAt) > now : false,
      lastError: m.lastErrorMessage || undefined,
      priority: m.priority,
      isFreeProvider: m.isFreeProvider,
    }));
  }

  async getProviderStatusByType(serviceType: string): Promise<ProviderHealthStatus[]> {
    const all = await this.getAllProviderStatus();
    return all.filter(p => p.serviceType === serviceType);
  }

  async getRecentHealingActions(limit = 20): Promise<Array<{
    providerName: string;
    actionType: string;
    reason: string;
    triggeredBy: string;
    createdAt: Date;
  }>> {
    const actions = await db.select()
      .from(healingActionsLog)
      .orderBy(desc(healingActionsLog.createdAt))
      .limit(limit);

    return actions;
  }

  private async logHealingAction(
    providerName: string,
    actionType: string,
    previousState: unknown,
    newState: unknown,
    reason: string,
    triggeredBy: string
  ): Promise<void> {
    await db.insert(healingActionsLog).values({
      providerName,
      actionType,
      previousState: previousState ? JSON.stringify(previousState) : null,
      newState: newState ? JSON.stringify(newState) : null,
      reason,
      triggeredBy,
    });

    await db.insert(activityLogs).values({
      runId: `healing_${providerName}`,
      eventType: `healing_${actionType}`,
      level: actionType.includes('error') || actionType.includes('disabled') ? 'warning' : 'info',
      message: `[SelfHealing] ${providerName}: ${reason}`,
      metadata: JSON.stringify({ actionType, triggeredBy, newState }),
    });
  }

  async resetRateLimits(): Promise<void> {
    const now = new Date();
    
    await db.update(providerMetrics)
      .set({
        rateLimitHits: 0,
        rateLimitResetAt: null,
        isHealthy: true,
        updatedAt: now,
      })
      .where(gt(providerMetrics.rateLimitResetAt, sql`'1970-01-01'::timestamp`));

    console.log('[HealthMonitor] Rate limits reset for all providers');
  }

  async recalculateAllPriorities(): Promise<void> {
    const metrics = await db.select().from(providerMetrics);

    for (const m of metrics) {
      const config = PROVIDER_CONFIG[m.providerName as ProviderName];
      if (!config) continue;

      const successRate = m.totalRequests > 0 ? (m.successCount / m.totalRequests) * 100 : 100;
      const avgLatency = parseFloat(m.avgLatencyMs || '0');
      const latencyPenalty = Math.min(avgLatency / 10000, 20);
      const rateLimitPenalty = m.rateLimitHits > 0 ? Math.min(m.rateLimitHits * 5, 30) : 0;
      
      const healthScore = Math.max(0, Math.min(100, successRate - latencyPenalty - rateLimitPenalty));
      const newPriority = Math.round(config.basePriority * (healthScore / 100));

      await db.update(providerMetrics)
        .set({
          healthScore: healthScore.toFixed(2),
          priority: newPriority,
          isHealthy: healthScore >= 50,
          updatedAt: new Date(),
        })
        .where(eq(providerMetrics.id, m.id));
    }

    console.log('[HealthMonitor] All provider priorities recalculated');
  }
}

export const healthMonitor = ProviderHealthMonitor.getInstance();
