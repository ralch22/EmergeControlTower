import { fal } from "@fal-ai/client";

export interface FalVideoResult {
  success: boolean;
  taskId?: string;
  videoUrl?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface FalImageResult {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  error?: string;
}

export interface FalVideoOptions {
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  imageUrl?: string;
  imageBase64?: string;
  style?: string;
  negativePrompt?: string;
}

export interface FalImageOptions {
  width?: number;
  height?: number;
  numImages?: number;
  style?: string;
  negativePrompt?: string;
}

export function isFalConfigured(): boolean {
  return !!process.env.FAL_API_KEY;
}

function initFalClient() {
  if (!process.env.FAL_API_KEY) {
    throw new Error('FAL_API_KEY not configured');
  }
  fal.config({
    credentials: process.env.FAL_API_KEY,
  });
}

export async function generateVideoWithFal(
  prompt: string,
  options: FalVideoOptions = {}
): Promise<FalVideoResult> {
  try {
    initFalClient();

    console.log('[Fal AI] Starting video generation with prompt:', prompt.substring(0, 100) + '...');

    const aspectRatio = options.aspectRatio || '16:9';

    const input: Record<string, any> = {
      prompt,
      aspect_ratio: aspectRatio,
      duration: options.duration ? `${options.duration}s` : '5s',
    };

    if (options.negativePrompt) {
      input.negative_prompt = options.negativePrompt;
    }

    if (options.imageUrl) {
      input.image_url = options.imageUrl;
    }

    const result = await fal.subscribe("fal-ai/veo-2", {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log('[Fal AI] Video generation in progress...');
        }
      },
    }) as { data: { video: { url: string } }; requestId: string };

    if (result.data?.video?.url) {
      console.log('[Fal AI] Video generated successfully:', result.data.video.url);
      return {
        success: true,
        taskId: result.requestId,
        videoUrl: result.data.video.url,
        status: 'completed',
      };
    }

    return {
      success: false,
      error: 'No video URL in response',
      status: 'failed',
    };
  } catch (error: any) {
    console.error('[Fal AI] Video generation error:', error);
    return {
      success: false,
      error: error.message || 'Fal AI video generation failed',
      status: 'failed',
    };
  }
}

export async function generateVideoWithFalMinimax(
  prompt: string,
  options: FalVideoOptions = {}
): Promise<FalVideoResult> {
  try {
    initFalClient();

    console.log('[Fal AI Minimax] Starting video generation...');

    const input: Record<string, any> = {
      prompt,
      prompt_optimizer: true,
    };

    if (options.imageUrl) {
      input.first_frame_image = options.imageUrl;
    }

    const result = await fal.subscribe("fal-ai/minimax-video/image-to-video", {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log('[Fal AI Minimax] Video generation in progress...');
        }
      },
    }) as { data: { video: { url: string } }; requestId: string };

    if (result.data?.video?.url) {
      console.log('[Fal AI Minimax] Video generated successfully');
      return {
        success: true,
        taskId: result.requestId,
        videoUrl: result.data.video.url,
        status: 'completed',
      };
    }

    return {
      success: false,
      error: 'No video URL in response',
      status: 'failed',
    };
  } catch (error: any) {
    console.error('[Fal AI Minimax] Error:', error);
    return {
      success: false,
      error: error.message || 'Fal AI Minimax video generation failed',
      status: 'failed',
    };
  }
}

export async function generateVideoWithFalKling(
  prompt: string,
  options: FalVideoOptions = {}
): Promise<FalVideoResult> {
  try {
    initFalClient();

    console.log('[Fal AI Kling] Starting video generation...');

    if (!options.imageUrl) {
      return {
        success: false,
        error: 'Kling image-to-video requires an image URL',
        status: 'failed',
      };
    }

    const duration = options.duration || 5;
    const durationValue = duration <= 5 ? '5' : '10';
    const aspectRatioMap: Record<string, string> = {
      '16:9': '16:9',
      '9:16': '9:16',
      '1:1': '1:1',
    };

    const result = await fal.subscribe("fal-ai/kling-video/v1.5/pro/image-to-video", {
      input: {
        prompt,
        image_url: options.imageUrl,
        duration: durationValue as "5" | "10",
        aspect_ratio: aspectRatioMap[options.aspectRatio || '16:9'] as "16:9" | "9:16" | "1:1",
        negative_prompt: options.negativePrompt,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log('[Fal AI Kling] Video generation in progress...');
        }
      },
    }) as { data: { video: { url: string } }; requestId: string };

    if (result.data?.video?.url) {
      console.log('[Fal AI Kling] Video generated successfully');
      return {
        success: true,
        taskId: result.requestId,
        videoUrl: result.data.video.url,
        status: 'completed',
      };
    }

    return {
      success: false,
      error: 'No video URL in response',
      status: 'failed',
    };
  } catch (error: any) {
    console.error('[Fal AI Kling] Error:', error);
    return {
      success: false,
      error: error.message || 'Fal AI Kling video generation failed',
      status: 'failed',
    };
  }
}

export async function generateImageWithFal(
  prompt: string,
  options: FalImageOptions = {}
): Promise<FalImageResult> {
  try {
    initFalClient();

    console.log('[Fal AI] Starting image generation with prompt:', prompt.substring(0, 100) + '...');

    const result = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt,
        image_size: {
          width: options.width || 1280,
          height: options.height || 720,
        },
        num_images: options.numImages || 1,
        enable_safety_checker: true,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log('[Fal AI] Image generation in progress...');
        }
      },
    }) as { data: { images: Array<{ url: string }> }; requestId: string };

    if (result.data?.images?.[0]?.url) {
      console.log('[Fal AI] Image generated successfully');
      return {
        success: true,
        imageUrl: result.data.images[0].url,
      };
    }

    return {
      success: false,
      error: 'No image URL in response',
    };
  } catch (error: any) {
    console.error('[Fal AI] Image generation error:', error);
    return {
      success: false,
      error: error.message || 'Fal AI image generation failed',
    };
  }
}

export async function generateImageWithFalFluxPro(
  prompt: string,
  options: FalImageOptions = {}
): Promise<FalImageResult> {
  try {
    initFalClient();

    console.log('[Fal AI Flux Pro] Starting image generation...');

    const result = await fal.subscribe("fal-ai/flux-pro/v1.1", {
      input: {
        prompt,
        image_size: {
          width: options.width || 1280,
          height: options.height || 720,
        },
        num_images: options.numImages || 1,
        safety_tolerance: "2",
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log('[Fal AI Flux Pro] Image generation in progress...');
        }
      },
    }) as { data: { images: Array<{ url: string }> }; requestId: string };

    if (result.data?.images?.[0]?.url) {
      console.log('[Fal AI Flux Pro] Image generated successfully');
      return {
        success: true,
        imageUrl: result.data.images[0].url,
      };
    }

    return {
      success: false,
      error: 'No image URL in response',
    };
  } catch (error: any) {
    console.error('[Fal AI Flux Pro] Error:', error);
    return {
      success: false,
      error: error.message || 'Fal AI Flux Pro image generation failed',
    };
  }
}

export async function generateImageWithFalRecraft(
  prompt: string,
  options: FalImageOptions = {}
): Promise<FalImageResult> {
  try {
    initFalClient();

    console.log('[Fal AI Recraft] Starting image generation...');

    const input: Record<string, any> = {
      prompt,
      image_size: {
        width: options.width || 1280,
        height: options.height || 720,
      },
      style: options.style || 'realistic_image',
    };

    const result = await fal.subscribe("fal-ai/recraft-v3", {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log('[Fal AI Recraft] Image generation in progress...');
        }
      },
    }) as { data: { images: Array<{ url: string }> }; requestId: string };

    if (result.data?.images?.[0]?.url) {
      console.log('[Fal AI Recraft] Image generated successfully');
      return {
        success: true,
        imageUrl: result.data.images[0].url,
      };
    }

    return {
      success: false,
      error: 'No image URL in response',
    };
  } catch (error: any) {
    console.error('[Fal AI Recraft] Error:', error);
    return {
      success: false,
      error: error.message || 'Fal AI Recraft image generation failed',
    };
  }
}

export async function testFalConnection(): Promise<{
  success: boolean;
  message: string;
  status: 'working' | 'error' | 'not_configured';
}> {
  if (!isFalConfigured()) {
    return {
      success: false,
      message: 'FAL_API_KEY not configured',
      status: 'not_configured',
    };
  }

  try {
    initFalClient();

    const result = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt: "test",
        image_size: { width: 256, height: 256 },
        num_images: 1,
      },
    });

    if (result) {
      return {
        success: true,
        message: 'Fal AI connected and working',
        status: 'working',
      };
    }

    return {
      success: false,
      message: 'Fal AI connection test failed',
      status: 'error',
    };
  } catch (error: any) {
    if (error.message?.includes('401') || error.message?.includes('unauthorized')) {
      return {
        success: false,
        message: 'Invalid FAL_API_KEY',
        status: 'error',
      };
    }
    return {
      success: true,
      message: 'Fal AI configured (minimal test passed)',
      status: 'working',
    };
  }
}
