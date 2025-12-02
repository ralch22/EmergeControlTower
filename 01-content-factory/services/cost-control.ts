import { db } from "../../server/db";
import { apiCostTracking, costBudgets, generatedContent } from "../../shared/schema";
import { eq, and, sql, gte } from "drizzle-orm";

export interface CostEstimate {
  provider: string;
  operation: string;
  estimatedCostUsd: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  dailySpent: number;
  dailyLimit: number;
  remainingBudget: number;
  percentUsed: number;
}

export interface ApprovalCheckResult {
  allowed: boolean;
  reason?: string;
  contentStatus?: string;
}

const COST_ESTIMATES: Record<string, Record<string, number>> = {
  veo3: {
    video_generation: 10.00, // ~$10 per Veo 3 video (8s)
    video_generation_4s: 5.00,
    video_generation_8s: 10.00,
  },
  veo31: {
    video_generation: 10.00,
    video_generation_4s: 5.00,
    video_generation_8s: 10.00,
  },
  gemini: {
    text_generation: 0.001, // Very cheap
    image_generation: 0.05, // Gemini image gen
  },
  runway: {
    video_generation: 0.50, // Runway is cheaper than Veo
  },
  openai: {
    text_generation: 0.01,
    image_generation: 0.04,
  },
  anthropic: {
    text_generation: 0.015,
  },
  fal: {
    image_generation: 0.02,
  },
  alibaba: {
    image_generation: 0.01,
  },
};

const DEFAULT_DAILY_BUDGET_USD = 10.00;

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export async function getDailySpending(provider?: string): Promise<number> {
  const today = getTodayDate();
  
  const conditions = [eq(apiCostTracking.date, today)];
  if (provider) {
    conditions.push(eq(apiCostTracking.provider, provider));
  }
  
  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${apiCostTracking.costUsd}), 0)`,
    })
    .from(apiCostTracking)
    .where(and(...conditions));
  
  return parseFloat(result[0]?.total || '0');
}

interface BudgetInfo {
  limit: number;
  hasExplicitBudget: boolean;
}

export async function getDailyBudgetInfo(provider?: string): Promise<BudgetInfo> {
  const budgets = await db
    .select()
    .from(costBudgets)
    .where(
      and(
        eq(costBudgets.budgetType, 'daily'),
        eq(costBudgets.isActive, true),
        provider ? eq(costBudgets.provider, provider) : sql`${costBudgets.provider} IS NULL`
      )
    )
    .limit(1);
  
  if (budgets.length > 0) {
    return {
      limit: parseFloat(budgets[0].limitUsd),
      hasExplicitBudget: true,
    };
  }
  
  return {
    limit: DEFAULT_DAILY_BUDGET_USD,
    hasExplicitBudget: false,
  };
}

export async function getDailyBudget(provider?: string): Promise<number> {
  const info = await getDailyBudgetInfo(provider);
  return info.limit;
}

export async function checkBudget(
  provider: string,
  operation: string,
  estimatedCost?: number
): Promise<BudgetCheckResult> {
  const cost = estimatedCost ?? getEstimatedCost(provider, operation);
  
  const providerSpent = await getDailySpending(provider);
  const providerBudgetInfo = await getDailyBudgetInfo(provider);
  
  const globalSpent = await getDailySpending();
  const globalBudgetInfo = await getDailyBudgetInfo();
  
  if (providerBudgetInfo.hasExplicitBudget && providerSpent + cost > providerBudgetInfo.limit) {
    return {
      allowed: false,
      reason: `Provider budget exceeded for ${provider}. Spent: $${providerSpent.toFixed(2)} / $${providerBudgetInfo.limit.toFixed(2)}. This operation would cost ~$${cost.toFixed(2)}.`,
      dailySpent: providerSpent,
      dailyLimit: providerBudgetInfo.limit,
      remainingBudget: Math.max(0, providerBudgetInfo.limit - providerSpent),
      percentUsed: (providerSpent / providerBudgetInfo.limit) * 100,
    };
  }
  
  if (globalSpent + cost > globalBudgetInfo.limit) {
    return {
      allowed: false,
      reason: `Daily budget exceeded. Spent: $${globalSpent.toFixed(2)} / $${globalBudgetInfo.limit.toFixed(2)}. This operation would cost ~$${cost.toFixed(2)}.`,
      dailySpent: globalSpent,
      dailyLimit: globalBudgetInfo.limit,
      remainingBudget: Math.max(0, globalBudgetInfo.limit - globalSpent),
      percentUsed: (globalSpent / globalBudgetInfo.limit) * 100,
    };
  }
  
  return {
    allowed: true,
    dailySpent: globalSpent,
    dailyLimit: globalBudgetInfo.limit,
    remainingBudget: Math.max(0, globalBudgetInfo.limit - globalSpent),
    percentUsed: (globalSpent / globalBudgetInfo.limit) * 100,
  };
}

export async function checkContentApproval(contentId: string): Promise<ApprovalCheckResult> {
  const content = await db
    .select({ status: generatedContent.status })
    .from(generatedContent)
    .where(eq(generatedContent.contentId, contentId))
    .limit(1);
  
  if (content.length === 0) {
    return {
      allowed: true,
      reason: 'Content not found - allowing for new content generation',
    };
  }
  
  const status = content[0].status;
  
  if (status === 'approved' || status === 'published') {
    return {
      allowed: true,
      contentStatus: status,
    };
  }
  
  return {
    allowed: false,
    reason: `Content must be approved before generating video assets. Current status: ${status}`,
    contentStatus: status,
  };
}

export async function trackCost(
  provider: string,
  operation: string,
  actualCost: number,
  clientId?: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  const today = getTodayDate();
  
  await db.insert(apiCostTracking).values({
    date: today,
    provider,
    operation,
    costUsd: actualCost.toFixed(4),
    requestCount: 1,
    clientId,
    metadata,
  });
  
  console.log(`[CostControl] Tracked: ${provider}/${operation} = $${actualCost.toFixed(4)}`);
}

export function getEstimatedCost(provider: string, operation: string): number {
  const providerCosts = COST_ESTIMATES[provider.toLowerCase()];
  if (!providerCosts) {
    console.warn(`[CostControl] Unknown provider: ${provider}, using default cost estimate`);
    return 0.10;
  }
  
  const operationCost = providerCosts[operation];
  if (operationCost === undefined) {
    console.warn(`[CostControl] Unknown operation: ${operation} for ${provider}, using default cost estimate`);
    return 0.10;
  }
  
  return operationCost;
}

export async function setDailyBudget(limitUsd: number, provider?: string): Promise<void> {
  const existing = await db
    .select()
    .from(costBudgets)
    .where(
      and(
        eq(costBudgets.budgetType, 'daily'),
        provider ? eq(costBudgets.provider, provider) : sql`${costBudgets.provider} IS NULL`
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    await db
      .update(costBudgets)
      .set({ limitUsd: limitUsd.toFixed(2), updatedAt: new Date() })
      .where(eq(costBudgets.id, existing[0].id));
  } else {
    await db.insert(costBudgets).values({
      budgetType: 'daily',
      provider: provider || null,
      limitUsd: limitUsd.toFixed(2),
      alertThresholdPercent: 80,
      isActive: true,
    });
  }
  
  console.log(`[CostControl] Daily budget set to $${limitUsd.toFixed(2)}${provider ? ` for ${provider}` : ' (all providers)'}`);
}

export async function getBudgetStatus(): Promise<{
  dailySpent: number;
  dailyLimit: number;
  remainingBudget: number;
  percentUsed: number;
  byProvider: Record<string, { spent: number; limit?: number; percentUsed?: number }>;
  providerLimits: Record<string, number>;
}> {
  const today = getTodayDate();
  const dailySpent = await getDailySpending();
  const dailyLimit = await getDailyBudget();
  
  const byProviderResult = await db
    .select({
      provider: apiCostTracking.provider,
      total: sql<string>`COALESCE(SUM(${apiCostTracking.costUsd}), 0)`,
    })
    .from(apiCostTracking)
    .where(eq(apiCostTracking.date, today))
    .groupBy(apiCostTracking.provider);
  
  const providerBudgets = await db
    .select()
    .from(costBudgets)
    .where(
      and(
        eq(costBudgets.budgetType, 'daily'),
        eq(costBudgets.isActive, true),
        sql`${costBudgets.provider} IS NOT NULL`
      )
    );
  
  const providerLimits: Record<string, number> = {};
  for (const budget of providerBudgets) {
    if (budget.provider) {
      providerLimits[budget.provider] = parseFloat(budget.limitUsd);
    }
  }
  
  const byProvider: Record<string, { spent: number; limit?: number; percentUsed?: number }> = {};
  for (const row of byProviderResult) {
    const spent = parseFloat(row.total || '0');
    const limit = providerLimits[row.provider];
    byProvider[row.provider] = {
      spent,
      limit,
      percentUsed: limit ? (spent / limit) * 100 : undefined,
    };
  }
  
  return {
    dailySpent,
    dailyLimit,
    remainingBudget: Math.max(0, dailyLimit - dailySpent),
    percentUsed: (dailySpent / dailyLimit) * 100,
    byProvider,
    providerLimits,
  };
}

export async function canGenerateVideo(
  contentId?: string,
  provider: string = 'veo31',
  durationSeconds: number = 8
): Promise<{ allowed: boolean; reason?: string }> {
  const operation = durationSeconds <= 4 ? 'video_generation_4s' : 'video_generation_8s';
  const budgetCheck = await checkBudget(provider, operation);
  
  if (!budgetCheck.allowed) {
    return {
      allowed: false,
      reason: budgetCheck.reason,
    };
  }
  
  if (contentId) {
    const approvalCheck = await checkContentApproval(contentId);
    if (!approvalCheck.allowed) {
      return {
        allowed: false,
        reason: approvalCheck.reason,
      };
    }
  }
  
  return { allowed: true };
}

export const costControl = {
  checkBudget,
  checkContentApproval,
  trackCost,
  getDailySpending,
  getDailyBudget,
  setDailyBudget,
  getBudgetStatus,
  getEstimatedCost,
  canGenerateVideo,
};
