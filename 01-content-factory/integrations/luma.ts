const LUMA_BASE_URL = "https://api.lumalabs.ai/dream-machine/v1";

export interface LumaVideoResult {
  success: boolean;
  taskId?: string;
  videoUrl?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export async function generateVideoWithLuma(
  prompt: string,
  options: {
    duration?: number;
    aspectRatio?: '16:9' | '9:16' | '1:1' | '3:4' | '4:3';
    loop?: boolean;
    imageUrl?: string;
    imageEndUrl?: string;
    brandProfile?: any; // BrandProfileJSON type
    brandVoice?: any; // BrandVoiceConfig type
  } = {}
): Promise<LumaVideoResult> {
  const apiKey = process.env.LUMA_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "LUMA_API_KEY not configured. Add it to your secrets.",
    };
  }

  const { 
    aspectRatio = '16:9',
    loop = false,
    imageUrl,
    imageEndUrl,
    brandProfile,
    brandVoice
  } = options;

  // Enhance prompt with brand guidelines if provided
  let enhancedPrompt = prompt;
  if (brandProfile?.visual || brandVoice) {
    const brandContext: string[] = [];
    
    if (brandProfile?.visual) {
      const v = brandProfile.visual;
      if (v.visualStyle?.description) {
        brandContext.push(`Visual Style: ${v.visualStyle.description}`);
      }
      if (v.colorPalette?.darkMode?.accent?.hex) {
        brandContext.push(`Primary Color: ${v.colorPalette.darkMode.accent.hex}`);
      }
      if (v.cinematicGuidelines?.motionStyle) {
        brandContext.push(`Motion: ${v.cinematicGuidelines.motionStyle}`);
      }
    } else if (brandVoice) {
      if (brandVoice.visualStyle) {
        brandContext.push(`Visual Style: ${brandVoice.visualStyle}`);
      }
      if (brandVoice.colorPalette?.length) {
        brandContext.push(`Colors: ${brandVoice.colorPalette.join(', ')}`);
      }
    }
    
    if (brandContext.length > 0) {
      enhancedPrompt = `${prompt}. Brand Guidelines: ${brandContext.join(', ')}`;
    }
  }

  try {
    const body: Record<string, any> = {
      prompt: enhancedPrompt,
      aspect_ratio: aspectRatio,
      loop,
    };

    if (imageUrl) {
      body.keyframes = {
        frame0: {
          type: "image",
          url: imageUrl,
        },
      };
      
      if (imageEndUrl) {
        body.keyframes.frame1 = {
          type: "image",
          url: imageEndUrl,
        };
      }
    }

    const response = await fetch(`${LUMA_BASE_URL}/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Luma] API error:", response.status, errorText);
      
      if (response.status === 429) {
        return {
          success: false,
          error: "Luma API rate limited. Falling back to next provider.",
        };
      }
      
      if (response.status === 402) {
        return {
          success: false,
          error: "Luma API credits exhausted.",
        };
      }
      
      return {
        success: false,
        error: `Luma API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    
    console.log(`[Luma] Task started: ${result.id}`);
    return {
      success: true,
      taskId: result.id,
      status: 'pending',
    };
  } catch (error: any) {
    console.error("[Luma] Video generation error:", error);
    return {
      success: false,
      error: error.message || "Failed to start video generation with Luma",
    };
  }
}

export async function checkLumaStatus(taskId: string): Promise<LumaVideoResult> {
  const apiKey = process.env.LUMA_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "LUMA_API_KEY not configured",
    };
  }

  try {
    const response = await fetch(`${LUMA_BASE_URL}/generations/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to check Luma status: ${response.status}`,
      };
    }

    const result = await response.json();
    const state = result.state?.toLowerCase();
    
    if (state === 'completed') {
      return {
        success: true,
        videoUrl: result.assets?.video,
        status: 'completed',
        taskId,
      };
    } else if (state === 'failed') {
      return {
        success: false,
        status: 'failed',
        error: result.failure_reason || 'Luma video generation failed',
        taskId,
      };
    } else if (state === 'queued' || state === 'pending') {
      return {
        success: true,
        status: 'pending',
        taskId,
      };
    } else {
      return {
        success: true,
        status: 'processing',
        taskId,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to check Luma video status",
    };
  }
}

export async function waitForLumaCompletion(
  taskId: string,
  maxWaitSeconds: number = 300,
  pollIntervalSeconds: number = 10
): Promise<LumaVideoResult> {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  const pollIntervalMs = pollIntervalSeconds * 1000;

  console.log(`[Luma] Waiting for task ${taskId} (max ${maxWaitSeconds}s)...`);

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkLumaStatus(taskId);
    
    if (status.status === 'completed') {
      console.log(`[Luma] Task ${taskId} completed: ${status.videoUrl}`);
      return status;
    }
    
    if (status.status === 'failed') {
      console.error(`[Luma] Task ${taskId} failed: ${status.error}`);
      return status;
    }
    
    console.log(`[Luma] Task ${taskId} still ${status.status}...`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return {
    success: false,
    error: `Luma video generation timed out after ${maxWaitSeconds} seconds`,
    taskId,
    status: 'processing',
  };
}

export function isLumaConfigured(): boolean {
  return !!process.env.LUMA_API_KEY;
}

export async function testLumaConnection(): Promise<{ success: boolean; message: string }> {
  const apiKey = process.env.LUMA_API_KEY;
  
  if (!apiKey) {
    return { success: false, message: "LUMA_API_KEY not configured" };
  }

  try {
    const response = await fetch(`${LUMA_BASE_URL}/ping`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      return { success: true, message: "Luma API connection successful" };
    } else if (response.status === 401) {
      return { success: false, message: "Luma API key is invalid" };
    } else {
      return { success: false, message: `Luma API returned ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to connect to Luma" };
  }
}

export async function generateLumaImageToVideo(
  imageUrl: string,
  prompt: string,
  options: {
    aspectRatio?: '16:9' | '9:16' | '1:1';
    loop?: boolean;
  } = {}
): Promise<LumaVideoResult> {
  return generateVideoWithLuma(prompt, {
    ...options,
    imageUrl,
  });
}
