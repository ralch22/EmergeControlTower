function getApiBaseUrl(): string {
  const useInternational = process.env.DASHSCOPE_REGION === 'international' || 
                           process.env.DASHSCOPE_REGION === 'intl' ||
                           process.env.DASHSCOPE_REGION === 'singapore';
  
  if (useInternational) {
    return 'https://dashscope-intl.aliyuncs.com/api/v1';
  }
  
  return 'https://dashscope.aliyuncs.com/api/v1';
}

export interface WanVideoResult {
  success: boolean;
  taskId?: string;
  videoUrl?: string;
  status?: 'pending' | 'running' | 'succeeded' | 'failed';
  error?: string;
}

export async function generateVideoWithWan(
  prompt: string,
  options: {
    duration?: number;
    resolution?: '480p' | '720p' | '1080p';
    aspectRatio?: '16:9' | '9:16' | '1:1';
    model?: string;
  } = {}
): Promise<WanVideoResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "DASHSCOPE_API_KEY not configured. Add it to your secrets.",
    };
  }

  const { 
    duration = 5, 
    resolution = '720p', 
    aspectRatio = '16:9',
    model = 'wan2.5-t2v-preview'
  } = options;

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/services/aigc/video-generation/video-synthesis`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({
          model,
          input: {
            prompt,
          },
          parameters: {
            duration,
            resolution: resolution.toUpperCase().replace('P', ''),
            aspect_ratio: aspectRatio,
            prompt_extend: true,
            watermark: false,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Wan] API error:", response.status, errorText);
      return {
        success: false,
        error: `Wan API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    
    if (result.output?.task_id) {
      console.log(`[Wan] Task started: ${result.output.task_id}`);
      return {
        success: true,
        taskId: result.output.task_id,
        status: 'pending',
      };
    }

    return {
      success: false,
      error: "No task ID returned from Wan API",
    };
  } catch (error: any) {
    console.error("[Wan] Video generation error:", error);
    return {
      success: false,
      error: error.message || "Failed to start video generation",
    };
  }
}

export async function checkWanTaskStatus(taskId: string): Promise<WanVideoResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "DASHSCOPE_API_KEY not configured",
    };
  }

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/tasks/${taskId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to check status: ${response.status}`,
      };
    }

    const result = await response.json();
    const status = result.output?.task_status?.toLowerCase();
    
    if (status === 'succeeded') {
      const videoUrl = result.output?.video_url || result.output?.results?.video_url;
      return {
        success: true,
        videoUrl,
        status: 'succeeded',
        taskId,
      };
    } else if (status === 'failed') {
      return {
        success: false,
        status: 'failed',
        error: result.output?.message || 'Video generation failed',
        taskId,
      };
    } else {
      return {
        success: true,
        status: status === 'pending' ? 'pending' : 'running',
        taskId,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to check video status",
    };
  }
}

export async function waitForWanCompletion(
  taskId: string,
  maxWaitSeconds: number = 300,
  pollIntervalSeconds: number = 15
): Promise<WanVideoResult> {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  const pollIntervalMs = pollIntervalSeconds * 1000;

  console.log(`[Wan] Waiting for task ${taskId} (max ${maxWaitSeconds}s)...`);

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkWanTaskStatus(taskId);
    
    if (status.status === 'succeeded') {
      console.log(`[Wan] Task ${taskId} completed: ${status.videoUrl}`);
      return status;
    }
    
    if (status.status === 'failed') {
      console.error(`[Wan] Task ${taskId} failed: ${status.error}`);
      return status;
    }
    
    console.log(`[Wan] Task ${taskId} still ${status.status}...`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return {
    success: false,
    error: `Video generation timed out after ${maxWaitSeconds} seconds`,
    taskId,
    status: 'running',
  };
}

export async function generateImageToVideoWithWan(
  imageUrl: string,
  prompt: string,
  options: {
    duration?: number;
    model?: string;
  } = {}
): Promise<WanVideoResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "DASHSCOPE_API_KEY not configured",
    };
  }

  const { duration = 5, model = 'wanx2.1-i2v-turbo' } = options;

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/services/aigc/video-generation/video-synthesis`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({
          model,
          input: {
            img_url: imageUrl,
            prompt,
          },
          parameters: {
            duration,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Wan I2V] API error:", response.status, errorText);
      return {
        success: false,
        error: `Wan I2V API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    
    return {
      success: true,
      taskId: result.output?.task_id,
      status: 'pending',
    };
  } catch (error: any) {
    console.error("[Wan I2V] Error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
