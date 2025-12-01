import { db } from "../../server/db";
import { runwayTierConfig, runwayApiUsage, runwayConcurrentTasks } from "../../shared/schema";
import { eq, and, gte, sql, desc, count } from "drizzle-orm";

export type RunwayModelCategory = 
  | 'gen4_turbo' 
  | 'gen4_aleph' 
  | 'gen4_image' 
  | 'gen3_turbo' 
  | 'act_two' 
  | 'veo3' 
  | 'gemini_image';

export interface TierLimits {
  tier: number;
  concurrency: Record<RunwayModelCategory, number>;
  dailyLimit: Record<RunwayModelCategory, number>;
  monthlySpendLimit: number;
}

export interface TierStatus {
  tier: number;
  modelStatus: Record<RunwayModelCategory, {
    concurrency: { current: number; max: number };
    dailyUsage: { current: number; max: number };
    canSubmit: boolean;
    throttledTasks: number;
  }>;
  monthlySpend: { current: number; max: number };
}

const DEFAULT_TIER_LIMITS: Record<number, { 
  concurrency: Record<RunwayModelCategory, number>;
  dailyLimit: Record<RunwayModelCategory, number>;
  monthlySpend: number;
}> = {
  1: {
    concurrency: { gen4_turbo: 1, gen4_aleph: 1, gen4_image: 2, gen3_turbo: 1, act_two: 1, veo3: 1, gemini_image: 2 },
    dailyLimit: { gen4_turbo: 50, gen4_aleph: 50, gen4_image: 200, gen3_turbo: 50, act_two: 50, veo3: 50, gemini_image: 200 },
    monthlySpend: 100,
  },
  2: {
    concurrency: { gen4_turbo: 3, gen4_aleph: 3, gen4_image: 3, gen3_turbo: 3, act_two: 3, veo3: 3, gemini_image: 3 },
    dailyLimit: { gen4_turbo: 500, gen4_aleph: 500, gen4_image: 1000, gen3_turbo: 500, act_two: 500, veo3: 500, gemini_image: 1000 },
    monthlySpend: 500,
  },
  3: {
    concurrency: { gen4_turbo: 5, gen4_aleph: 5, gen4_image: 5, gen3_turbo: 5, act_two: 5, veo3: 5, gemini_image: 5 },
    dailyLimit: { gen4_turbo: 1000, gen4_aleph: 1000, gen4_image: 2000, gen3_turbo: 1000, act_two: 1000, veo3: 1000, gemini_image: 2000 },
    monthlySpend: 2000,
  },
  4: {
    concurrency: { gen4_turbo: 10, gen4_aleph: 10, gen4_image: 10, gen3_turbo: 10, act_two: 10, veo3: 10, gemini_image: 10 },
    dailyLimit: { gen4_turbo: 5000, gen4_aleph: 5000, gen4_image: 10000, gen3_turbo: 5000, act_two: 5000, veo3: 5000, gemini_image: 10000 },
    monthlySpend: 20000,
  },
  5: {
    concurrency: { gen4_turbo: 20, gen4_aleph: 20, gen4_image: 20, gen3_turbo: 20, act_two: 20, veo3: 20, gemini_image: 20 },
    dailyLimit: { gen4_turbo: 25000, gen4_aleph: 25000, gen4_image: 30000, gen3_turbo: 25000, act_two: 25000, veo3: 25000, gemini_image: 30000 },
    monthlySpend: 100000,
  },
};

export function mapRunwayModelToCategory(model: string): RunwayModelCategory {
  const modelLower = model.toLowerCase().replace(/[.-]/g, '_');
  
  if (modelLower.includes('gen4_turbo') || modelLower === 'gen4_turbo') return 'gen4_turbo';
  if (modelLower.includes('gen4_aleph') || modelLower === 'gen4_aleph') return 'gen4_aleph';
  if (modelLower.includes('gen4_image')) return 'gen4_image';
  if (modelLower.includes('gen3')) return 'gen3_turbo';
  if (modelLower.includes('act_two') || modelLower.includes('acttwo')) return 'act_two';
  if (modelLower.includes('veo3') || modelLower.includes('veo')) return 'veo3';
  if (modelLower.includes('gemini')) return 'gemini_image';
  
  return 'gen4_turbo';
}

class RunwayTierManager {
  private currentTier: number = 1;
  private tierLimits: TierLimits | null = null;
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const configs = await db.select().from(runwayTierConfig).limit(1);
      
      if (configs.length === 0) {
        await db.insert(runwayTierConfig).values({
          tier: 1,
          gen4TurboConcurrency: 1,
          gen4AlephConcurrency: 1,
          gen4ImageConcurrency: 2,
          gen3TurboConcurrency: 1,
          actTwoConcurrency: 1,
          veo3Concurrency: 1,
          geminiImageConcurrency: 2,
          gen4TurboDailyLimit: 50,
          gen4AlephDailyLimit: 50,
          gen4ImageDailyLimit: 200,
          gen3TurboDailyLimit: 50,
          actTwoDailyLimit: 50,
          veo3DailyLimit: 50,
          geminiImageDailyLimit: 200,
          monthlySpendLimit: "100",
        });
        this.currentTier = 1;
      } else {
        this.currentTier = configs[0].tier;
      }

      this.tierLimits = this.getTierLimits(this.currentTier);
      this.initialized = true;
      console.log(`[RunwayTierManager] Initialized at Tier ${this.currentTier}`);
    } catch (error) {
      console.error('[RunwayTierManager] Failed to initialize:', error);
      this.currentTier = 1;
      this.tierLimits = this.getTierLimits(1);
      this.initialized = true;
    }
  }

  getTierLimits(tier: number): TierLimits {
    const limits = DEFAULT_TIER_LIMITS[tier] || DEFAULT_TIER_LIMITS[1];
    return {
      tier,
      concurrency: limits.concurrency,
      dailyLimit: limits.dailyLimit,
      monthlySpendLimit: limits.monthlySpend,
    };
  }

  async setTier(tier: number): Promise<void> {
    if (tier < 1 || tier > 5) {
      throw new Error(`Invalid tier: ${tier}. Must be between 1 and 5.`);
    }

    const limits = DEFAULT_TIER_LIMITS[tier];
    
    await db.update(runwayTierConfig)
      .set({
        tier,
        gen4TurboConcurrency: limits.concurrency.gen4_turbo,
        gen4AlephConcurrency: limits.concurrency.gen4_aleph,
        gen4ImageConcurrency: limits.concurrency.gen4_image,
        gen3TurboConcurrency: limits.concurrency.gen3_turbo,
        actTwoConcurrency: limits.concurrency.act_two,
        veo3Concurrency: limits.concurrency.veo3,
        geminiImageConcurrency: limits.concurrency.gemini_image,
        gen4TurboDailyLimit: limits.dailyLimit.gen4_turbo,
        gen4AlephDailyLimit: limits.dailyLimit.gen4_aleph,
        gen4ImageDailyLimit: limits.dailyLimit.gen4_image,
        gen3TurboDailyLimit: limits.dailyLimit.gen3_turbo,
        actTwoDailyLimit: limits.dailyLimit.act_two,
        veo3DailyLimit: limits.dailyLimit.veo3,
        geminiImageDailyLimit: limits.dailyLimit.gemini_image,
        monthlySpendLimit: limits.monthlySpend.toString(),
        updatedAt: new Date(),
      });

    this.currentTier = tier;
    this.tierLimits = this.getTierLimits(tier);
    console.log(`[RunwayTierManager] Updated to Tier ${tier}`);
  }

  async getCurrentConcurrency(modelCategory: RunwayModelCategory): Promise<number> {
    const result = await db.select({ count: count() })
      .from(runwayConcurrentTasks)
      .where(and(
        eq(runwayConcurrentTasks.modelType, modelCategory),
        sql`${runwayConcurrentTasks.status} IN ('pending', 'running')`
      ));
    
    return result[0]?.count || 0;
  }

  async getThrottledCount(modelCategory: RunwayModelCategory): Promise<number> {
    const result = await db.select({ count: count() })
      .from(runwayConcurrentTasks)
      .where(and(
        eq(runwayConcurrentTasks.modelType, modelCategory),
        eq(runwayConcurrentTasks.status, 'throttled')
      ));
    
    return result[0]?.count || 0;
  }

  async getDailyUsage(modelCategory: RunwayModelCategory): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await db.select({ count: count() })
      .from(runwayApiUsage)
      .where(and(
        eq(runwayApiUsage.modelType, modelCategory),
        gte(runwayApiUsage.startedAt, twentyFourHoursAgo),
        sql`${runwayApiUsage.status} NOT IN ('failed')`
      ));
    
    return result[0]?.count || 0;
  }

  async canSubmitTask(model: string): Promise<{ 
    canSubmit: boolean; 
    willBeThrottled: boolean;
    reason?: string;
    currentConcurrency?: number;
    maxConcurrency?: number;
    dailyUsage?: number;
    dailyLimit?: number;
  }> {
    await this.initialize();
    
    const modelCategory = mapRunwayModelToCategory(model);
    const limits = this.tierLimits!;
    
    const [currentConcurrency, dailyUsage] = await Promise.all([
      this.getCurrentConcurrency(modelCategory),
      this.getDailyUsage(modelCategory),
    ]);
    
    const maxConcurrency = limits.concurrency[modelCategory];
    const dailyLimit = limits.dailyLimit[modelCategory];
    
    if (dailyUsage >= dailyLimit) {
      return {
        canSubmit: false,
        willBeThrottled: false,
        reason: `Daily limit reached (${dailyUsage}/${dailyLimit}). Limit resets in rolling 24h window.`,
        currentConcurrency,
        maxConcurrency,
        dailyUsage,
        dailyLimit,
      };
    }
    
    if (currentConcurrency >= maxConcurrency) {
      return {
        canSubmit: true,
        willBeThrottled: true,
        reason: `Concurrency limit reached (${currentConcurrency}/${maxConcurrency}). Task will be THROTTLED and queued.`,
        currentConcurrency,
        maxConcurrency,
        dailyUsage,
        dailyLimit,
      };
    }
    
    return {
      canSubmit: true,
      willBeThrottled: false,
      currentConcurrency,
      maxConcurrency,
      dailyUsage,
      dailyLimit,
    };
  }

  async registerTask(taskId: string, model: string, projectId?: string, sceneId?: string): Promise<void> {
    const modelCategory = mapRunwayModelToCategory(model);
    
    await db.insert(runwayConcurrentTasks).values({
      modelType: modelCategory,
      taskId,
      projectId,
      sceneId,
      status: 'pending',
    }).onConflictDoUpdate({
      target: runwayConcurrentTasks.taskId,
      set: { status: 'pending', lastCheckedAt: new Date() },
    });
    
    await db.insert(runwayApiUsage).values({
      modelType: modelCategory,
      taskId,
      status: 'pending',
    });
  }

  async updateTaskStatus(taskId: string, status: 'pending' | 'running' | 'throttled' | 'completed' | 'failed', creditsUsed?: number, errorMessage?: string): Promise<void> {
    if (status === 'completed' || status === 'failed') {
      await db.delete(runwayConcurrentTasks)
        .where(eq(runwayConcurrentTasks.taskId, taskId));
    } else {
      await db.update(runwayConcurrentTasks)
        .set({ status, lastCheckedAt: new Date() })
        .where(eq(runwayConcurrentTasks.taskId, taskId));
    }
    
    await db.update(runwayApiUsage)
      .set({
        status,
        creditsUsed: creditsUsed?.toString(),
        completedAt: (status === 'completed' || status === 'failed') ? new Date() : undefined,
        errorMessage,
      })
      .where(eq(runwayApiUsage.taskId, taskId));
  }

  async getTierStatus(): Promise<TierStatus> {
    await this.initialize();
    
    const limits = this.tierLimits!;
    const categories: RunwayModelCategory[] = ['gen4_turbo', 'gen4_aleph', 'gen4_image', 'gen3_turbo', 'act_two', 'veo3', 'gemini_image'];
    
    const modelStatus: TierStatus['modelStatus'] = {} as TierStatus['modelStatus'];
    
    for (const category of categories) {
      const [currentConcurrency, dailyUsage, throttledCount] = await Promise.all([
        this.getCurrentConcurrency(category),
        this.getDailyUsage(category),
        this.getThrottledCount(category),
      ]);
      
      modelStatus[category] = {
        concurrency: {
          current: currentConcurrency,
          max: limits.concurrency[category],
        },
        dailyUsage: {
          current: dailyUsage,
          max: limits.dailyLimit[category],
        },
        canSubmit: dailyUsage < limits.dailyLimit[category],
        throttledTasks: throttledCount,
      };
    }
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthlyUsage = await db.select({
      total: sql<number>`COALESCE(SUM(CAST(${runwayApiUsage.creditsUsed} AS DECIMAL)), 0)`,
    })
    .from(runwayApiUsage)
    .where(and(
      gte(runwayApiUsage.startedAt, thirtyDaysAgo),
      eq(runwayApiUsage.status, 'completed')
    ));
    
    return {
      tier: this.currentTier,
      modelStatus,
      monthlySpend: {
        current: Number(monthlyUsage[0]?.total || 0),
        max: limits.monthlySpendLimit,
      },
    };
  }

  async cleanupStaleTasks(maxAgeMinutes: number = 60): Promise<number> {
    const staleTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    
    const result = await db.delete(runwayConcurrentTasks)
      .where(and(
        sql`${runwayConcurrentTasks.lastCheckedAt} < ${staleTime} OR ${runwayConcurrentTasks.lastCheckedAt} IS NULL`,
        sql`${runwayConcurrentTasks.createdAt} < ${staleTime}`
      ));
    
    return 0;
  }
}

export const runwayTierManager = new RunwayTierManager();
