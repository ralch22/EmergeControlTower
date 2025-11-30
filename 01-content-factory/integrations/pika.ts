const PIKA_BASE_URL = "https://api.pika.art/v1";

export interface PikaVideoResult {
  success: boolean;
  taskId?: string;
  videoUrl?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

export async function generateVideoWithPika(
  prompt: string,
  options: {
    duration?: number;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    style?: string;
    imageUrl?: string;
  } = {}
): Promise<PikaVideoResult> {
  const apiKey = process.env.PIKA_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "PIKA_API_KEY not configured. Add it to your secrets.",
    };
  }

  const { 
    duration = 3, 
    aspectRatio = '16:9',
    style = 'cinematic',
    imageUrl
  } = options;

  try {
    const endpoint = imageUrl ? '/image-to-video' : '/text-to-video';
    
    const body: Record<string, any> = {
      prompt,
      style,
      duration,
      aspect_ratio: aspectRatio,
    };

    if (imageUrl) {
      body.image_url = imageUrl;
    }

    const response = await fetch(`${PIKA_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Pika] API error:", response.status, errorText);
      
      if (response.status === 429) {
        return {
          success: false,
          error: "Pika API rate limited. Falling back to next provider.",
        };
      }
      
      return {
        success: false,
        error: `Pika API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    
    return {
      success: true,
      taskId: result.id || result.generation_id,
      status: 'pending',
    };
  } catch (error: any) {
    console.error("[Pika] Video generation error:", error);
    return {
      success: false,
      error: error.message || "Failed to start video generation with Pika",
    };
  }
}

export async function checkPikaStatus(taskId: string): Promise<PikaVideoResult> {
  const apiKey = process.env.PIKA_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "PIKA_API_KEY not configured",
    };
  }

  try {
    const response = await fetch(`${PIKA_BASE_URL}/generations/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to check Pika status: ${response.status}`,
      };
    }

    const result = await response.json();
    const status = result.status?.toLowerCase();
    
    if (status === 'completed' || status === 'succeeded') {
      return {
        success: true,
        videoUrl: result.video_url || result.output?.video_url,
        status: 'completed',
        taskId,
      };
    } else if (status === 'failed' || status === 'error') {
      return {
        success: false,
        status: 'failed',
        error: result.error || 'Pika video generation failed',
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
      error: error.message || "Failed to check Pika video status",
    };
  }
}

export async function waitForPikaCompletion(
  taskId: string,
  maxWaitSeconds: number = 180,
  pollIntervalSeconds: number = 10
): Promise<PikaVideoResult> {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  const pollIntervalMs = pollIntervalSeconds * 1000;

  console.log(`[Pika] Waiting for task ${taskId} (max ${maxWaitSeconds}s)...`);

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkPikaStatus(taskId);
    
    if (status.status === 'completed') {
      console.log(`[Pika] Task ${taskId} completed: ${status.videoUrl}`);
      return status;
    }
    
    if (status.status === 'failed') {
      console.error(`[Pika] Task ${taskId} failed: ${status.error}`);
      return status;
    }
    
    console.log(`[Pika] Task ${taskId} still processing...`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return {
    success: false,
    error: `Pika video generation timed out after ${maxWaitSeconds} seconds`,
    taskId,
    status: 'processing',
  };
}

export function isPikaConfigured(): boolean {
  return !!process.env.PIKA_API_KEY;
}

export async function testPikaConnection(): Promise<{ success: boolean; message: string }> {
  const apiKey = process.env.PIKA_API_KEY;
  
  if (!apiKey) {
    return { success: false, message: "PIKA_API_KEY not configured" };
  }

  try {
    const response = await fetch(`${PIKA_BASE_URL}/user`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return { success: true, message: "Pika API connection successful" };
    } else if (response.status === 401) {
      return { success: false, message: "Pika API key is invalid" };
    } else {
      return { success: false, message: `Pika API returned ${response.status}` };
    }
  } catch (error: any) {
    return { success: false, message: error.message || "Failed to connect to Pika" };
  }
}
