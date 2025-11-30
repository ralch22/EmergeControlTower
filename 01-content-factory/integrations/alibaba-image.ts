export interface AlibabaImageResult {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  taskId?: string;
  status?: 'pending' | 'running' | 'succeeded' | 'failed';
  error?: string;
}

export interface AlibabaImageOptions {
  size?: '1024*1024' | '720*1280' | '1280*720';
  style?: string;
  negativePrompt?: string;
}

async function submitImageTask(
  prompt: string,
  options: AlibabaImageOptions = {}
): Promise<AlibabaImageResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'DASHSCOPE_API_KEY not configured',
    };
  }

  try {
    const { size = '1280*720', style = '', negativePrompt = '' } = options;
    
    const enhancedPrompt = style 
      ? `${prompt}, ${style}, professional quality, cinematic lighting`
      : `${prompt}, professional quality, cinematic lighting, 4K resolution`;
    
    console.log(`[AlibabaImage] Submitting image generation task...`);
    console.log(`[AlibabaImage] Prompt: ${enhancedPrompt.substring(0, 100)}...`);

    const response = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({
          model: 'wanx-v1',
          input: {
            prompt: enhancedPrompt,
            negative_prompt: negativePrompt || 'blurry, low quality, watermark, text overlay',
          },
          parameters: {
            size: size,
            n: 1,
            style: '<auto>',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AlibabaImage] API error:', response.status, errorText);
      return {
        success: false,
        error: `Alibaba Image API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    
    if (result.output?.task_id) {
      console.log(`[AlibabaImage] Task submitted: ${result.output.task_id}`);
      return {
        success: true,
        taskId: result.output.task_id,
        status: 'pending',
      };
    }

    return {
      success: false,
      error: 'No task ID in response',
    };
  } catch (error: any) {
    console.error('[AlibabaImage] Submit error:', error);
    return {
      success: false,
      error: error.message || 'Failed to submit image task',
    };
  }
}

async function checkImageTaskStatus(taskId: string): Promise<AlibabaImageResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: 'DASHSCOPE_API_KEY not configured',
    };
  }

  try {
    const response = await fetch(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        taskId,
        error: `Status check failed: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    const taskStatus = result.output?.task_status;

    if (taskStatus === 'SUCCEEDED') {
      const imageUrl = result.output?.results?.[0]?.url;
      if (imageUrl) {
        console.log(`[AlibabaImage] Task ${taskId} completed successfully`);
        return {
          success: true,
          taskId,
          imageUrl,
          status: 'succeeded',
        };
      }
      return {
        success: false,
        taskId,
        status: 'succeeded',
        error: 'No image URL in completed task',
      };
    }

    if (taskStatus === 'FAILED') {
      const errorMessage = result.output?.message || 'Task failed';
      console.error(`[AlibabaImage] Task ${taskId} failed: ${errorMessage}`);
      return {
        success: false,
        taskId,
        status: 'failed',
        error: errorMessage,
      };
    }

    const statusMap: Record<string, 'pending' | 'running'> = {
      'PENDING': 'pending',
      'RUNNING': 'running',
    };

    return {
      success: true,
      taskId,
      status: statusMap[taskStatus] || 'running',
    };
  } catch (error: any) {
    console.error('[AlibabaImage] Status check error:', error);
    return {
      success: false,
      taskId,
      error: error.message || 'Failed to check task status',
    };
  }
}

async function waitForImageCompletion(
  taskId: string,
  maxWaitSeconds: number = 120,
  pollIntervalSeconds: number = 5
): Promise<AlibabaImageResult> {
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  const pollIntervalMs = pollIntervalSeconds * 1000;

  console.log(`[AlibabaImage] Waiting for task ${taskId} (max ${maxWaitSeconds}s)...`);

  while (Date.now() - startTime < maxWaitMs) {
    const result = await checkImageTaskStatus(taskId);
    
    if (result.status === 'succeeded') {
      return result;
    }
    
    if (result.status === 'failed') {
      return result;
    }

    if (!result.success && result.error && !result.status) {
      return result;
    }

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return {
    success: false,
    taskId,
    error: `Timeout waiting for image after ${maxWaitSeconds}s`,
    status: 'failed',
  };
}

export async function generateImageWithAlibaba(
  prompt: string,
  options: AlibabaImageOptions = {}
): Promise<AlibabaImageResult> {
  const submitResult = await submitImageTask(prompt, options);
  
  if (!submitResult.success || !submitResult.taskId) {
    return submitResult;
  }

  return waitForImageCompletion(submitResult.taskId);
}

export async function generateSceneImageWithAlibaba(
  prompt: string,
  aspectRatio: '16:9' | '9:16' | '1:1' = '16:9'
): Promise<AlibabaImageResult> {
  const sizeMap: Record<string, '1280*720' | '720*1280' | '1024*1024'> = {
    '16:9': '1280*720',
    '9:16': '720*1280',
    '1:1': '1024*1024',
  };

  const cinematicPrompt = `Cinematic video frame: ${prompt}. Professional cinematography, movie quality, dramatic lighting, sharp focus, high production value.`;
  
  return generateImageWithAlibaba(cinematicPrompt, {
    size: sizeMap[aspectRatio],
    style: 'cinematic, professional, high quality video frame',
  });
}

export function isAlibabaImageConfigured(): boolean {
  return !!process.env.DASHSCOPE_API_KEY;
}

export async function testAlibabaImageConnection(): Promise<{
  success: boolean;
  message: string;
  status: 'working' | 'error' | 'not_configured';
}> {
  if (!process.env.DASHSCOPE_API_KEY) {
    return {
      success: false,
      message: 'DASHSCOPE_API_KEY not configured',
      status: 'not_configured',
    };
  }

  try {
    const response = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'wanx-v1',
          input: {
            prompt: 'test connection',
          },
          parameters: {
            n: 1,
          },
        }),
      }
    );

    if (response.ok || response.status === 400) {
      return {
        success: true,
        message: 'Alibaba Image (Wanx) API connected',
        status: 'working',
      };
    }

    if (response.status === 401) {
      return {
        success: false,
        message: 'Invalid DASHSCOPE_API_KEY',
        status: 'error',
      };
    }

    return {
      success: false,
      message: `API error: ${response.status}`,
      status: 'error',
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Connection test failed',
      status: 'error',
    };
  }
}
