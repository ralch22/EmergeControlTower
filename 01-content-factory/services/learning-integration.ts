/**
 * Learning Integration Service
 * 
 * Connects the Central Learning Engine with the Content Factory pipeline.
 * Ensures all content generation benefits from accumulated brand intelligence,
 * prompt patterns, and quality insights.
 */

import crypto from 'crypto';
import type { EnrichedClientBrief } from './brand-brief';

function generateUuid(): string {
  return crypto.randomUUID();
}
import { 
  recordGenerationRun, 
  completeGenerationRun, 
  submitFeedback,
  updateRouteDecisionOutcome,
  getBestPromptTemplates,
  getBrandPatterns,
} from './central-learning-engine';
import { 
  injectBrandIntelligence, 
  createBrandSignature,
  validateBrandAlignment,
} from './brand-aware-prompt-engine';
import { 
  determineRoute,
  determineRouteWithLearning,
  evaluateRouteDecision,
  getProviderRecommendations,
  recordRouteDecision,
  type RoutingContext,
  type RouteDecision,
  type LearningAdjustment,
} from './dual-path-router';
import { buildEnrichedBrief } from './brand-intelligence-service';

export interface ContentGenerationRequest {
  clientId: number;
  contentType: 'video' | 'blog' | 'social' | 'ad_copy' | 'image';
  prompt: string;
  priority?: 'critical' | 'high' | 'standard' | 'bulk';
  format?: string;
  targetPlatform?: string;
  deadline?: Date;
  batchSize?: number;
}

export interface ContentGenerationResult {
  runId: string;
  route: RouteDecision;
  enhancedPrompt: string;
  brandSignature: string;
  provider: string;
  model: string;
  decisionId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  outputUrl?: string;
  qualityScore?: number;
  brandScore?: number;
  processingTimeMs?: number;
  costUsd?: number;
  metadata?: Record<string, unknown>;
}

export interface LearningContext {
  brandPatterns: Array<{
    patternType: string;
    patternName: string;
    patternData: Record<string, unknown>;
    confidence: number;
  }>;
  promptTemplates: Array<{
    id: number;
    name: string;
    template: string;
    avgQualityScore: number;
    successRate: number;
  }>;
  previousQualityScore?: number;
}

/**
 * Prepares content generation with full learning integration
 */
export async function prepareContentGeneration(
  request: ContentGenerationRequest
): Promise<ContentGenerationResult> {
  const runId = generateUuid();
  
  // 1. Build enriched brand brief
  const brandBrief = await buildEnrichedBrief(request.clientId);
  
  // 2. Get learning context
  const learningContext = await getLearningContext(request.clientId, request.contentType);
  
  // 3. Determine optimal route using learning-aware router
  const routingContext: RoutingContext = {
    clientId: request.clientId,
    clientTier: getClientTier(brandBrief),
    contentType: request.contentType,
    contentPriority: request.priority || 'standard',
    deadline: request.deadline,
    previousQualityScore: learningContext.previousQualityScore,
    batchSize: request.batchSize,
  };
  
  // Use learning-aware routing to benefit from accumulated feedback
  const route = await determineRouteWithLearning(routingContext);
  
  // 4. Get provider recommendations
  const providers = getProviderRecommendations(route.route, request.contentType);
  
  // 5. Inject brand intelligence into prompt
  const enhanced = injectBrandIntelligence(request.prompt, brandBrief, {
    contentType: request.contentType,
    format: request.format,
    targetPlatform: request.targetPlatform,
  });
  
  // 6. Create brand signature
  const brandSignature = createBrandSignature(brandBrief);
  
  // 7. Record generation run
  const dbRunId = await recordGenerationRun({
    runId,
    clientId: request.clientId,
    contentType: request.contentType,
    route: route.route,
    inputPrompt: request.prompt,
    finalPrompt: enhanced.brandEnhancedPrompt,
    provider: providers.primary,
    model: getModelForProvider(providers.primary, request.contentType),
    brandElements: enhanced.brandInjection as unknown as Record<string, unknown>,
  });
  
  // 8. Record route decision with learning adjustments for attribution
  const decisionId = await recordRouteDecision({
    generationRunId: dbRunId,
    clientId: request.clientId,
    contentType: request.contentType,
    selectedRoute: route.route,
    routeReason: route.reason,
    factors: {
      clientTier: routingContext.clientTier,
      budget: 'standard',
      deadline: !!request.deadline,
      contentPriority: request.priority || 'standard',
      previousQuality: learningContext.previousQualityScore || 0,
    },
    expectedQuality: route.expectedQuality,
    expectedCost: route.expectedCostUsd,
    expectedTimeMs: route.expectedTimeMinutes,
    learningAdjustments: route.learningAdjustments, // Persist for feedback loop
  });
  
  return {
    runId,
    route,
    enhancedPrompt: enhanced.brandEnhancedPrompt,
    brandSignature,
    provider: providers.primary,
    model: getModelForProvider(providers.primary, request.contentType),
    decisionId,
    status: 'pending',
    metadata: {
      injectedElements: enhanced.metadata.injectedElements,
      brandArchetype: enhanced.metadata.brandArchetype,
      routeConfig: route.config,
    },
  };
}

/**
 * Completes generation and records outcomes
 */
export async function completeContentGeneration(
  result: ContentGenerationResult,
  outcome: {
    success: boolean;
    outputUrl?: string;
    qualityScore?: number;
    processingTimeMs?: number;
    costUsd?: number;
    error?: string;
  }
): Promise<void> {
  // Update generation run
  await completeGenerationRun(result.runId, {
    status: outcome.success ? 'completed' : 'failed',
    outputUrl: outcome.outputUrl,
    qualityScore: outcome.qualityScore,
    processingTimeMs: outcome.processingTimeMs,
    costUsd: outcome.costUsd,
    metadata: outcome.error ? { error: outcome.error } : undefined,
  });
  
  // Evaluate route decision
  if (outcome.success && outcome.qualityScore !== undefined) {
    const evaluation = evaluateRouteDecision(
      result.route,
      outcome.qualityScore,
      outcome.costUsd || 0,
      (outcome.processingTimeMs || 0) / 60000
    );
    
    await updateRouteDecisionOutcome(result.decisionId, {
      quality: outcome.qualityScore,
      cost: outcome.costUsd || 0,
      timeMs: outcome.processingTimeMs || 0,
      wasCorrect: evaluation.wasCorrect,
    });
  }
}

/**
 * Submits quality feedback for a generation run
 */
export async function submitQualityFeedback(
  runId: string,
  feedback: {
    type: 'qa_review' | 'user_rating' | 'auto_metric';
    source: string;
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
): Promise<void> {
  // Get generation run ID from runId string
  const { db } = await import('../../server/db');
  const { generationRuns } = await import('../../shared/schema');
  const { eq } = await import('drizzle-orm');
  
  const run = await db.query.generationRuns.findFirst({
    where: eq(generationRuns.runId, runId),
  });
  
  if (!run) {
    throw new Error(`Generation run ${runId} not found`);
  }
  
  await submitFeedback({
    generationRunId: run.id,
    type: feedback.type,
    source: feedback.source as any,
    scores: feedback.scores,
    feedback: feedback.feedback,
    issues: feedback.issues,
    suggestions: feedback.suggestions,
    isApproved: feedback.isApproved,
    reviewedBy: feedback.reviewedBy,
  });
}

/**
 * Validates generated content against brand guidelines
 */
export async function validateGeneratedContent(
  clientId: number,
  content: string,
  contentType: 'video' | 'blog' | 'social' | 'ad_copy' | 'image'
): Promise<{
  aligned: boolean;
  issues: string[];
  score: number;
}> {
  const brandBrief = await buildEnrichedBrief(clientId);
  return validateBrandAlignment(content, brandBrief);
}

/**
 * Gets learning context for a client/content type
 */
async function getLearningContext(
  clientId: number,
  contentType: string
): Promise<LearningContext> {
  const [patterns, templates] = await Promise.all([
    getBrandPatterns(clientId),
    getBestPromptTemplates(contentType),
  ]);
  
  // Get previous quality score from recent runs
  const { db } = await import('../../server/db');
  const { generationRuns } = await import('../../shared/schema');
  const { eq, and, desc } = await import('drizzle-orm');
  
  const recentRun = await db.query.generationRuns.findFirst({
    where: and(
      eq(generationRuns.clientId, clientId),
      eq(generationRuns.contentType, contentType),
      eq(generationRuns.status, 'completed')
    ),
    orderBy: [desc(generationRuns.createdAt)],
  });
  
  return {
    brandPatterns: patterns.map(p => ({
      patternType: p.patternType,
      patternName: p.patternName,
      patternData: p.patternData as Record<string, unknown>,
      confidence: parseFloat(p.confidence),
    })),
    promptTemplates: templates.map(t => ({
      id: t.id,
      name: t.name,
      template: t.template,
      avgQualityScore: t.avgQualityScore ? parseFloat(t.avgQualityScore) : 0,
      successRate: t.successRate ? parseFloat(t.successRate) : 0,
    })),
    previousQualityScore: recentRun?.qualityScore 
      ? parseFloat(recentRun.qualityScore)
      : undefined,
  };
}

/**
 * Determines client tier from brand brief
 */
function getClientTier(brandBrief: EnrichedClientBrief): 'enterprise' | 'premium' | 'standard' | 'starter' {
  // For now, determine based on profile completeness
  if (brandBrief.hasFullProfile) {
    if (brandBrief.visual.referenceAssets.length > 3) {
      return 'enterprise';
    }
    return 'premium';
  }
  return 'standard';
}

/**
 * Maps provider to model name
 */
function getModelForProvider(provider: string, contentType: string): string {
  const providerModels: Record<string, Record<string, string>> = {
    veo3: { video: 'veo-3.1-flash', image: 'veo-3.1-flash' },
    runway_gen4_aleph: { video: 'gen4_aleph', image: 'gen4_image' },
    runway_gen4_turbo: { video: 'gen4_turbo', image: 'gen4_image' },
    runway_gen3_turbo: { video: 'gen3_turbo', image: 'gen3_turbo' },
    midjourney: { image: 'v6' },
    fal_flux_pro: { image: 'flux-pro' },
    dalle3: { image: 'dall-e-3' },
    nano_banana: { image: 'nano-banana-pro' },
    claude_sonnet: { blog: 'claude-sonnet-4-20250514', social: 'claude-sonnet-4-20250514', ad_copy: 'claude-sonnet-4-20250514' },
    claude_haiku: { blog: 'claude-3-5-haiku-20241022', social: 'claude-3-5-haiku-20241022', ad_copy: 'claude-3-5-haiku-20241022' },
    gpt4: { blog: 'gpt-4o', social: 'gpt-4o', ad_copy: 'gpt-4o' },
    deepseek: { blog: 'deepseek-r1', social: 'deepseek-r1', ad_copy: 'deepseek-r1' },
    llama4: { blog: 'llama-4-maverick', social: 'llama-4-maverick', ad_copy: 'llama-4-maverick' },
    mistral: { blog: 'mistral-large', social: 'mistral-large', ad_copy: 'mistral-large' },
    qwen3: { blog: 'qwen-3-235b', social: 'qwen-3-235b', ad_copy: 'qwen-3-235b' },
  };
  
  return providerModels[provider]?.[contentType] || 'default';
}

export default {
  prepareContentGeneration,
  completeContentGeneration,
  submitQualityFeedback,
  validateGeneratedContent,
};
