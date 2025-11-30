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
  // wan2.5-t2i-preview: Singapore/International
  // qwen-image-plus: Singapore/International (alternative)
  // wanx2.1-t2i-turbo: Beijing/China
  model?: 'wan2.5-t2i-preview' | 'qwen-image-plus' | 'wanx2.1-t2i-turbo' | 'wanx2.1-t2i-plus';
}

function getApiBaseUrl(): string {
  const useInternational = process.env.DASHSCOPE_REGION === 'international' || 
                           process.env.DASHSCOPE_REGION === 'intl' ||
                           process.env.DASHSCOPE_REGION === 'singapore';
  
  if (useInternational) {
    return 'https://dashscope-intl.aliyuncs.com/api/v1';
  }
  
  return 'https://dashscope.aliyuncs.com/api/v1';
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
    const useInternational = process.env.DASHSCOPE_REGION === 'international' || 
                             process.env.DASHSCOPE_REGION === 'intl' ||
                             process.env.DASHSCOPE_REGION === 'singapore';
    
    // Singapore/International uses wan2.5-t2i-preview or qwen-image-plus
    // Beijing/China uses wanx2.1-t2i-turbo  
    const defaultModel = useInternational ? 'wan2.5-t2i-preview' : 'wanx2.1-t2i-turbo';
    
    const { 
      size = '1280*720', 
      style = '', 
      negativePrompt = '',
      model = defaultModel
    } = options;
    
    const enhancedPrompt = style 
      ? `${prompt}, ${style}, professional quality, cinematic lighting`
      : `${prompt}, professional quality, cinematic lighting, 4K resolution`;
    
    const baseUrl = getApiBaseUrl();
    const endpoint = `${baseUrl}/services/aigc/text2image/image-synthesis`;
    
    console.log(`[AlibabaImage] Using endpoint: ${endpoint}`);
    console.log(`[AlibabaImage] Using model: ${model}`);
    console.log(`[AlibabaImage] Submitting image generation task...`);
    console.log(`[AlibabaImage] Prompt: ${enhancedPrompt.substring(0, 100)}...`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify({
        model: model,
        input: {
          prompt: enhancedPrompt,
          negative_prompt: negativePrompt || 'blurry, low quality, watermark, text overlay',
        },
        parameters: {
          size: size,
          n: 1,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[AlibabaImage] API error:', response.status, errorText);
      
      if (response.status === 401) {
        const currentRegion = baseUrl.includes('intl') ? 'international' : 'beijing';
        const suggestedRegion = currentRegion === 'international' ? 'beijing' : 'international';
        return {
          success: false,
          error: `Invalid API key. Currently using ${currentRegion} endpoint. Try setting DASHSCOPE_REGION=${suggestedRegion} if your API key is from a different region.`,
        };
      }
      
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
    const baseUrl = getApiBaseUrl();
    const response = await fetch(
      `${baseUrl}/tasks/${taskId}`,
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
      const errorMessage = result.output?.message || result.message || 'Task failed';
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
    // If model is access denied, try fallback to qwen-image-plus
    if (submitResult.error?.includes('Model.AccessDenied') || submitResult.error?.includes('Model access denied')) {
      console.log(`[AlibabaImage] Primary model access denied, trying qwen-image-plus fallback...`);
      const fallbackResult = await submitImageTask(prompt, { ...options, model: 'qwen-image-plus' });
      
      if (!fallbackResult.success || !fallbackResult.taskId) {
        // Both models failed, provide actionable error
        return {
          success: false,
          error: `Image generation failed. Please enable model access in Alibaba Cloud Model Studio console:\n` +
                 `1. Go to https://modelstudio.alibabacloud.com/\n` +
                 `2. Navigate to Model Gallery\n` +
                 `3. Enable "Wan 2.5 Text-to-Image" or "Qwen Image Plus"\n` +
                 `Original error: ${submitResult.error}`,
        };
      }
      
      return waitForImageCompletion(fallbackResult.taskId);
    }
    
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
  region?: string;
}> {
  if (!process.env.DASHSCOPE_API_KEY) {
    return {
      success: false,
      message: 'DASHSCOPE_API_KEY not configured',
      status: 'not_configured',
    };
  }

  const baseUrl = getApiBaseUrl();
  const region = baseUrl.includes('intl') ? 'international (Singapore)' : 'beijing (China)';

  const useInternational = baseUrl.includes('intl');
  // Singapore/International uses wan2.5-t2i-preview, Beijing/China uses wanx2.1-t2i-turbo
  const testModel = useInternational ? 'wan2.5-t2i-preview' : 'wanx2.1-t2i-turbo';
  
  try {
    const response = await fetch(
      `${baseUrl}/services/aigc/text2image/image-synthesis`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DASHSCOPE_API_KEY}`,
          'Content-Type': 'application/json',
          'X-DashScope-Async': 'enable',
        },
        body: JSON.stringify({
          model: testModel,
          input: {
            prompt: 'test connection - simple blue sky',
          },
          parameters: {
            size: '1024*1024',
            n: 1,
          },
        }),
      }
    );

    if (response.ok) {
      return {
        success: true,
        message: `Alibaba Image (Wanx) API connected - using ${region}`,
        status: 'working',
        region,
      };
    }

    if (response.status === 401) {
      return {
        success: false,
        message: `Invalid DASHSCOPE_API_KEY for ${region}. Try setting DASHSCOPE_REGION=international if your key is from the international console.`,
        status: 'error',
        region,
      };
    }

    const errorText = await response.text();
    return {
      success: false,
      message: `API error (${region}): ${response.status} - ${errorText}`,
      status: 'error',
      region,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Connection test failed',
      status: 'error',
      region,
    };
  }
}
