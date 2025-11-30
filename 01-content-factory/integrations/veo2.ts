export interface Veo2Result {
  success: boolean;
  taskId?: string;
  videoUrl?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export interface Veo2Options {
  aspectRatio?: '16:9' | '9:16';
  duration?: 5 | 6 | 7 | 8;
  personGeneration?: 'DONT_ALLOW' | 'ALLOW_ADULT' | 'ALLOW_ALL';
}

export async function generateVideoWithVeo2(
  prompt: string,
  options: Veo2Options = {}
): Promise<Veo2Result> {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY not configured for Veo 2.0",
    };
  }

  try {
    const {
      aspectRatio = '16:9',
      duration = 8,
      personGeneration = 'ALLOW_ALL',
    } = options;

    console.log(`[Veo2] Starting video generation with prompt: ${prompt.substring(0, 100)}...`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:generateVideo?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          config: {
            aspectRatio: aspectRatio,
            numberOfVideos: 1,
            durationSeconds: duration,
            personGeneration: personGeneration,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Veo2] API error:", response.status, errorText);
      
      if (response.status === 403 || response.status === 401) {
        return {
          success: false,
          error: "Veo 2.0 requires billing enabled and may have waitlist access restrictions",
        };
      }
      
      if (response.status === 404) {
        return {
          success: false,
          error: "Veo 2.0 model not available - may require waitlist access",
        };
      }
      
      return {
        success: false,
        error: `Veo 2.0 API error: ${response.status} - ${errorText.substring(0, 200)}`,
      };
    }

    const result = await response.json();
    
    if (result.name) {
      console.log(`[Veo2] Operation started: ${result.name}`);
      return {
        success: true,
        taskId: result.name,
        status: 'processing',
      };
    }

    const videos = result.generatedVideos || result.videos;
    if (videos?.[0]?.video?.uri) {
      console.log(`[Veo2] Video immediately available: ${videos[0].video.uri}`);
      return {
        success: true,
        videoUrl: videos[0].video.uri,
        status: 'completed',
      };
    }
    
    if (videos?.[0]?.uri) {
      console.log(`[Veo2] Video immediately available: ${videos[0].uri}`);
      return {
        success: true,
        videoUrl: videos[0].uri,
        status: 'completed',
      };
    }

    return {
      success: false,
      error: "Unexpected response format from Veo 2.0",
    };
  } catch (error: any) {
    console.error("[Veo2] Video generation error:", error);
    return {
      success: false,
      error: error.message || "Failed to start video generation with Veo 2.0",
    };
  }
}

export async function checkVeo2Status(operationName: string): Promise<Veo2Result> {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY not configured",
    };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

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

      const result = operation.response || operation.result;
      const videos = result?.generatedVideos || result?.videos;
      
      if (videos?.length > 0) {
        const videoUri = videos[0].video?.uri || videos[0].uri;
        if (videoUri) {
          return {
            success: true,
            taskId: operationName,
            videoUrl: videoUri,
            status: 'completed',
          };
        }
      }

      return {
        success: false,
        status: 'failed',
        error: 'No videos were generated',
      };
    }

    return {
      success: true,
      taskId: operationName,
      status: 'processing',
    };
  } catch (error: any) {
    console.error("[Veo2] Status check error:", error);
    return {
      success: false,
      error: error.message || "Failed to check video status",
    };
  }
}

export async function waitForVeo2Completion(
  operationName: string,
  maxWaitSeconds: number = 600,
  pollIntervalSeconds: number = 10
): Promise<Veo2Result> {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;

  console.log(`[Veo2] Waiting for video completion: ${operationName}`);

  while (Date.now() - startTime < maxWaitMs) {
    const result = await checkVeo2Status(operationName);

    if (result.status === 'completed') {
      console.log(`[Veo2] Video completed: ${result.videoUrl}`);
      return result;
    }

    if (result.status === 'failed' || (!result.success && result.status !== 'processing')) {
      console.error(`[Veo2] Video failed: ${result.error}`);
      return result;
    }

    console.log(`[Veo2] Still processing, waiting ${pollIntervalSeconds}s...`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalSeconds * 1000));
  }

  return {
    success: false,
    taskId: operationName,
    status: 'processing',
    error: `Timeout after ${maxWaitSeconds} seconds`,
  };
}

export async function testVeo2Connection(): Promise<{ 
  success: boolean; 
  message: string;
  status: 'working' | 'error' | 'not_configured';
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
      const hasVeo2 = data.models?.some((m: any) => 
        m.name?.includes('veo-2') || m.name?.includes('veo2')
      );
      
      if (hasVeo2) {
        return { 
          success: true, 
          message: "Veo 2.0 connected", 
          status: 'working' 
        };
      }
      return { 
        success: true, 
        message: "Gemini API connected (Veo 2.0 may require waitlist access)", 
        status: 'working' 
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
