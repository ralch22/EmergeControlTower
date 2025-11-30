export interface Veo31Result {
  success: boolean;
  taskId?: string;
  videoUrl?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  hasAudio?: boolean;
}

export interface Veo31Options {
  aspectRatio?: '16:9' | '9:16' | '1:1';
  duration?: 4 | 6 | 8;
  resolution?: '720p' | '1080p';
  generateAudio?: boolean;
  negativePrompt?: string;
  useLowerPriority?: boolean;
  imageUrl?: string;
  imageBase64?: string;
}

export async function generateVideoWithVeo31(
  prompt: string,
  options: Veo31Options = {}
): Promise<Veo31Result> {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY not configured for Veo 3.1",
    };
  }

  try {
    const {
      aspectRatio = '16:9',
      duration = 8,
      resolution = '720p',
      generateAudio = true,
      negativePrompt,
      useLowerPriority = false,
      imageUrl,
      imageBase64,
    } = options;

    if (aspectRatio === '1:1') {
      return {
        success: false,
        error: "Veo 3.1 does not support 1:1 aspect ratio. Please use 16:9 or 9:16.",
      };
    }

    const validAspectRatio: '16:9' | '9:16' = 
      aspectRatio === '9:16' ? '9:16' : '16:9';
    
    const validDurations = [4, 6, 8] as const;
    const snappedDuration = validDurations.reduce((prev, curr) => 
      Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
    );

    const modelId = 'veo-3.1-fast-generate-001';
    const isImageToVideo = !!(imageUrl || imageBase64);

    console.log(`[Veo3.1] Starting ${isImageToVideo ? 'image-to-video' : 'text-to-video'} generation...`);
    console.log(`[Veo3.1] Prompt: ${prompt.substring(0, 100)}...`);
    console.log(`[Veo3.1] Options: ${resolution}, ${validAspectRatio}, ${snappedDuration}s, audio=${generateAudio}`);

    const requestBody: any = {
      instances: [{
        prompt: prompt,
      }],
      parameters: {
        aspectRatio: validAspectRatio,
        sampleCount: 1,
        durationSeconds: snappedDuration,
        generateAudio: generateAudio,
      },
    };

    if (imageBase64) {
      requestBody.instances[0].image = {
        bytesBase64Encoded: imageBase64,
      };
    } else if (imageUrl) {
      requestBody.instances[0].image = {
        uri: imageUrl,
      };
    }

    if (negativePrompt) {
      requestBody.instances[0].negativePrompt = negativePrompt;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:predictLongRunning?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Veo3.1] API error:", response.status, errorText);
      
      if (response.status === 403 || response.status === 401) {
        return {
          success: false,
          error: "Veo 3.1 requires billing enabled and Ultra tier access",
        };
      }
      
      if (response.status === 404) {
        return {
          success: false,
          error: "Veo 3.1 model not available - check your API access tier",
        };
      }

      if (response.status === 429) {
        return {
          success: false,
          error: "Veo 3.1 rate limit exceeded - try again later or use lower priority tier",
        };
      }
      
      return {
        success: false,
        error: `Veo 3.1 API error: ${response.status} - ${errorText.substring(0, 200)}`,
      };
    }

    const result = await response.json();
    
    if (result.name) {
      console.log(`[Veo3.1] Operation started: ${result.name}`);
      return {
        success: true,
        taskId: result.name,
        status: 'processing',
        hasAudio: generateAudio,
      };
    }

    const videos = result.predictions || result.videos || result.generatedVideos;
    if (videos?.[0]) {
      const videoUrl = videos[0].video?.uri || videos[0].uri || videos[0].videoUri;
      if (videoUrl) {
        console.log(`[Veo3.1] Video immediately available: ${videoUrl}`);
        return {
          success: true,
          videoUrl: videoUrl,
          status: 'completed',
          hasAudio: generateAudio,
        };
      }
    }

    return {
      success: false,
      error: "Unexpected response format from Veo 3.1",
    };
  } catch (error: any) {
    console.error("[Veo3.1] Video generation error:", error);
    return {
      success: false,
      error: error.message || "Failed to start video generation with Veo 3.1",
    };
  }
}

export async function checkVeo31Status(operationName: string): Promise<Veo31Result> {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY not configured",
    };
  }

  try {
    const url = operationName.startsWith('http') 
      ? operationName 
      : `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Status check failed: ${response.status} - ${errorText.substring(0, 200)}`,
      };
    }

    const operation = await response.json();
    
    if (operation.done) {
      if (operation.error) {
        return {
          success: false,
          status: 'failed',
          error: operation.error.message || 'Video generation failed',
        };
      }

      const result = operation.response || operation.result || operation.metadata;
      const videos = result?.predictions || result?.videos || result?.generatedVideos;
      
      if (videos?.length > 0) {
        const videoUrl = videos[0].video?.uri || videos[0].uri || videos[0].videoUri;
        if (videoUrl) {
          return {
            success: true,
            taskId: operationName,
            videoUrl: videoUrl,
            status: 'completed',
            hasAudio: true,
          };
        }
      }

      return {
        success: false,
        status: 'failed',
        error: 'No videos were generated',
      };
    }

    const progress = operation.metadata?.progress;
    if (progress !== undefined) {
      console.log(`[Veo3.1] Generation progress: ${progress}%`);
    }

    return {
      success: true,
      taskId: operationName,
      status: 'processing',
    };
  } catch (error: any) {
    console.error("[Veo3.1] Status check error:", error);
    return {
      success: false,
      error: error.message || "Failed to check video status",
    };
  }
}

export async function waitForVeo31Completion(
  operationName: string,
  maxWaitSeconds: number = 600,
  pollIntervalSeconds: number = 10
): Promise<Veo31Result> {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

  console.log(`[Veo3.1] Waiting for video completion: ${operationName}`);

  while (Date.now() - startTime < maxWaitMs) {
    const result = await checkVeo31Status(operationName);

    if (result.status === 'completed') {
      console.log(`[Veo3.1] Video completed: ${result.videoUrl}`);
      return result;
    }

    if (result.status === 'failed' || (!result.success && result.status !== 'processing')) {
      console.error(`[Veo3.1] Video failed: ${result.error}`);
      return result;
    }

    console.log(`[Veo3.1] Still processing, waiting ${pollIntervalSeconds}s...`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalSeconds * 1000));
  }

  return {
    success: false,
    taskId: operationName,
    status: 'processing',
    error: `Timeout after ${maxWaitSeconds} seconds`,
  };
}

export async function testVeo31Connection(): Promise<{ 
  success: boolean; 
  message: string;
  status: 'working' | 'error' | 'not_configured';
  tier?: string;
}> {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      message: "GEMINI_API_KEY not configured",
      status: 'not_configured',
    };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (response.ok) {
      const data = await response.json();
      const hasVeo31 = data.models?.some((m: any) => 
        m.name?.includes('veo-3.1') || m.name?.includes('veo-3')
      );
      const hasVeo31Fast = data.models?.some((m: any) => 
        m.name?.includes('veo-3.1-fast')
      );
      
      if (hasVeo31Fast) {
        return { 
          success: true, 
          message: "Veo 3.1 Fast connected (Ultra tier)", 
          status: 'working',
          tier: 'ultra',
        };
      }
      if (hasVeo31) {
        return { 
          success: true, 
          message: "Veo 3.1 connected", 
          status: 'working',
          tier: 'standard',
        };
      }
      return { 
        success: true, 
        message: "Gemini API connected (Veo 3.1 may require Ultra tier)", 
        status: 'working',
        tier: 'unknown',
      };
    }
    
    return { 
      success: false, 
      message: `API error: ${response.status}`, 
      status: 'error' 
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Connection test failed',
      status: 'error',
    };
  }
}

export async function generateImageToVideoWithVeo31(
  imageBase64: string,
  prompt: string,
  options: Veo31Options = {}
): Promise<Veo31Result> {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY not configured for Veo 3.1",
    };
  }

  try {
    const {
      aspectRatio = '16:9',
      duration = 8,
      generateAudio = true,
    } = options;

    console.log(`[Veo3.1] Starting image-to-video generation...`);

    const requestBody = {
      instances: [{
        prompt: prompt,
        image: {
          bytesBase64Encoded: imageBase64,
        },
      }],
      parameters: {
        aspectRatio: aspectRatio,
        sampleCount: 1,
        durationSeconds: duration,
        generateAudio: generateAudio,
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-fast-generate-001:predictLongRunning?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Veo3.1] Image-to-video API error:", response.status, errorText);
      return {
        success: false,
        error: `Veo 3.1 image-to-video error: ${response.status}`,
      };
    }

    const result = await response.json();
    
    if (result.name) {
      return {
        success: true,
        taskId: result.name,
        status: 'processing',
        hasAudio: generateAudio,
      };
    }

    return {
      success: false,
      error: "Unexpected response format from Veo 3.1 image-to-video",
    };
  } catch (error: any) {
    console.error("[Veo3.1] Image-to-video error:", error);
    return {
      success: false,
      error: error.message || "Failed to start image-to-video generation",
    };
  }
}
