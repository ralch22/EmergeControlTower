/**
 * Dual-Path Router
 * 
 * Implements intelligent routing between:
 * - Quality Maximized Route: Higher cost, more iterations, human review checkpoints
 * - Efficiency Maximized Route: Fast generation, auto-QA, bulk production
 * 
 * Uses client tier, content priority, budget, and learned patterns to decide routing.
 * Now integrates with Central Learning Engine to consume signals for smarter decisions.
 */

import type { EnrichedClientBrief } from './brand-brief';
import { db } from '../../server/db';
import { learningSignals, routeDecisions, generationRuns } from '../../shared/schema';
import { eq, and, desc, gte, avg, sql } from 'drizzle-orm';

export type RouteType = 'quality_max' | 'efficiency_max' | 'balanced';
export type ContentPriority = 'critical' | 'high' | 'standard' | 'bulk';
export type ClientTier = 'enterprise' | 'premium' | 'standard' | 'starter';

export interface RoutingContext {
  clientId: number;
  clientTier: ClientTier;
  contentType: 'video' | 'blog' | 'social' | 'ad_copy' | 'image';
  contentPriority: ContentPriority;
  budget?: 'unlimited' | 'standard' | 'minimal';
  deadline?: Date;
  previousQualityScore?: number;
  isFirstContent?: boolean;
  batchSize?: number;
}

export interface RouteDecision {
  route: RouteType;
  reason: string;
  config: RouteConfig;
  expectedQuality: number;
  expectedCostUsd: number;
  expectedTimeMinutes: number;
  reviewCheckpoints: ReviewCheckpoint[];
  learningAdjustments?: LearningAdjustment[];
}

export interface LearningAdjustment {
  signalId: number;
  signalType: string;
  adjustmentType: 'route_upgrade' | 'route_downgrade' | 'provider_override' | 'quality_boost';
  originalValue: string;
  adjustedValue: string;
  confidence: number;
}

export interface RouteConfig {
  maxRetries: number;
  qualityThreshold: number;
  autoApprove: boolean;
  humanReviewRequired: boolean;
  usePremiumProviders: boolean;
  parallelGeneration: boolean;
  cacheResults: boolean;
  iterationLimit: number;
}

export interface ReviewCheckpoint {
  stage: 'generation' | 'qa' | 'brand_check' | 'final';
  type: 'auto' | 'human';
  description: string;
}

// Default configurations for each route
const ROUTE_CONFIGS: Record<RouteType, RouteConfig> = {
  quality_max: {
    maxRetries: 3,
    qualityThreshold: 8.5,
    autoApprove: false,
    humanReviewRequired: true,
    usePremiumProviders: true,
    parallelGeneration: false,
    cacheResults: true,
    iterationLimit: 5,
  },
  balanced: {
    maxRetries: 2,
    qualityThreshold: 7.0,
    autoApprove: true,
    humanReviewRequired: false,
    usePremiumProviders: true,
    parallelGeneration: true,
    cacheResults: true,
    iterationLimit: 3,
  },
  efficiency_max: {
    maxRetries: 1,
    qualityThreshold: 6.0,
    autoApprove: true,
    humanReviewRequired: false,
    usePremiumProviders: false,
    parallelGeneration: true,
    cacheResults: true,
    iterationLimit: 1,
  },
};

// Expected metrics per route and content type
const ROUTE_METRICS: Record<RouteType, Record<string, { quality: number; costUsd: number; timeMinutes: number }>> = {
  quality_max: {
    video: { quality: 9.2, costUsd: 15.00, timeMinutes: 45 },
    blog: { quality: 9.0, costUsd: 2.50, timeMinutes: 20 },
    social: { quality: 8.8, costUsd: 0.80, timeMinutes: 10 },
    ad_copy: { quality: 9.1, costUsd: 1.20, timeMinutes: 15 },
    image: { quality: 9.3, costUsd: 3.00, timeMinutes: 8 },
  },
  balanced: {
    video: { quality: 7.8, costUsd: 8.00, timeMinutes: 25 },
    blog: { quality: 7.5, costUsd: 1.50, timeMinutes: 12 },
    social: { quality: 7.3, costUsd: 0.40, timeMinutes: 5 },
    ad_copy: { quality: 7.6, costUsd: 0.70, timeMinutes: 8 },
    image: { quality: 8.0, costUsd: 1.50, timeMinutes: 5 },
  },
  efficiency_max: {
    video: { quality: 6.5, costUsd: 4.00, timeMinutes: 12 },
    blog: { quality: 6.2, costUsd: 0.50, timeMinutes: 5 },
    social: { quality: 6.0, costUsd: 0.15, timeMinutes: 2 },
    ad_copy: { quality: 6.3, costUsd: 0.25, timeMinutes: 3 },
    image: { quality: 6.8, costUsd: 0.75, timeMinutes: 3 },
  },
};

// Tier-based routing preferences
const TIER_PREFERENCES: Record<ClientTier, { defaultRoute: RouteType; allowQualityMax: boolean }> = {
  enterprise: { defaultRoute: 'quality_max', allowQualityMax: true },
  premium: { defaultRoute: 'balanced', allowQualityMax: true },
  standard: { defaultRoute: 'balanced', allowQualityMax: false },
  starter: { defaultRoute: 'efficiency_max', allowQualityMax: false },
};

// Priority-based routing overrides
const PRIORITY_OVERRIDES: Record<ContentPriority, RouteType | null> = {
  critical: 'quality_max',
  high: 'balanced',
  standard: null, // Use tier default
  bulk: 'efficiency_max',
};

/**
 * Determines the optimal route based on context
 */
export function determineRoute(context: RoutingContext): RouteDecision {
  const tierPref = TIER_PREFERENCES[context.clientTier];
  const priorityOverride = PRIORITY_OVERRIDES[context.contentPriority];
  
  let selectedRoute: RouteType;
  let reason: string;
  
  // Priority overrides tier preferences
  if (priorityOverride) {
    // But check if tier allows quality_max
    if (priorityOverride === 'quality_max' && !tierPref.allowQualityMax) {
      selectedRoute = 'balanced';
      reason = `Priority requested quality_max but tier ${context.clientTier} upgraded to balanced`;
    } else {
      selectedRoute = priorityOverride;
      reason = `Content priority (${context.contentPriority}) dictates ${selectedRoute} route`;
    }
  } else {
    selectedRoute = tierPref.defaultRoute;
    reason = `Using tier default (${context.clientTier}) for standard priority`;
  }
  
  // Budget constraints
  if (context.budget === 'minimal' && selectedRoute !== 'efficiency_max') {
    selectedRoute = 'efficiency_max';
    reason = `Budget constraint (minimal) forces efficiency_max route`;
  }
  
  // Deadline pressure
  if (context.deadline) {
    const hoursUntilDeadline = (context.deadline.getTime() - Date.now()) / (1000 * 60 * 60);
    const expectedTime = ROUTE_METRICS[selectedRoute][context.contentType]?.timeMinutes || 30;
    
    if (hoursUntilDeadline < expectedTime / 60 * 1.5) {
      if (selectedRoute === 'quality_max') {
        selectedRoute = 'balanced';
        reason = `Deadline pressure: downgraded from quality_max to meet deadline`;
      }
    }
  }
  
  // First content for client - boost quality
  if (context.isFirstContent && selectedRoute === 'efficiency_max') {
    selectedRoute = 'balanced';
    reason = `First content for client: upgraded to balanced for good first impression`;
  }
  
  // Poor previous quality - boost this one
  if (context.previousQualityScore && context.previousQualityScore < 6.5) {
    if (selectedRoute === 'efficiency_max' && tierPref.allowQualityMax) {
      selectedRoute = 'balanced';
      reason = `Previous content scored low (${context.previousQualityScore}): upgraded to recover quality`;
    }
  }
  
  // Batch size affects routing
  if (context.batchSize && context.batchSize > 10) {
    if (selectedRoute === 'quality_max') {
      selectedRoute = 'balanced';
      reason = `Large batch size (${context.batchSize}): using balanced for efficiency`;
    }
  }
  
  const config = { ...ROUTE_CONFIGS[selectedRoute] };
  const metrics = ROUTE_METRICS[selectedRoute][context.contentType] || ROUTE_METRICS[selectedRoute].blog;
  
  // Adjust metrics for batch
  const batchMultiplier = context.batchSize ? Math.max(1, context.batchSize * 0.8) : 1;
  
  return {
    route: selectedRoute,
    reason,
    config,
    expectedQuality: metrics.quality,
    expectedCostUsd: metrics.costUsd * batchMultiplier,
    expectedTimeMinutes: metrics.timeMinutes * (context.batchSize ? Math.ceil(context.batchSize / 3) : 1),
    reviewCheckpoints: buildReviewCheckpoints(selectedRoute, context.contentType),
  };
}

/**
 * Builds review checkpoints based on route
 */
function buildReviewCheckpoints(route: RouteType, contentType: string): ReviewCheckpoint[] {
  const checkpoints: ReviewCheckpoint[] = [];
  
  if (route === 'quality_max') {
    checkpoints.push({
      stage: 'generation',
      type: 'auto',
      description: 'Initial generation quality check',
    });
    checkpoints.push({
      stage: 'brand_check',
      type: 'auto',
      description: 'Brand consistency validation',
    });
    checkpoints.push({
      stage: 'qa',
      type: 'human',
      description: 'Quality assurance review',
    });
    checkpoints.push({
      stage: 'final',
      type: 'human',
      description: 'Final approval before publishing',
    });
  } else if (route === 'balanced') {
    checkpoints.push({
      stage: 'generation',
      type: 'auto',
      description: 'Generation quality threshold check',
    });
    checkpoints.push({
      stage: 'brand_check',
      type: 'auto',
      description: 'Automated brand consistency check',
    });
    checkpoints.push({
      stage: 'qa',
      type: 'auto',
      description: 'Automated QA scoring',
    });
  } else {
    // efficiency_max
    checkpoints.push({
      stage: 'generation',
      type: 'auto',
      description: 'Basic quality threshold only',
    });
  }
  
  return checkpoints;
}

/**
 * Evaluates if a decision was correct after completion
 */
export function evaluateRouteDecision(
  decision: RouteDecision,
  actualQuality: number,
  actualCostUsd: number,
  actualTimeMinutes: number
): { wasCorrect: boolean; analysis: string; recommendation: RouteType } {
  const qualityDelta = actualQuality - decision.expectedQuality;
  const costDelta = actualCostUsd - decision.expectedCostUsd;
  const timeDelta = actualTimeMinutes - decision.expectedTimeMinutes;
  
  let wasCorrect = true;
  const issues: string[] = [];
  
  // Quality fell significantly short
  if (qualityDelta < -1.0) {
    wasCorrect = false;
    issues.push(`Quality ${actualQuality.toFixed(1)} was below expected ${decision.expectedQuality.toFixed(1)}`);
  }
  
  // Cost significantly exceeded
  if (costDelta > decision.expectedCostUsd * 0.5) {
    wasCorrect = false;
    issues.push(`Cost $${actualCostUsd.toFixed(2)} exceeded expected $${decision.expectedCostUsd.toFixed(2)} by >50%`);
  }
  
  // Time significantly exceeded
  if (timeDelta > decision.expectedTimeMinutes * 0.5) {
    issues.push(`Time ${actualTimeMinutes}min exceeded expected ${decision.expectedTimeMinutes}min`);
  }
  
  let recommendation = decision.route;
  
  if (!wasCorrect) {
    // Suggest upgrade if quality was the issue
    if (qualityDelta < -1.0 && decision.route !== 'quality_max') {
      recommendation = decision.route === 'efficiency_max' ? 'balanced' : 'quality_max';
    }
    // Suggest downgrade if cost was the issue
    if (costDelta > decision.expectedCostUsd && actualQuality >= 7.0) {
      recommendation = decision.route === 'quality_max' ? 'balanced' : 'efficiency_max';
    }
  }
  
  return {
    wasCorrect,
    analysis: issues.length > 0 ? issues.join('; ') : 'Route decision performed as expected',
    recommendation,
  };
}

/**
 * Gets provider recommendations based on route
 */
export function getProviderRecommendations(route: RouteType, contentType: string): {
  primary: string;
  fallback: string;
  reason: string;
} {
  const providers: Record<RouteType, Record<string, { primary: string; fallback: string }>> = {
    quality_max: {
      video: { primary: 'veo3', fallback: 'runway_gen4_aleph' },
      image: { primary: 'midjourney', fallback: 'fal_flux_pro' },
      blog: { primary: 'claude_sonnet', fallback: 'gpt4' },
      social: { primary: 'claude_sonnet', fallback: 'gpt4' },
      ad_copy: { primary: 'claude_sonnet', fallback: 'gpt4' },
    },
    balanced: {
      video: { primary: 'runway_gen4_turbo', fallback: 'gemini_veo' },
      image: { primary: 'fal_flux_pro', fallback: 'dalle3' },
      blog: { primary: 'claude_haiku', fallback: 'deepseek' },
      social: { primary: 'claude_haiku', fallback: 'llama4' },
      ad_copy: { primary: 'claude_haiku', fallback: 'mistral' },
    },
    efficiency_max: {
      video: { primary: 'runway_gen3_turbo', fallback: 'gemini_veo' },
      image: { primary: 'dalle3', fallback: 'nano_banana' },
      blog: { primary: 'deepseek', fallback: 'llama4' },
      social: { primary: 'llama4', fallback: 'mistral' },
      ad_copy: { primary: 'deepseek', fallback: 'qwen3' },
    },
  };
  
  const providerSet = providers[route][contentType] || providers[route].blog;
  
  return {
    ...providerSet,
    reason: route === 'quality_max' 
      ? 'Premium providers for maximum quality output'
      : route === 'balanced'
        ? 'Cost-effective providers with good quality'
        : 'Fast, low-cost providers for bulk generation',
  };
}

/**
 * Calculates batch routing strategy
 */
export function calculateBatchStrategy(
  contexts: RoutingContext[],
  globalBudget?: number
): {
  batches: { route: RouteType; items: number[] }[];
  totalCost: number;
  totalTime: number;
} {
  const decisions = contexts.map((ctx, idx) => ({
    idx,
    decision: determineRoute(ctx),
  }));
  
  // Group by route
  const grouped: Record<RouteType, number[]> = {
    quality_max: [],
    balanced: [],
    efficiency_max: [],
  };
  
  let totalCost = 0;
  let maxTime = 0;
  
  decisions.forEach(({ idx, decision }) => {
    grouped[decision.route].push(idx);
    totalCost += decision.expectedCostUsd;
    maxTime = Math.max(maxTime, decision.expectedTimeMinutes);
  });
  
  // If over budget, downgrade routes
  if (globalBudget && totalCost > globalBudget) {
    // Move quality_max to balanced
    while (totalCost > globalBudget && grouped.quality_max.length > 0) {
      const idx = grouped.quality_max.pop()!;
      grouped.balanced.push(idx);
      totalCost -= (ROUTE_METRICS.quality_max.blog.costUsd - ROUTE_METRICS.balanced.blog.costUsd);
    }
    // Move balanced to efficiency_max
    while (totalCost > globalBudget && grouped.balanced.length > 0) {
      const idx = grouped.balanced.pop()!;
      grouped.efficiency_max.push(idx);
      totalCost -= (ROUTE_METRICS.balanced.blog.costUsd - ROUTE_METRICS.efficiency_max.blog.costUsd);
    }
  }
  
  const batches: { route: RouteType; items: number[] }[] = [];
  
  if (grouped.quality_max.length > 0) {
    batches.push({ route: 'quality_max', items: grouped.quality_max });
  }
  if (grouped.balanced.length > 0) {
    batches.push({ route: 'balanced', items: grouped.balanced });
  }
  if (grouped.efficiency_max.length > 0) {
    batches.push({ route: 'efficiency_max', items: grouped.efficiency_max });
  }
  
  return {
    batches,
    totalCost,
    totalTime: maxTime + (batches.length - 1) * 5, // 5min overhead per batch switch
  };
}

/**
 * Learning-aware route determination
 * Fetches learning signals from the database to adjust routing decisions
 * Persists adjustments for feedback loop completion
 */
export async function determineRouteWithLearning(
  context: RoutingContext
): Promise<RouteDecision> {
  // Get base decision from static heuristics
  const baseDecision = determineRoute(context);
  
  // Fetch relevant learning signals
  const signals = await fetchLearningSignals(context.clientId, context.contentType);
  
  // Get historical performance for this client/content type
  const historicalPerformance = await getHistoricalPerformance(
    context.clientId, 
    context.contentType
  );
  
  // Track all learning adjustments with signal references
  const learningAdjustments: LearningAdjustment[] = [];
  let adjustedRoute = baseDecision.route;
  let adjustmentReasons: string[] = [];
  
  // Check for failure patterns - emit signals even on first high-severity occurrence
  const failureSignals = signals.filter(s => s.signalType === 'failure_pattern');
  const highSeverityFailures = failureSignals.filter(
    s => s.confidence && parseFloat(s.confidence) >= 0.8
  );
  
  if (failureSignals.length > 2 || highSeverityFailures.length > 0) {
    // Multiple failure patterns or single high-severity - upgrade route for better quality
    if (adjustedRoute === 'efficiency_max') {
      const originalRoute = adjustedRoute;
      adjustedRoute = 'balanced';
      adjustmentReasons.push(`Upgraded due to ${failureSignals.length} failure patterns`);
      
      // Record adjustments with signal IDs
      failureSignals.forEach(s => {
        learningAdjustments.push({
          signalId: s.id,
          signalType: s.signalType,
          adjustmentType: 'route_upgrade',
          originalValue: originalRoute,
          adjustedValue: adjustedRoute,
          confidence: parseFloat(s.confidence || '0'),
        });
      });
    }
  }
  
  // Check for success patterns
  const successSignals = signals.filter(s => s.signalType === 'success_pattern');
  if (successSignals.length >= 3 && historicalPerformance.avgQuality > 8.0) {
    // Consistent high quality - can potentially downgrade to save costs
    if (adjustedRoute === 'quality_max' && context.contentPriority !== 'critical') {
      const originalRoute = adjustedRoute;
      adjustedRoute = 'balanced';
      adjustmentReasons.push('Learning: consistent high quality allows cost optimization');
      
      successSignals.forEach(s => {
        learningAdjustments.push({
          signalId: s.id,
          signalType: s.signalType,
          adjustmentType: 'route_downgrade',
          originalValue: originalRoute,
          adjustedValue: adjustedRoute,
          confidence: parseFloat(s.confidence || '0'),
        });
      });
    }
  }
  
  // Check historical performance
  if (historicalPerformance.avgQuality < 6.0 && historicalPerformance.sampleSize >= 3) {
    // Poor historical quality - upgrade route
    if (adjustedRoute !== 'quality_max' && TIER_PREFERENCES[context.clientTier].allowQualityMax) {
      const originalRoute = adjustedRoute;
      adjustedRoute = adjustedRoute === 'efficiency_max' ? 'balanced' : 'quality_max';
      adjustmentReasons.push(`Historical quality (${historicalPerformance.avgQuality.toFixed(1)}) below threshold`);
      
      learningAdjustments.push({
        signalId: 0, // Historical performance, not a specific signal
        signalType: 'historical_performance',
        adjustmentType: 'quality_boost',
        originalValue: originalRoute,
        adjustedValue: adjustedRoute,
        confidence: Math.min(0.9, historicalPerformance.sampleSize / 10),
      });
    }
  }
  
  // Check provider-specific signals
  const providerFailures = signals.filter(
    s => s.signalType === 'failure_pattern' && 
    s.pattern.includes(baseDecision.config.usePremiumProviders ? 'veo3' : 'runway')
  );
  if (providerFailures.length > 0) {
    adjustmentReasons.push('Provider-specific issues detected; may use fallback');
    
    providerFailures.forEach(s => {
      learningAdjustments.push({
        signalId: s.id,
        signalType: s.signalType,
        adjustmentType: 'provider_override',
        originalValue: 'primary',
        adjustedValue: 'fallback',
        confidence: parseFloat(s.confidence || '0'),
      });
    });
  }
  
  // Return adjusted decision with learning adjustments attached
  if (adjustedRoute !== baseDecision.route || learningAdjustments.length > 0) {
    const config = { ...ROUTE_CONFIGS[adjustedRoute] };
    const metrics = ROUTE_METRICS[adjustedRoute][context.contentType] || ROUTE_METRICS[adjustedRoute].blog;
    
    return {
      route: adjustedRoute,
      reason: adjustmentReasons.length > 0 
        ? `${baseDecision.reason} [Learning adjustments: ${adjustmentReasons.join('; ')}]`
        : baseDecision.reason,
      config,
      expectedQuality: metrics.quality,
      expectedCostUsd: metrics.costUsd,
      expectedTimeMinutes: metrics.timeMinutes,
      reviewCheckpoints: buildReviewCheckpoints(adjustedRoute, context.contentType),
      learningAdjustments: learningAdjustments.length > 0 ? learningAdjustments : undefined,
    };
  }
  
  return baseDecision;
}

/**
 * Fetches relevant learning signals for a client/content type
 */
async function fetchLearningSignals(
  clientId: number,
  contentType: string
): Promise<Array<typeof learningSignals.$inferSelect>> {
  // Fetch signals from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const signals = await db.query.learningSignals.findMany({
    where: and(
      eq(learningSignals.category, contentType),
      gte(learningSignals.createdAt, thirtyDaysAgo),
      eq(learningSignals.isActionable, true)
    ),
    orderBy: [desc(learningSignals.confidence)],
    limit: 20,
  });
  
  // Also get client-specific signals
  const clientSignals = await db.query.learningSignals.findMany({
    where: and(
      eq(learningSignals.clientId, clientId),
      gte(learningSignals.createdAt, thirtyDaysAgo),
      eq(learningSignals.isActionable, true)
    ),
    orderBy: [desc(learningSignals.confidence)],
    limit: 10,
  });
  
  // Combine and deduplicate
  const allSignals = [...signals, ...clientSignals];
  const seen = new Set<number>();
  return allSignals.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

/**
 * Gets historical performance metrics for a client/content type
 */
async function getHistoricalPerformance(
  clientId: number,
  contentType: string
): Promise<{ avgQuality: number; sampleSize: number; avgCost: number }> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const result = await db
    .select({
      avgQuality: sql<string>`COALESCE(AVG(CAST(${generationRuns.qualityScore} AS DECIMAL)), 0)`,
      sampleSize: sql<number>`COUNT(*)`,
      avgCost: sql<string>`COALESCE(AVG(CAST(${generationRuns.costUsd} AS DECIMAL)), 0)`,
    })
    .from(generationRuns)
    .where(
      and(
        eq(generationRuns.clientId, clientId),
        eq(generationRuns.contentType, contentType),
        eq(generationRuns.status, 'completed'),
        gte(generationRuns.createdAt, thirtyDaysAgo)
      )
    );
  
  return {
    avgQuality: parseFloat(result[0]?.avgQuality || '0'),
    sampleSize: result[0]?.sampleSize || 0,
    avgCost: parseFloat(result[0]?.avgCost || '0'),
  };
}

/**
 * Records a route decision outcome for learning with signal attribution
 */
export async function recordRouteDecision(data: {
  generationRunId: number;
  clientId: number;
  contentType: string;
  selectedRoute: RouteType;
  routeReason: string;
  factors: Record<string, unknown>;
  expectedQuality: number;
  expectedCost: number;
  expectedTimeMs: number;
  learningAdjustments?: LearningAdjustment[];
}): Promise<number> {
  const [result] = await db.insert(routeDecisions).values({
    generationRunId: data.generationRunId,
    clientId: data.clientId,
    contentType: data.contentType,
    selectedRoute: data.selectedRoute,
    routeReason: data.routeReason,
    factors: data.factors,
    learningAdjustments: data.learningAdjustments as any, // Persist learning adjustments for attribution
    expectedQuality: data.expectedQuality.toString(),
    expectedCost: data.expectedCost.toString(),
    expectedTimeMs: data.expectedTimeMs,
  }).returning({ id: routeDecisions.id });
  
  return result.id;
}

/**
 * Updates a route decision with actual outcome
 */
export async function updateRouteDecisionOutcome(
  decisionId: number,
  outcome: {
    quality: number;
    cost: number;
    timeMs: number;
    wasCorrect: boolean;
  }
): Promise<void> {
  await db.update(routeDecisions)
    .set({
      actualQuality: outcome.quality.toString(),
      actualCost: outcome.cost.toString(),
      actualTimeMs: outcome.timeMs,
      wasCorrectDecision: outcome.wasCorrect,
      completedAt: new Date(),
    })
    .where(eq(routeDecisions.id, decisionId));
}

export default {
  determineRoute,
  determineRouteWithLearning,
  evaluateRouteDecision,
  getProviderRecommendations,
  calculateBatchStrategy,
  recordRouteDecision,
  updateRouteDecisionOutcome,
  ROUTE_CONFIGS,
  ROUTE_METRICS,
};
