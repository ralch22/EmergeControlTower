/**
 * Central Learning Engine
 * 
 * Collects feedback from all sources (QA, users, automated metrics),
 * identifies patterns, and provides insights to improve future generation.
 * The brain of the self-learning content generation system.
 */

import { db } from '../../server/db';
import { 
  generationRuns, 
  qualityFeedback, 
  learningSignals, 
  promptEffectiveness,
  promptTemplates,
  brandLearningPatterns,
  routeDecisions,
  type InsertQualityFeedback,
  type InsertLearningSignal,
  type InsertGenerationRun,
} from '../../shared/schema';
import { eq, desc, sql, and, gte, avg, count } from 'drizzle-orm';
import crypto from 'crypto';

// Feedback types
export type FeedbackType = 'qa_review' | 'user_rating' | 'auto_metric';
export type FeedbackSource = 'qa_agent' | 'user_ui' | 'brand_checker' | 'resolution_check' | 'engagement_tracker';

export interface FeedbackInput {
  generationRunId: number;
  type: FeedbackType;
  source: FeedbackSource;
  scores: {
    overall?: number;
    brandAlignment?: number;
    technicalQuality?: number;
    creativity?: number;
  };
  feedback?: string;
  issues?: string[];
  suggestions?: string[];
  isApproved?: boolean;
  reviewedBy?: string;
}

export interface PatternInsight {
  signalType: 'prompt_effectiveness' | 'brand_pattern' | 'failure_pattern' | 'success_pattern';
  category: string;
  pattern: string;
  confidence: number;
  impact: {
    qualityDelta: number;
    costDelta: number;
    speedDelta: number;
  };
  recommendation: string;
}

export interface LearningRecommendation {
  type: 'prompt_improvement' | 'route_adjustment' | 'provider_switch' | 'brand_update';
  priority: 'high' | 'medium' | 'low';
  description: string;
  affectedClients?: number[];
  affectedContentTypes?: string[];
  expectedImprovement: number;
}

/**
 * Records a new generation run for tracking
 */
export async function recordGenerationRun(data: {
  runId: string;
  clientId: number;
  contentType: string;
  route: string;
  inputPrompt: string;
  finalPrompt: string;
  provider: string;
  model: string;
  brandElements?: Record<string, unknown>;
  promptTemplateId?: number;
}): Promise<number> {
  const [result] = await db.insert(generationRuns).values({
    runId: data.runId,
    clientId: data.clientId,
    contentType: data.contentType,
    route: data.route,
    inputPrompt: data.inputPrompt,
    finalPrompt: data.finalPrompt,
    provider: data.provider,
    model: data.model,
    brandElements: data.brandElements,
    promptTemplateId: data.promptTemplateId,
    status: 'pending',
  }).returning({ id: generationRuns.id });
  
  return result.id;
}

/**
 * Updates a generation run with completion data
 */
export async function completeGenerationRun(
  runId: string,
  data: {
    status: 'completed' | 'failed';
    outputUrl?: string;
    qualityScore?: number;
    brandConsistencyScore?: number;
    processingTimeMs?: number;
    costUsd?: number;
    contentId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await db.update(generationRuns)
    .set({
      status: data.status,
      outputUrl: data.outputUrl,
      qualityScore: data.qualityScore?.toString(),
      brandConsistencyScore: data.brandConsistencyScore?.toString(),
      processingTimeMs: data.processingTimeMs,
      costUsd: data.costUsd?.toString(),
      contentId: data.contentId,
      metadata: data.metadata,
      completedAt: new Date(),
    })
    .where(eq(generationRuns.runId, runId));
}

/**
 * Submits feedback for a generation run
 */
export async function submitFeedback(input: FeedbackInput): Promise<number> {
  const [result] = await db.insert(qualityFeedback).values({
    generationRunId: input.generationRunId,
    feedbackType: input.type,
    source: input.source,
    overallScore: input.scores.overall?.toString(),
    brandAlignmentScore: input.scores.brandAlignment?.toString(),
    technicalQualityScore: input.scores.technicalQuality?.toString(),
    creativityScore: input.scores.creativity?.toString(),
    feedback: input.feedback,
    issues: input.issues,
    suggestions: input.suggestions,
    isApproved: input.isApproved,
    reviewedBy: input.reviewedBy,
  }).returning({ id: qualityFeedback.id });
  
  // Trigger learning signal analysis asynchronously
  setTimeout(() => analyzeFeedbackPatterns(input.generationRunId), 100);
  
  return result.id;
}

// High-severity issue keywords that trigger immediate signals
const HIGH_SEVERITY_KEYWORDS = [
  'provider_error', 'api_failure', 'timeout', 'crash', 'catastrophic',
  'data_loss', 'security', 'critical', 'outage', 'unavailable'
];

/**
 * Analyzes feedback patterns and creates learning signals
 * Now emits high-severity signals on first occurrence for critical issues
 */
async function analyzeFeedbackPatterns(generationRunId: number): Promise<void> {
  // Get the generation run with its feedback
  const run = await db.query.generationRuns.findFirst({
    where: eq(generationRuns.id, generationRunId),
  });
  
  if (!run) return;
  
  const feedback = await db.query.qualityFeedback.findMany({
    where: eq(qualityFeedback.generationRunId, generationRunId),
  });
  
  if (feedback.length === 0) return;
  
  // Calculate average scores
  const validScores = feedback.filter(f => f.overallScore);
  const avgOverall = validScores.length > 0
    ? validScores.reduce((sum, f) => sum + parseFloat(f.overallScore!), 0) / validScores.length
    : 0;
  
  // Identify patterns
  const allIssues = feedback.flatMap(f => f.issues || []);
  const issueCounts = new Map<string, number>();
  allIssues.forEach(issue => {
    issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
  });
  
  // Create learning signals for recurring issues OR high-severity single occurrences
  const issueEntries = Array.from(issueCounts.entries());
  for (let i = 0; i < issueEntries.length; i++) {
    const [issue, count] = issueEntries[i];
    const issueLower = issue.toLowerCase();
    
    // Check if this is a high-severity issue
    const isHighSeverity = HIGH_SEVERITY_KEYWORDS.some(keyword => 
      issueLower.includes(keyword)
    );
    
    // Create signal for recurring issues OR single high-severity issues
    if (count >= 2 || isHighSeverity) {
      const confidence = isHighSeverity 
        ? 0.9 // High confidence for critical issues
        : Math.min(0.9, count / feedback.length);
      
      await createLearningSignal({
        signalType: 'failure_pattern',
        category: run.contentType,
        pattern: issue,
        confidence: confidence,
        sampleSize: count,
        clientId: run.clientId,
        impact: {
          qualityDelta: isHighSeverity ? -3.0 : -1.0,
          costDelta: isHighSeverity ? 0.5 : 0.2,
          speedDelta: isHighSeverity ? 1.0 : 0.3,
        },
        recommendation: isHighSeverity
          ? `URGENT: Critical issue "${issue}" requires immediate attention for ${run.contentType}`
          : `Address recurring issue: "${issue}" for ${run.contentType} content`,
      });
    }
  }
  
  // Track prompt effectiveness
  await trackPromptEffectiveness(run, avgOverall);
  
  // Check for catastrophic failures (very low quality)
  if (avgOverall > 0 && avgOverall < 3.0) {
    await createLearningSignal({
      signalType: 'failure_pattern',
      category: run.contentType,
      pattern: `Catastrophic failure with ${run.provider}/${run.model} (score: ${avgOverall.toFixed(1)})`,
      confidence: 0.95,
      sampleSize: 1,
      clientId: run.clientId,
      impact: {
        qualityDelta: -5.0,
        costDelta: 1.0,
        speedDelta: 2.0,
      },
      recommendation: `Consider switching provider for ${run.contentType} content - ${run.provider}/${run.model} failing critically`,
    });
  }
  
  // Check for success patterns
  if (avgOverall >= 8.5) {
    await createLearningSignal({
      signalType: 'success_pattern',
      category: run.contentType,
      pattern: `High-quality ${run.contentType} with ${run.provider}/${run.model}`,
      confidence: 0.8,
      sampleSize: 1,
      clientId: run.clientId,
      impact: {
        qualityDelta: avgOverall - 7.0,
        costDelta: 0,
        speedDelta: 0,
      },
      recommendation: `Replicate successful pattern for ${run.contentType} content`,
    });
  }
  
  // Update route decision outcomes if available
  await updateRouteDecisionFromFeedback(generationRunId, avgOverall);
}

/**
 * Creates a learning signal in the database
 */
async function createLearningSignal(data: {
  signalType: string;
  category: string;
  pattern: string;
  confidence: number;
  sampleSize: number;
  clientId?: number;
  industryId?: string;
  brandArchetype?: string;
  impact: { qualityDelta: number; costDelta: number; speedDelta: number };
  recommendation: string;
}): Promise<void> {
  await db.insert(learningSignals).values({
    signalType: data.signalType,
    category: data.category,
    pattern: data.pattern,
    confidence: data.confidence.toString(),
    sampleSize: data.sampleSize,
    clientId: data.clientId,
    industryId: data.industryId,
    brandArchetype: data.brandArchetype,
    impact: data.impact,
    recommendation: data.recommendation,
    isActionable: true,
  });
}

/**
 * Tracks prompt effectiveness over time
 */
async function trackPromptEffectiveness(
  run: typeof generationRuns.$inferSelect,
  qualityScore: number
): Promise<void> {
  const promptHash = crypto
    .createHash('md5')
    .update(run.finalPrompt)
    .digest('hex');
  
  const promptSnippet = run.finalPrompt.substring(0, 500);
  
  // Check if prompt already tracked
  const existing = await db.query.promptEffectiveness.findFirst({
    where: eq(promptEffectiveness.promptHash, promptHash),
  });
  
  if (existing) {
    // Update existing record
    const newCount = existing.totalUses + 1;
    const newAvgQuality = existing.avgQualityScore
      ? (parseFloat(existing.avgQualityScore) * existing.totalUses + qualityScore) / newCount
      : qualityScore;
    
    await db.update(promptEffectiveness)
      .set({
        totalUses: newCount,
        avgQualityScore: newAvgQuality.toString(),
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(promptEffectiveness.id, existing.id));
  } else {
    // Create new record
    await db.insert(promptEffectiveness).values({
      promptHash,
      promptSnippet,
      category: run.contentType,
      clientId: run.clientId,
      totalUses: 1,
      avgQualityScore: qualityScore.toString(),
      lastUsedAt: new Date(),
    });
  }
}

/**
 * Gets learning recommendations for a client or globally
 */
export async function getLearningRecommendations(
  clientId?: number,
  limit: number = 10
): Promise<LearningRecommendation[]> {
  const signals = await db.query.learningSignals.findMany({
    where: clientId 
      ? eq(learningSignals.clientId, clientId)
      : undefined,
    orderBy: [desc(learningSignals.confidence), desc(learningSignals.createdAt)],
    limit,
  });
  
  return signals.map(signal => {
    let type: LearningRecommendation['type'] = 'prompt_improvement';
    let priority: LearningRecommendation['priority'] = 'medium';
    
    if (signal.signalType === 'failure_pattern') {
      type = 'prompt_improvement';
      priority = signal.sampleSize > 5 ? 'high' : 'medium';
    } else if (signal.pattern.includes('provider')) {
      type = 'provider_switch';
      priority = 'medium';
    } else if (signal.pattern.includes('route')) {
      type = 'route_adjustment';
      priority = 'low';
    }
    
    const impact = signal.impact as { qualityDelta: number } | null;
    
    return {
      type,
      priority,
      description: signal.recommendation || signal.pattern,
      affectedClients: signal.clientId ? [signal.clientId] : undefined,
      affectedContentTypes: [signal.category],
      expectedImprovement: impact?.qualityDelta || 0,
    };
  });
}

/**
 * Gets the best performing prompt templates for a context
 */
export async function getBestPromptTemplates(
  category: string,
  industry?: string,
  brandArchetype?: string,
  limit: number = 5
): Promise<typeof promptTemplates.$inferSelect[]> {
  let query = db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.category, category),
        eq(promptTemplates.isActive, true)
      )
    )
    .orderBy(desc(promptTemplates.avgQualityScore))
    .limit(limit);
  
  return await query;
}

/**
 * Gets brand-specific learning patterns
 */
export async function getBrandPatterns(clientId: number): Promise<typeof brandLearningPatterns.$inferSelect[]> {
  return await db.query.brandLearningPatterns.findMany({
    where: and(
      eq(brandLearningPatterns.clientId, clientId),
      eq(brandLearningPatterns.isActive, true)
    ),
    orderBy: [desc(brandLearningPatterns.confidence)],
  });
}

/**
 * Records a brand-specific learning pattern
 */
export async function recordBrandPattern(data: {
  clientId: number;
  patternType: string;
  patternName: string;
  patternData: Record<string, unknown>;
  confidence: number;
  sampleCount: number;
}): Promise<void> {
  // Check if pattern already exists
  const existing = await db.query.brandLearningPatterns.findFirst({
    where: and(
      eq(brandLearningPatterns.clientId, data.clientId),
      eq(brandLearningPatterns.patternType, data.patternType),
      eq(brandLearningPatterns.patternName, data.patternName)
    ),
  });
  
  if (existing) {
    // Update existing pattern
    const newSampleCount = existing.sampleCount + data.sampleCount;
    const newConfidence = (parseFloat(existing.confidence) * existing.sampleCount + data.confidence * data.sampleCount) / newSampleCount;
    
    await db.update(brandLearningPatterns)
      .set({
        patternData: { ...existing.patternData as object, ...data.patternData },
        confidence: newConfidence.toString(),
        sampleCount: newSampleCount,
        updatedAt: new Date(),
      })
      .where(eq(brandLearningPatterns.id, existing.id));
  } else {
    await db.insert(brandLearningPatterns).values({
      clientId: data.clientId,
      patternType: data.patternType,
      patternName: data.patternName,
      patternData: data.patternData,
      confidence: data.confidence.toString(),
      sampleCount: data.sampleCount,
    });
  }
}

/**
 * Gets aggregated statistics for the learning engine
 */
export async function getLearningStats(): Promise<{
  totalRuns: number;
  avgQuality: number;
  totalFeedback: number;
  activeSignals: number;
  topPerformingTemplates: number;
  brandPatterns: number;
}> {
  const [runsCount] = await db.select({ count: count() }).from(generationRuns);
  const [feedbackCount] = await db.select({ count: count() }).from(qualityFeedback);
  const [signalsCount] = await db.select({ count: count() }).from(learningSignals).where(eq(learningSignals.isActionable, true));
  const [templatesCount] = await db.select({ count: count() }).from(promptTemplates).where(eq(promptTemplates.isActive, true));
  const [patternsCount] = await db.select({ count: count() }).from(brandLearningPatterns).where(eq(brandLearningPatterns.isActive, true));
  
  const [avgQualityResult] = await db
    .select({ avg: avg(generationRuns.qualityScore) })
    .from(generationRuns)
    .where(eq(generationRuns.status, 'completed'));
  
  return {
    totalRuns: runsCount.count,
    avgQuality: parseFloat(avgQualityResult.avg || '0'),
    totalFeedback: feedbackCount.count,
    activeSignals: signalsCount.count,
    topPerformingTemplates: templatesCount.count,
    brandPatterns: patternsCount.count,
  };
}

/**
 * Applies a learning recommendation (marks it as applied)
 */
export async function applyLearningSignal(signalId: number): Promise<void> {
  await db.update(learningSignals)
    .set({
      appliedCount: sql`${learningSignals.appliedCount} + 1`,
      lastAppliedAt: new Date(),
    })
    .where(eq(learningSignals.id, signalId));
}

/**
 * Expires old learning signals
 */
export async function expireOldSignals(daysOld: number = 30): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const result = await db.update(learningSignals)
    .set({ isActionable: false })
    .where(
      and(
        eq(learningSignals.isActionable, true),
        sql`${learningSignals.createdAt} < ${cutoffDate}`
      )
    );
  
  return 0; // Note: drizzle doesn't return affected count easily
}

/**
 * Records a route decision for analysis
 */
export async function recordRouteDecision(data: {
  generationRunId: number;
  clientId: number;
  contentType: string;
  selectedRoute: string;
  routeReason: string;
  factors: {
    clientTier: string;
    budget: string;
    deadline: boolean;
    contentPriority: string;
    previousQuality: number;
  };
  expectedQuality: number;
  expectedCost: number;
  expectedTimeMs: number;
}): Promise<number> {
  const [result] = await db.insert(routeDecisions).values({
    generationRunId: data.generationRunId,
    clientId: data.clientId,
    contentType: data.contentType,
    selectedRoute: data.selectedRoute,
    routeReason: data.routeReason,
    factors: data.factors,
    expectedQuality: data.expectedQuality.toString(),
    expectedCost: data.expectedCost.toString(),
    expectedTimeMs: data.expectedTimeMs * 60 * 1000, // Convert minutes to ms
  }).returning({ id: routeDecisions.id });
  
  return result.id;
}

/**
 * Updates a route decision with actual results
 */
export async function updateRouteDecisionOutcome(
  decisionId: number,
  actuals: {
    quality: number;
    cost: number;
    timeMs: number;
    wasCorrect: boolean;
  }
): Promise<void> {
  await db.update(routeDecisions)
    .set({
      actualQuality: actuals.quality.toString(),
      actualCost: actuals.cost.toString(),
      actualTimeMs: actuals.timeMs,
      wasCorrectDecision: actuals.wasCorrect,
    })
    .where(eq(routeDecisions.id, decisionId));
}

/**
 * Updates route decision based on feedback - closes the learning loop
 */
async function updateRouteDecisionFromFeedback(
  generationRunId: number,
  avgQuality: number
): Promise<void> {
  // Find the route decision for this generation run
  const decision = await db.query.routeDecisions.findFirst({
    where: eq(routeDecisions.generationRunId, generationRunId),
  });
  
  if (!decision) return;
  
  // Get the generation run for timing/cost data
  const run = await db.query.generationRuns.findFirst({
    where: eq(generationRuns.id, generationRunId),
  });
  
  if (!run) return;
  
  // Calculate if the decision was correct
  const expectedQuality = parseFloat(decision.expectedQuality || '7');
  const expectedCost = parseFloat(decision.expectedCost || '1');
  const qualityMet = avgQuality >= expectedQuality * 0.9; // Within 10% of expected
  const costMet = run.costUsd 
    ? parseFloat(run.costUsd) <= expectedCost * 1.2 // Within 20% of expected
    : true;
  
  const wasCorrect = qualityMet && costMet;
  
  // Update the route decision
  await db.update(routeDecisions)
    .set({
      actualQuality: avgQuality.toString(),
      actualCost: run.costUsd || '0',
      actualTimeMs: run.processingTimeMs || 0,
      wasCorrectDecision: wasCorrect,
      completedAt: new Date(),
    })
    .where(eq(routeDecisions.id, decision.id));
  
  // If decision was incorrect, create a learning signal for routing improvement
  if (!wasCorrect) {
    const reason = !qualityMet 
      ? `Quality ${avgQuality.toFixed(1)} below expected ${expectedQuality.toFixed(1)}`
      : `Cost exceeded expected by ${((parseFloat(run.costUsd || '0') / expectedCost - 1) * 100).toFixed(0)}%`;
    
    await db.insert(learningSignals).values({
      signalType: 'route_adjustment',
      category: run.contentType,
      pattern: `Route ${decision.selectedRoute} underperformed for ${run.contentType}`,
      confidence: '0.75',
      sampleSize: 1,
      clientId: run.clientId,
      impact: {
        qualityDelta: avgQuality - expectedQuality,
        costDelta: parseFloat(run.costUsd || '0') - expectedCost,
        speedDelta: 0,
      },
      recommendation: reason,
      isActionable: true,
    });
  }
}

export default {
  recordGenerationRun,
  completeGenerationRun,
  submitFeedback,
  getLearningRecommendations,
  getBestPromptTemplates,
  getBrandPatterns,
  recordBrandPattern,
  getLearningStats,
  applyLearningSignal,
  expireOldSignals,
  recordRouteDecision,
  updateRouteDecisionOutcome,
};
