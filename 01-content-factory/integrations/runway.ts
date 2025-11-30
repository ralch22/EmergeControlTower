const RUNWAY_BASE_URL = "https://api.runwayml.com/v1";

export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  taskId?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export async function generateVideoWithRunway(
  prompt: string,
  options: {
    duration?: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    model?: 'gen3a_turbo' | 'gen3';
  } = {}
): Promise<VideoGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "RUNWAY_API_KEY not configured. Add it to your secrets.",
    };
  }

  const { duration = 4, aspectRatio = '16:9', model = 'gen3a_turbo' } = options;

  try {
    const response = await fetch(`${RUNWAY_BASE_URL}/image_to_video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        promptText: prompt,
        model,
        duration,
        ratio: aspectRatio,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Runway API error:", response.status, errorText);
      return {
        success: false,
        error: `Runway API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    
    return {
      success: true,
      taskId: result.id,
      status: 'pending',
    };
  } catch (error: any) {
    console.error("Runway video generation error:", error);
    return {
      success: false,
      error: error.message || "Failed to start video generation",
    };
  }
}

export async function checkVideoStatus(taskId: string): Promise<VideoGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "RUNWAY_API_KEY not configured",
    };
  }

  try {
    const response = await fetch(`${RUNWAY_BASE_URL}/tasks/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Runway-Version': '2024-11-06',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to check status: ${response.status}`,
      };
    }

    const result = await response.json();
    
    if (result.status === 'SUCCEEDED') {
      return {
        success: true,
        videoUrl: result.output?.[0],
        status: 'completed',
        taskId,
      };
    } else if (result.status === 'FAILED') {
      return {
        success: false,
        status: 'failed',
        error: result.failure || 'Video generation failed',
        taskId,
      };
    } else {
      return {
        success: true,
        status: result.status === 'PENDING' ? 'pending' : 'processing',
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

export async function generateVideoFromText(
  scriptDescription: string,
  visualStyle: string = "cinematic, professional"
): Promise<VideoGenerationResult> {
  const prompt = `${scriptDescription}. Visual style: ${visualStyle}, high quality, smooth motion, professional production value.`;
  
  return generateVideoWithRunway(prompt, {
    duration: 4,
    aspectRatio: '16:9',
    model: 'gen3a_turbo',
  });
}

export async function generateSocialVideo(
  topic: string,
  platform: 'tiktok' | 'reels' | 'shorts' | 'linkedin',
  mood: string = "engaging, dynamic"
): Promise<VideoGenerationResult> {
  const platformConfigs: Record<string, { aspectRatio: '16:9' | '9:16' | '1:1'; style: string }> = {
    tiktok: { aspectRatio: '9:16', style: "trendy, fast-paced, attention-grabbing" },
    reels: { aspectRatio: '9:16', style: "vibrant, lifestyle-focused, scroll-stopping" },
    shorts: { aspectRatio: '9:16', style: "dynamic, engaging, quick cuts" },
    linkedin: { aspectRatio: '16:9', style: "professional, polished, business-focused" },
  };

  const config = platformConfigs[platform];
  const prompt = `Create a ${platform} video about: ${topic}. Style: ${config.style}, ${mood}`;
  
  return generateVideoWithRunway(prompt, {
    duration: 4,
    aspectRatio: config.aspectRatio,
    model: 'gen3a_turbo',
  });
}

export async function waitForVideoCompletion(
  taskId: string,
  maxWaitSeconds: number = 120,
  pollIntervalSeconds: number = 5
): Promise<VideoGenerationResult> {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  const pollIntervalMs = pollIntervalSeconds * 1000;

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkVideoStatus(taskId);
    
    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }
    
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return {
    success: false,
    error: `Video generation timed out after ${maxWaitSeconds} seconds`,
    taskId,
    status: 'processing',
  };
}
