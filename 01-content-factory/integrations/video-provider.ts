import { 
  generateVideoWithRunway, 
  checkVideoStatus, 
  waitForVideoCompletion,
  generateVideoToVideoWithRunway,
  upscaleVideoWithRunway,
  generateCharacterPerformance,
  generateImageWithRunway,
  getRunwayModels,
  RunwayVideoModel
} from './runway';
import { generateVideoWithWan, checkWanTaskStatus, waitForWanCompletion } from './wan';
import { generateVideoWithPika, checkPikaStatus, waitForPikaCompletion } from './pika';
import { generateVideoWithLuma, checkLumaStatus, waitForLumaCompletion } from './luma';
import { generateVideoWithVeo2, checkVeo2Status, waitForVeo2Completion } from './veo2';
import { generateVideoWithVeo31, checkVeo31Status, waitForVeo31Completion, testVeo31Connection } from './veo31';
import { generateImageWithNanoBananaPro } from './nano-banana-pro';
import { generateSceneImageWithAlibaba, isAlibabaImageConfigured } from './alibaba-image';
import { 
  generateVideoWithFal, 
  generateVideoWithFalKling, 
  generateVideoWithFalMinimax,
  generateImageWithFal,
  generateImageWithFalFluxPro,
  isFalConfigured, 
  testFalConnection 
} from './fal-ai';
import { healthMonitor, PROVIDER_CONFIG } from '../services/provider-health-monitor';

export interface VideoProviderResult {
  success: boolean;
  provider?: string;
  taskId?: string;
  videoUrl?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'throttled';
  error?: string;
  imageUrl?: string;
  fallbackAttempts?: number;
}

export type VideoProvider = 
  | 'veo31' 
  | 'veo2' 
  | 'runway' 
  | 'runway_gen4_turbo'    // Runway Gen-4 Turbo (5 credits/sec)
  | 'runway_gen4_aleph'    // Runway Gen-4 Aleph video-to-video (15 credits/sec)
  | 'runway_veo3'          // Runway Veo 3 (40 credits/sec)
  | 'runway_veo31'         // Runway Veo 3.1 (40 credits/sec)
  | 'runway_veo31_fast'    // Runway Veo 3.1 Fast (15 credits/sec)
  | 'runway_upscale'       // Runway upscaling (2 credits/sec)
  | 'runway_act_two'       // Runway character performance (5 credits/sec)
  | 'wan' 
  | 'pika' 
  | 'luma' 
  | 'kling' 
  | 'hailuo' 
  | 'fal' 
  | 'fal_kling' 
  | 'fal_minimax';

interface ProviderConfig {
  name: VideoProvider;
  displayName: string;
  isConfigured: () => boolean;
  generate: (prompt: string, options: VideoGenerationOptions) => Promise<VideoProviderResult>;
  checkStatus: (taskId: string) => Promise<VideoProviderResult>;
  waitForCompletion: (taskId: string, maxWait?: number, interval?: number) => Promise<VideoProviderResult>;
}

interface VideoGenerationOptions {
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  imageUrl?: string;
  imageBase64?: string;
  style?: string;
}

const providerConfigs: Record<VideoProvider, ProviderConfig> = {
  veo31: {
    name: 'veo31',
    displayName: 'Veo 3.1 Fast',
    isConfigured: () => !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY),
    generate: async (prompt, options) => {
      const result = await generateVideoWithVeo31(prompt, {
        duration: Math.min(Math.max(options.duration || 8, 4), 8) as 4 | 6 | 8,
        aspectRatio: options.aspectRatio || '16:9',
        resolution: '720p',
        generateAudio: true,
        imageUrl: options.imageUrl,
        imageBase64: options.imageBase64,
      });
      return {
        success: result.success,
        provider: 'veo31',
        taskId: result.taskId,
        videoUrl: result.videoUrl,
        status: result.status,
        error: result.error,
        imageUrl: options.imageUrl,
      };
    },
    checkStatus: async (taskId) => {
      const result = await checkVeo31Status(taskId);
      return { ...result, provider: 'veo31' };
    },
    waitForCompletion: async (taskId, maxWait = 600, interval = 10) => {
      const result = await waitForVeo31Completion(taskId, maxWait, interval);
      return { ...result, provider: 'veo31' };
    },
  },

  veo2: {
    name: 'veo2',
    displayName: 'Veo 2.0',
    isConfigured: () => !!(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY),
    generate: async (prompt, options) => {
      const veoAspect = options.aspectRatio === '9:16' ? '9:16' : '16:9';
      const result = await generateVideoWithVeo2(prompt, {
        duration: Math.min(Math.max(options.duration || 8, 5), 8) as 5 | 6 | 7 | 8,
        aspectRatio: veoAspect,
        personGeneration: 'ALLOW_ALL',
      });
      return {
        success: result.success,
        provider: 'veo2',
        taskId: result.taskId,
        videoUrl: result.videoUrl,
        status: result.status,
        error: result.error,
      };
    },
    checkStatus: async (taskId) => {
      const result = await checkVeo2Status(taskId);
      return { ...result, provider: 'veo2' };
    },
    waitForCompletion: async (taskId, maxWait = 600, interval = 10) => {
      const result = await waitForVeo2Completion(taskId, maxWait, interval);
      return { ...result, provider: 'veo2' };
    },
  },
  
  runway: {
    name: 'runway',
    displayName: 'Runway Gen-4 Turbo',
    isConfigured: () => !!process.env.RUNWAY_API_KEY,
    generate: async (prompt, options) => {
      const runwayAspect = options.aspectRatio === '1:1' ? '16:9' : (options.aspectRatio || '16:9');
      const result = await generateVideoWithRunway(prompt, {
        duration: options.duration || 5,
        aspectRatio: runwayAspect as '16:9' | '9:16',
        model: 'gen4_turbo',
        imageUrl: options.imageUrl,
        imageBase64: options.imageBase64,
      });
      return {
        ...result,
        provider: 'runway',
      };
    },
    checkStatus: async (taskId) => {
      const result = await checkVideoStatus(taskId);
      return { ...result, provider: 'runway' };
    },
    waitForCompletion: async (taskId, maxWait = 120, interval = 5) => {
      const result = await waitForVideoCompletion(taskId, maxWait, interval);
      return { ...result, provider: 'runway' };
    },
  },

  runway_gen4_turbo: {
    name: 'runway_gen4_turbo',
    displayName: 'Runway Gen-4 Turbo (5 cr/s)',
    isConfigured: () => !!process.env.RUNWAY_API_KEY,
    generate: async (prompt, options) => {
      const runwayAspect = options.aspectRatio === '1:1' ? '16:9' : (options.aspectRatio || '16:9');
      const result = await generateVideoWithRunway(prompt, {
        duration: options.duration || 5,
        aspectRatio: runwayAspect as '16:9' | '9:16',
        model: 'gen4_turbo',
        imageUrl: options.imageUrl,
        imageBase64: options.imageBase64,
      });
      return { ...result, provider: 'runway_gen4_turbo' };
    },
    checkStatus: async (taskId) => {
      const result = await checkVideoStatus(taskId);
      return { ...result, provider: 'runway_gen4_turbo' };
    },
    waitForCompletion: async (taskId, maxWait = 120, interval = 5) => {
      const result = await waitForVideoCompletion(taskId, maxWait, interval);
      return { ...result, provider: 'runway_gen4_turbo' };
    },
  },

  runway_gen4_aleph: {
    name: 'runway_gen4_aleph',
    displayName: 'Runway Gen-4 Aleph (15 cr/s)',
    isConfigured: () => !!process.env.RUNWAY_API_KEY,
    generate: async (prompt, options) => {
      // Gen-4 Aleph requires a source video for video-to-video
      // For now, use it as image-to-video with gen4_turbo fallback
      if (options.imageUrl) {
        const result = await generateVideoWithRunway(prompt, {
          duration: options.duration || 5,
          aspectRatio: (options.aspectRatio || '16:9') as '16:9' | '9:16',
          model: 'gen4_turbo',
          imageUrl: options.imageUrl,
          imageBase64: options.imageBase64,
        });
        return { ...result, provider: 'runway_gen4_aleph' };
      }
      return { success: false, provider: 'runway_gen4_aleph', error: 'Gen-4 Aleph requires a source video for video-to-video generation' };
    },
    checkStatus: async (taskId) => {
      const result = await checkVideoStatus(taskId);
      return { ...result, provider: 'runway_gen4_aleph' };
    },
    waitForCompletion: async (taskId, maxWait = 180, interval = 5) => {
      const result = await waitForVideoCompletion(taskId, maxWait, interval);
      return { ...result, provider: 'runway_gen4_aleph' };
    },
  },

  runway_veo3: {
    name: 'runway_veo3',
    displayName: 'Runway Veo 3 (40 cr/s)',
    isConfigured: () => !!process.env.RUNWAY_API_KEY,
    generate: async (prompt, options) => {
      const runwayAspect = options.aspectRatio === '1:1' ? '16:9' : (options.aspectRatio || '16:9');
      const result = await generateVideoWithRunway(prompt, {
        duration: options.duration || 5,
        aspectRatio: runwayAspect as '16:9' | '9:16',
        model: 'veo3',
        imageUrl: options.imageUrl,
        imageBase64: options.imageBase64,
      });
      return { ...result, provider: 'runway_veo3' };
    },
    checkStatus: async (taskId) => {
      const result = await checkVideoStatus(taskId);
      return { ...result, provider: 'runway_veo3' };
    },
    waitForCompletion: async (taskId, maxWait = 300, interval = 10) => {
      const result = await waitForVideoCompletion(taskId, maxWait, interval);
      return { ...result, provider: 'runway_veo3' };
    },
  },

  runway_veo31: {
    name: 'runway_veo31',
    displayName: 'Runway Veo 3.1 (40 cr/s)',
    isConfigured: () => !!process.env.RUNWAY_API_KEY,
    generate: async (prompt, options) => {
      const runwayAspect = options.aspectRatio === '1:1' ? '16:9' : (options.aspectRatio || '16:9');
      const result = await generateVideoWithRunway(prompt, {
        duration: options.duration || 5,
        aspectRatio: runwayAspect as '16:9' | '9:16',
        model: 'veo3.1',
        imageUrl: options.imageUrl,
        imageBase64: options.imageBase64,
      });
      return { ...result, provider: 'runway_veo31' };
    },
    checkStatus: async (taskId) => {
      const result = await checkVideoStatus(taskId);
      return { ...result, provider: 'runway_veo31' };
    },
    waitForCompletion: async (taskId, maxWait = 300, interval = 10) => {
      const result = await waitForVideoCompletion(taskId, maxWait, interval);
      return { ...result, provider: 'runway_veo31' };
    },
  },

  runway_veo31_fast: {
    name: 'runway_veo31_fast',
    displayName: 'Runway Veo 3.1 Fast (15 cr/s)',
    isConfigured: () => !!process.env.RUNWAY_API_KEY,
    generate: async (prompt, options) => {
      const runwayAspect = options.aspectRatio === '1:1' ? '16:9' : (options.aspectRatio || '16:9');
      const result = await generateVideoWithRunway(prompt, {
        duration: options.duration || 5,
        aspectRatio: runwayAspect as '16:9' | '9:16',
        model: 'veo3.1_fast',
        imageUrl: options.imageUrl,
        imageBase64: options.imageBase64,
      });
      return { ...result, provider: 'runway_veo31_fast' };
    },
    checkStatus: async (taskId) => {
      const result = await checkVideoStatus(taskId);
      return { ...result, provider: 'runway_veo31_fast' };
    },
    waitForCompletion: async (taskId, maxWait = 180, interval = 5) => {
      const result = await waitForVideoCompletion(taskId, maxWait, interval);
      return { ...result, provider: 'runway_veo31_fast' };
    },
  },

  runway_upscale: {
    name: 'runway_upscale',
    displayName: 'Runway Upscale (2 cr/s)',
    isConfigured: () => !!process.env.RUNWAY_API_KEY,
    generate: async (_prompt, options) => {
      if (!options.imageUrl) {
        return { success: false, provider: 'runway_upscale', error: 'Upscaling requires a video URL' };
      }
      const result = await upscaleVideoWithRunway(options.imageUrl);
      return { ...result, provider: 'runway_upscale', status: result.status as VideoProviderResult['status'] };
    },
    checkStatus: async (taskId) => {
      const result = await checkVideoStatus(taskId);
      return { ...result, provider: 'runway_upscale' };
    },
    waitForCompletion: async (taskId, maxWait = 300, interval = 10) => {
      const result = await waitForVideoCompletion(taskId, maxWait, interval);
      return { ...result, provider: 'runway_upscale' };
    },
  },

  runway_act_two: {
    name: 'runway_act_two',
    displayName: 'Runway Act Two (5 cr/s)',
    isConfigured: () => !!process.env.RUNWAY_API_KEY,
    generate: async (_prompt, options) => {
      if (!options.imageUrl) {
        return { success: false, provider: 'runway_act_two', error: 'Act Two requires reference media and driver video URLs' };
      }
      // Act Two requires both reference and driver - for now return error if not provided
      return { success: false, provider: 'runway_act_two', error: 'Act Two requires specific reference media and driver video - use API directly' };
    },
    checkStatus: async (taskId) => {
      const result = await checkVideoStatus(taskId);
      return { ...result, provider: 'runway_act_two' };
    },
    waitForCompletion: async (taskId, maxWait = 300, interval = 10) => {
      const result = await waitForVideoCompletion(taskId, maxWait, interval);
      return { ...result, provider: 'runway_act_two' };
    },
  },
  
  wan: {
    name: 'wan',
    displayName: 'Wan 2.5',
    isConfigured: () => !!process.env.DASHSCOPE_API_KEY,
    generate: async (prompt, options) => {
      const result = await generateVideoWithWan(prompt, {
        duration: options.duration || 5,
        aspectRatio: options.aspectRatio || '16:9',
      });
      return {
        success: result.success,
        provider: 'wan',
        taskId: result.taskId,
        status: result.status === 'running' ? 'processing' : result.status as any,
        error: result.error,
      };
    },
    checkStatus: async (taskId) => {
      const result = await checkWanTaskStatus(taskId);
      return {
        success: result.success,
        provider: 'wan',
        taskId: result.taskId,
        videoUrl: result.videoUrl,
        status: result.status === 'succeeded' ? 'completed' : 
                result.status === 'running' ? 'processing' : result.status as any,
        error: result.error,
      };
    },
    waitForCompletion: async (taskId, maxWait = 300, interval = 15) => {
      const result = await waitForWanCompletion(taskId, maxWait, interval);
      return {
        success: result.success,
        provider: 'wan',
        taskId: result.taskId,
        videoUrl: result.videoUrl,
        status: result.status === 'succeeded' ? 'completed' : 
                result.status === 'running' ? 'processing' : result.status as any,
        error: result.error,
      };
    },
  },
  
  pika: {
    name: 'pika',
    displayName: 'Pika Labs',
    isConfigured: () => !!process.env.PIKA_API_KEY,
    generate: async (prompt, options) => {
      const result = await generateVideoWithPika(prompt, {
        duration: options.duration || 3,
        aspectRatio: options.aspectRatio || '16:9',
        imageUrl: options.imageUrl,
        style: options.style,
      });
      return { ...result, provider: 'pika' };
    },
    checkStatus: async (taskId) => {
      const result = await checkPikaStatus(taskId);
      return { ...result, provider: 'pika' };
    },
    waitForCompletion: async (taskId, maxWait = 180, interval = 10) => {
      const result = await waitForPikaCompletion(taskId, maxWait, interval);
      return { ...result, provider: 'pika' };
    },
  },
  
  luma: {
    name: 'luma',
    displayName: 'Luma Dream Machine',
    isConfigured: () => !!process.env.LUMA_API_KEY,
    generate: async (prompt, options) => {
      const result = await generateVideoWithLuma(prompt, {
        aspectRatio: options.aspectRatio || '16:9',
        imageUrl: options.imageUrl,
      });
      return { ...result, provider: 'luma' };
    },
    checkStatus: async (taskId) => {
      const result = await checkLumaStatus(taskId);
      return { ...result, provider: 'luma' };
    },
    waitForCompletion: async (taskId, maxWait = 300, interval = 10) => {
      const result = await waitForLumaCompletion(taskId, maxWait, interval);
      return { ...result, provider: 'luma' };
    },
  },
  
  kling: {
    name: 'kling',
    displayName: 'Kling AI',
    isConfigured: () => !!process.env.KLING_API_KEY,
    generate: async () => ({
      success: false,
      provider: 'kling',
      error: 'Kling integration not yet implemented',
    }),
    checkStatus: async () => ({
      success: false,
      provider: 'kling',
      error: 'Kling integration not yet implemented',
    }),
    waitForCompletion: async () => ({
      success: false,
      provider: 'kling',
      error: 'Kling integration not yet implemented',
    }),
  },
  
  hailuo: {
    name: 'hailuo',
    displayName: 'Hailuo AI',
    isConfigured: () => !!process.env.HAILUO_API_KEY,
    generate: async () => ({
      success: false,
      provider: 'hailuo',
      error: 'Hailuo integration not yet implemented',
    }),
    checkStatus: async () => ({
      success: false,
      provider: 'hailuo',
      error: 'Hailuo integration not yet implemented',
    }),
    waitForCompletion: async () => ({
      success: false,
      provider: 'hailuo',
      error: 'Hailuo integration not yet implemented',
    }),
  },

  fal: {
    name: 'fal',
    displayName: 'Fal AI (Veo 2)',
    isConfigured: isFalConfigured,
    generate: async (prompt, options) => {
      const result = await generateVideoWithFal(prompt, {
        duration: options.duration || 5,
        aspectRatio: options.aspectRatio || '16:9',
        imageUrl: options.imageUrl,
        imageBase64: options.imageBase64,
      });
      return { ...result, provider: 'fal' };
    },
    checkStatus: async (taskId) => ({
      success: true,
      provider: 'fal',
      taskId,
      status: 'completed',
    }),
    waitForCompletion: async (taskId) => ({
      success: true,
      provider: 'fal',
      taskId,
      status: 'completed',
    }),
  },

  fal_kling: {
    name: 'fal_kling',
    displayName: 'Fal AI (Kling)',
    isConfigured: isFalConfigured,
    generate: async (prompt, options) => {
      const result = await generateVideoWithFalKling(prompt, {
        duration: options.duration || 5,
        aspectRatio: options.aspectRatio || '16:9',
        imageUrl: options.imageUrl,
        imageBase64: options.imageBase64,
      });
      return { ...result, provider: 'fal_kling' };
    },
    checkStatus: async (taskId) => ({
      success: true,
      provider: 'fal_kling',
      taskId,
      status: 'completed',
    }),
    waitForCompletion: async (taskId) => ({
      success: true,
      provider: 'fal_kling',
      taskId,
      status: 'completed',
    }),
  },

  fal_minimax: {
    name: 'fal_minimax',
    displayName: 'Fal AI (Minimax)',
    isConfigured: isFalConfigured,
    generate: async (prompt, options) => {
      const result = await generateVideoWithFalMinimax(prompt, {
        duration: options.duration || 5,
        aspectRatio: options.aspectRatio || '16:9',
        imageUrl: options.imageUrl,
        imageBase64: options.imageBase64,
      });
      return { ...result, provider: 'fal_minimax' };
    },
    checkStatus: async (taskId) => ({
      success: true,
      provider: 'fal_minimax',
      taskId,
      status: 'completed',
    }),
    waitForCompletion: async (taskId) => ({
      success: true,
      provider: 'fal_minimax',
      taskId,
      status: 'completed',
    }),
  },
};

export interface EnabledProvider {
  name: VideoProvider;
  priority: number;
  isEnabled: boolean;
}

export async function generateVideoWithFallback(
  prompt: string,
  enabledProviders: EnabledProvider[],
  options: VideoGenerationOptions = {},
  context?: { projectId?: string; sceneId?: string }
): Promise<VideoProviderResult> {
  const sortedProviders = enabledProviders
    .filter(p => p.isEnabled)
    .sort((a, b) => a.priority - b.priority);
  
  if (sortedProviders.length === 0) {
    return {
      success: false,
      error: 'No video providers are enabled. Please enable at least one in Settings.',
    };
  }

  console.log(`[VideoProvider] Attempting generation with ${sortedProviders.length} providers in order:`, 
    sortedProviders.map(p => p.name).join(' → '));

  let lastError = '';
  let attempts = 0;

  for (const enabledProvider of sortedProviders) {
    const config = providerConfigs[enabledProvider.name];
    
    if (!config) {
      console.log(`[VideoProvider] Unknown provider: ${enabledProvider.name}`);
      continue;
    }

    // CRITICAL: Check quarantine status BEFORE attempting (self-healing)
    if (healthMonitor.isProviderQuarantined(enabledProvider.name)) {
      console.log(`[VideoProvider] Skipping ${enabledProvider.name}: currently quarantined`);
      continue;
    }

    if (!config.isConfigured()) {
      console.log(`[VideoProvider] ${config.displayName} not configured, trying next...`);
      continue;
    }

    const providerConfig = PROVIDER_CONFIG[enabledProvider.name as keyof typeof PROVIDER_CONFIG];
    if (providerConfig && enabledProvider.name === 'runway' && options.duration) {
      const allowedDurations = (providerConfig as { constraints: { allowedDurations?: number[] } }).constraints.allowedDurations;
      if (allowedDurations && !allowedDurations.includes(options.duration)) {
        console.log(`[VideoProvider] Skipping ${config.displayName}: duration ${options.duration}s not allowed (only ${allowedDurations.join(', ')}s)`);
        continue;
      }
    }

    attempts++;
    console.log(`[VideoProvider] Attempting with ${config.displayName}...`);

    const startTime = Date.now();
    const requestId = `video_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      const result = await config.generate(prompt, options);
      const latencyMs = Date.now() - startTime;
      
      await healthMonitor.recordRequest(
        enabledProvider.name,
        'video',
        requestId,
        {
          success: result.success,
          latencyMs,
          errorCode: result.success ? undefined : '500',
          errorMessage: result.error,
          costIncurred: providerConfig?.costPerRequest || 0,
        },
        context?.projectId,
        context?.sceneId,
        { duration: options.duration, promptLength: prompt.length }
      ).catch(err => console.error('[VideoProvider] Failed to record metrics:', err));
      
      if (result.success) {
        console.log(`[VideoProvider] ${config.displayName} started task: ${result.taskId}`);
        return {
          ...result,
          fallbackAttempts: attempts,
        };
      }

      console.log(`[VideoProvider] ${config.displayName} failed: ${result.error}`);
      lastError = result.error || 'Unknown error';
      
      // Check for hard failures that warrant quarantine
      const hardFailurePatterns = [
        'not available', 'access denied', 'quota exceeded', 
        'model not found', 'waitlist', 'forbidden', 'unauthorized',
        'not enabled', 'billing', 'subscription'
      ];
      const isHardFailure = hardFailurePatterns.some(pattern => 
        lastError.toLowerCase().includes(pattern)
      );
      
      if (isHardFailure) {
        console.log(`[VideoProvider] HARD FAILURE detected for ${enabledProvider.name}: ${lastError}`);
        await healthMonitor.quarantineProvider(enabledProvider.name, lastError);
        continue; // Skip to next provider
      }
      
      if (result.error?.includes('rate limit')) {
        console.log(`[VideoProvider] Rate limited, trying next provider...`);
        continue;
      }
      
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      console.error(`[VideoProvider] ${config.displayName} error:`, error);
      lastError = error.message || 'Provider error';
      
      await healthMonitor.recordRequest(
        enabledProvider.name,
        'video',
        requestId,
        {
          success: false,
          latencyMs,
          errorCode: error.code || '500',
          errorMessage: lastError,
        },
        context?.projectId,
        context?.sceneId,
        { duration: options.duration, promptLength: prompt.length }
      ).catch(err => console.error('[VideoProvider] Failed to record metrics:', err));
      
      // Also check for hard failures in exception
      const hardFailurePatterns = [
        'not available', 'access denied', 'quota exceeded', 
        'model not found', 'waitlist', 'forbidden', 'unauthorized',
        'not enabled', 'billing', 'subscription'
      ];
      const isHardFailure = hardFailurePatterns.some(pattern => 
        lastError.toLowerCase().includes(pattern)
      );
      
      if (isHardFailure) {
        console.log(`[VideoProvider] HARD FAILURE (exception) detected for ${enabledProvider.name}: ${lastError}`);
        await healthMonitor.quarantineProvider(enabledProvider.name, lastError);
      }
    }
  }

  return {
    success: false,
    error: `All providers failed. Last error: ${lastError}`,
    fallbackAttempts: attempts,
  };
}

export async function checkVideoStatusWithProvider(
  taskId: string,
  provider: VideoProvider
): Promise<VideoProviderResult> {
  const config = providerConfigs[provider];
  
  if (!config) {
    return {
      success: false,
      error: `Unknown provider: ${provider}`,
    };
  }

  return config.checkStatus(taskId);
}

export async function waitForVideoWithProvider(
  taskId: string,
  provider: VideoProvider,
  maxWaitSeconds: number = 300,
  pollIntervalSeconds: number = 10
): Promise<VideoProviderResult> {
  const config = providerConfigs[provider];
  
  if (!config) {
    return {
      success: false,
      error: `Unknown provider: ${provider}`,
    };
  }

  return config.waitForCompletion(taskId, maxWaitSeconds, pollIntervalSeconds);
}

export function getProviderConfig(provider: VideoProvider): ProviderConfig | undefined {
  return providerConfigs[provider];
}

export function getAllProviders(): ProviderConfig[] {
  return Object.values(providerConfigs);
}

export function getConfiguredProviders(): ProviderConfig[] {
  return Object.values(providerConfigs).filter(p => p.isConfigured());
}

export async function generateUniqueSceneImage(
  prompt: string, 
  context?: { projectId?: string; sceneId?: string }
): Promise<{
  success: boolean;
  imageBase64?: string;
  imageUrl?: string;
  error?: string;
  provider?: string;
}> {
  const geminiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  // Hard failure patterns for quarantine detection
  const hardFailurePatterns = [
    'not available', 'access denied', 'quota exceeded', 
    'model not found', 'forbidden', 'unauthorized',
    'not enabled', 'billing', 'subscription', 'invalid_api_key'
  ];
  
  // Try Gemini (Nano Banana Pro) first
  if (geminiKey && !healthMonitor.isProviderQuarantined('gemini_image')) {
    console.log('[VideoProvider] Generating unique scene image with Nano Banana Pro (Gemini)...');
    const startTime = Date.now();
    const requestId = `image_gemini_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    try {
      const result = await generateImageWithNanoBananaPro(prompt, {
        resolution: '2K',
        style: 'cinematic, professional, high quality video frame',
      });
      
      const latencyMs = Date.now() - startTime;
      
      await healthMonitor.recordRequest(
        'gemini_image',
        'image',
        requestId,
        {
          success: result.success,
          latencyMs,
          errorMessage: result.error,
          costIncurred: 0,
        },
        context?.projectId,
        context?.sceneId,
        { promptLength: prompt.length }
      ).catch(err => console.error('[VideoProvider] Failed to record image metrics:', err));
      
      if (result.success && result.imageDataUrl) {
        console.log('[VideoProvider] Nano Banana Pro generated unique scene image');
        const base64Data = result.imageDataUrl.split(',')[1];
        return {
          success: true,
          imageBase64: base64Data,
          imageUrl: result.imageUrl,
          provider: 'gemini_image',
        };
      }
      
      // Check for hard failure
      if (result.error && hardFailurePatterns.some(p => result.error!.toLowerCase().includes(p))) {
        console.log(`[VideoProvider] HARD FAILURE for gemini_image: ${result.error}`);
        await healthMonitor.quarantineProvider('gemini_image', result.error);
      }
      
      console.log(`[VideoProvider] Nano Banana Pro failed: ${result.error}, trying next fallback...`);
    } catch (error: any) {
      console.error('[VideoProvider] Gemini image error:', error.message);
      if (hardFailurePatterns.some(p => error.message?.toLowerCase().includes(p))) {
        await healthMonitor.quarantineProvider('gemini_image', error.message);
      }
    }
  } else if (healthMonitor.isProviderQuarantined('gemini_image')) {
    console.log('[VideoProvider] Skipping gemini_image: currently quarantined');
  }
  
  // Try Fal AI next
  if (isFalConfigured() && !healthMonitor.isProviderQuarantined('fal_ai')) {
    console.log('[VideoProvider] Trying Fal AI Flux Pro for image generation...');
    const startTime = Date.now();
    const requestId = `image_fal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    try {
      const falResult = await generateImageWithFalFluxPro(prompt, {
        width: 1280,
        height: 720,
        style: 'cinematic',
      });
      
      const latencyMs = Date.now() - startTime;
      
      await healthMonitor.recordRequest(
        'fal_ai',
        'image',
        requestId,
        {
          success: falResult.success,
          latencyMs,
          errorMessage: falResult.error,
          costIncurred: 0.01,
        },
        context?.projectId,
        context?.sceneId,
        { promptLength: prompt.length }
      ).catch(err => console.error('[VideoProvider] Failed to record image metrics:', err));
      
      if (falResult.success && falResult.imageUrl) {
        console.log('[VideoProvider] Fal AI Flux Pro generated unique scene image');
        return {
          success: true,
          imageUrl: falResult.imageUrl,
          provider: 'fal_ai',
        };
      }
      
      // Check for hard failure
      if (falResult.error && hardFailurePatterns.some(p => falResult.error!.toLowerCase().includes(p))) {
        console.log(`[VideoProvider] HARD FAILURE for fal_ai: ${falResult.error}`);
        await healthMonitor.quarantineProvider('fal_ai', falResult.error);
      }
      
      console.log(`[VideoProvider] Fal AI failed: ${falResult.error}, trying Alibaba fallback...`);
    } catch (error: any) {
      console.error('[VideoProvider] Fal AI image error:', error.message);
      if (hardFailurePatterns.some(p => error.message?.toLowerCase().includes(p))) {
        await healthMonitor.quarantineProvider('fal_ai', error.message);
      }
    }
  } else if (healthMonitor.isProviderQuarantined('fal_ai')) {
    console.log('[VideoProvider] Skipping fal_ai: currently quarantined');
  }
  
  // Try Alibaba last
  if (isAlibabaImageConfigured() && !healthMonitor.isProviderQuarantined('dashscope')) {
    console.log('[VideoProvider] Falling back to Alibaba Wanx for image generation...');
    const startTime = Date.now();
    const requestId = `image_alibaba_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    try {
      const result = await generateSceneImageWithAlibaba(prompt, '16:9');
      
      const latencyMs = Date.now() - startTime;
      
      await healthMonitor.recordRequest(
        'dashscope',
        'image',
        requestId,
        {
          success: result.success,
          latencyMs,
          errorMessage: result.error,
          costIncurred: 0.008,
        },
        context?.projectId,
        context?.sceneId,
        { promptLength: prompt.length }
      ).catch(err => console.error('[VideoProvider] Failed to record image metrics:', err));
      
      if (result.success) {
        console.log('[VideoProvider] Alibaba Wanx generated unique scene image');
        return {
          success: true,
          imageUrl: result.imageUrl,
          imageBase64: result.imageBase64,
          provider: 'dashscope',
        };
      }
      
      // Check for hard failure
      if (result.error && hardFailurePatterns.some(p => result.error!.toLowerCase().includes(p))) {
        console.log(`[VideoProvider] HARD FAILURE for dashscope: ${result.error}`);
        await healthMonitor.quarantineProvider('dashscope', result.error);
      }
      
      console.log(`[VideoProvider] Alibaba Wanx failed: ${result.error}`);
      return {
        success: false,
        error: result.error || 'Alibaba Wanx image generation failed',
      };
    } catch (error: any) {
      console.error('[VideoProvider] Alibaba image error:', error.message);
      if (hardFailurePatterns.some(p => error.message?.toLowerCase().includes(p))) {
        await healthMonitor.quarantineProvider('dashscope', error.message);
      }
      return {
        success: false,
        error: error.message || 'Alibaba image generation failed',
      };
    }
  } else if (healthMonitor.isProviderQuarantined('dashscope')) {
    console.log('[VideoProvider] Skipping dashscope: currently quarantined');
  }

  console.log('[VideoProvider] No image generation providers available (all quarantined or not configured)');
  return {
    success: false,
    error: 'No image providers available - all quarantined or not configured',
  };
}

export async function testProviderConnection(provider: VideoProvider): Promise<{ 
  success: boolean; 
  message: string;
  status: 'working' | 'error' | 'not_configured';
}> {
  const config = providerConfigs[provider];
  
  if (!config) {
    return {
      success: false,
      message: `Unknown provider: ${provider}`,
      status: 'error',
    };
  }

  if (!config.isConfigured()) {
    return {
      success: false,
      message: `${config.displayName} API key not configured`,
      status: 'not_configured',
    };
  }

  try {
    switch (provider) {
      case 'veo31': {
        const result = await testVeo31Connection();
        return result;
      }

      case 'veo2': {
        const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (response.ok) {
          return { success: true, message: `${config.displayName} connected`, status: 'working' };
        }
        return { success: false, message: `${config.displayName} API error: ${response.status}`, status: 'error' };
      }

      case 'runway': {
        const response = await fetch('https://api.dev.runwayml.com/v1/tasks?limit=1', {
          headers: {
            'Authorization': `Bearer ${process.env.RUNWAY_API_KEY}`,
            'X-Runway-Version': '2024-11-06',
          },
        });
        if (response.ok) {
          return { success: true, message: `${config.displayName} connected`, status: 'working' };
        }
        return { success: false, message: `${config.displayName} API error: ${response.status}`, status: 'error' };
      }

      case 'wan': {
        return { success: true, message: `${config.displayName} key configured`, status: 'working' };
      }

      case 'pika': {
        return { success: true, message: `${config.displayName} key configured`, status: 'working' };
      }

      case 'luma': {
        return { success: true, message: `${config.displayName} key configured`, status: 'working' };
      }

      case 'fal':
      case 'fal_kling':
      case 'fal_minimax': {
        const result = await testFalConnection();
        return result;
      }

      default:
        return { success: true, message: `${config.displayName} key configured`, status: 'working' };
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Connection test failed',
      status: 'error',
    };
  }
}
