import { generateVideoWithRunway, checkVideoStatus, waitForVideoCompletion } from './runway';
import { generateVideoWithWan, checkWanTaskStatus, waitForWanCompletion } from './wan';
import { generateVideoWithPika, checkPikaStatus, waitForPikaCompletion } from './pika';
import { generateVideoWithLuma, checkLumaStatus, waitForLumaCompletion } from './luma';
import { generateVideoWithVeo2, checkVeo2Status, waitForVeo2Completion } from './veo2';
import { generateVideoWithVeo31, checkVeo31Status, waitForVeo31Completion, testVeo31Connection } from './veo31';
import { generateSceneImageWithRetry, isDalleConfigured } from './dalle-images';

export interface VideoProviderResult {
  success: boolean;
  provider?: string;
  taskId?: string;
  videoUrl?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  imageUrl?: string;
  fallbackAttempts?: number;
}

export type VideoProvider = 'veo31' | 'veo2' | 'runway' | 'wan' | 'pika' | 'luma' | 'kling' | 'hailuo';

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
    displayName: 'Runway Gen-3',
    isConfigured: () => !!process.env.RUNWAY_API_KEY,
    generate: async (prompt, options) => {
      const runwayAspect = options.aspectRatio === '1:1' ? '16:9' : (options.aspectRatio || '16:9');
      const result = await generateVideoWithRunway(prompt, {
        duration: options.duration || 5,
        aspectRatio: runwayAspect as '16:9' | '9:16',
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
};

export interface EnabledProvider {
  name: VideoProvider;
  priority: number;
  isEnabled: boolean;
}

export async function generateVideoWithFallback(
  prompt: string,
  enabledProviders: EnabledProvider[],
  options: VideoGenerationOptions = {}
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

    if (!config.isConfigured()) {
      console.log(`[VideoProvider] ${config.displayName} not configured, trying next...`);
      continue;
    }

    attempts++;
    console.log(`[VideoProvider] Attempting with ${config.displayName}...`);

    try {
      const result = await config.generate(prompt, options);
      
      if (result.success) {
        console.log(`[VideoProvider] ${config.displayName} started task: ${result.taskId}`);
        return {
          ...result,
          fallbackAttempts: attempts,
        };
      }

      console.log(`[VideoProvider] ${config.displayName} failed: ${result.error}`);
      lastError = result.error || 'Unknown error';
      
      if (result.error?.includes('rate limit')) {
        console.log(`[VideoProvider] Rate limited, trying next provider...`);
        continue;
      }
      
    } catch (error: any) {
      console.error(`[VideoProvider] ${config.displayName} error:`, error);
      lastError = error.message || 'Provider error';
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

export async function generateUniqueSceneImage(prompt: string): Promise<{
  success: boolean;
  imageBase64?: string;
  imageUrl?: string;
  error?: string;
}> {
  if (!isDalleConfigured()) {
    console.log('[VideoProvider] DALL-E not configured for image generation');
    return {
      success: false,
      error: 'DALL-E not configured - add OpenAI integration for unique scene images',
    };
  }

  console.log('[VideoProvider] Generating unique scene image with DALL-E...');
  const result = await generateSceneImageWithRetry(prompt, 2);
  
  if (result.success) {
    console.log('[VideoProvider] DALL-E generated unique scene image');
  }
  
  return result;
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
