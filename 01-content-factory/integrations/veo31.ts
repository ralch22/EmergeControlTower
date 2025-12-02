import { getVertexAIAccessToken, getProjectId, getLocation } from './vertex-auth';
import { sanitizeForVeo } from '../utils/prompt-sanitizer';

export interface Veo31Result {
  success: boolean;
  taskId?: string;
  videoUrl?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  hasAudio?: boolean;
}

export interface BrandGuidelines {
  visualStyle?: string;
  colorPalette?: string[];
  cinematicGuidelines?: string;
  fonts?: string[];
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
  brandGuidelines?: BrandGuidelines;
  model?: 'veo-3.0' | 'veo-3.1' | 'veo-3.1-fast';
}

export type Veo3Model = 'veo-3.0' | 'veo-3.1' | 'veo-3.1-fast';

const VEO_MODEL_IDS: Record<Veo3Model, string> = {
  'veo-3.0': 'veo-3.0-generate-preview',
  'veo-3.1': 'veo-3.1-generate-preview', 
  'veo-3.1-fast': 'veo-3.1-fast-generate-preview',
};

const VEO_VERTEX_MODEL_IDS: Record<Veo3Model, string> = {
  'veo-3.0': 'veo-3.0-generate-preview',
  'veo-3.1': 'veo-3.1-generate-preview',
  'veo-3.1-fast': 'veo-3.1-fast-generate-preview',
};

function buildBrandEnhancedPrompt(basePrompt: string, guidelines?: BrandGuidelines): string {
  if (!guidelines) return basePrompt;
  
  const parts = [basePrompt];
  
  if (guidelines.visualStyle) {
    parts.push(`Visual style: ${guidelines.visualStyle}`);
  }
  
  if (guidelines.colorPalette?.length) {
    parts.push(`Color palette: ${guidelines.colorPalette.join(', ')}`);
  }
  
  if (guidelines.cinematicGuidelines) {
    parts.push(`Cinematic: ${guidelines.cinematicGuidelines}`);
  }
  
  return parts.join('. ');
}

async function generateWithVertexAI(
  prompt: string,
  options: Veo31Options
): Promise<Veo31Result> {
  const accessToken = await getVertexAIAccessToken();
  
  if (!accessToken) {
    return {
      success: false,
      error: "Failed to get Vertex AI access token",
    };
  }

  const projectId = getProjectId();
  const location = getLocation();
  const selectedModel = options.model || 'veo-3.1';
  const modelId = VEO_VERTEX_MODEL_IDS[selectedModel];

  const {
    aspectRatio = '16:9',
    duration = 8,
    generateAudio = true,
    imageBase64,
    imageUrl,
    brandGuidelines,
  } = options;
  
  const brandEnhancedPrompt = buildBrandEnhancedPrompt(prompt, brandGuidelines);
  const enhancedPrompt = sanitizeForVeo(brandEnhancedPrompt);

  const validAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9';
  const validDurations = [4, 6, 8] as const;
  const snappedDuration = validDurations.reduce((prev, curr) => 
    Math.abs(curr - duration) < Math.abs(prev - duration) ? curr : prev
  );

  console.log(`[Veo-Vertex] Starting video generation with Vertex AI...`);
  console.log(`[Veo-Vertex] Project: ${projectId}, Location: ${location}`);
  console.log(`[Veo-Vertex] generateAudio: ${generateAudio}`);
  console.log(`[Veo-Vertex] Prompt: ${enhancedPrompt.substring(0, 150)}...`);

  const requestBody: any = {
    instances: [{
      prompt: enhancedPrompt,
    }],
    parameters: {
      aspectRatio: validAspectRatio,
      sampleCount: 1,
      durationSeconds: snappedDuration,
      generateAudio: generateAudio,
    },
  };

  if (imageBase64) {
    let base64Data = imageBase64;
    let mimeType = 'image/png';
    
    if (imageBase64.startsWith('data:')) {
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }
    
    requestBody.instances[0].image = {
      bytesBase64Encoded: base64Data,
      mimeType: mimeType,
    };
    console.log(`[Veo-Vertex] Using image with mimeType: ${mimeType}`);
  } else if (imageUrl) {
    requestBody.instances[0].image = {
      gcsUri: imageUrl,
    };
  }

  try {
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Veo-Vertex] API error:", response.status, errorText);
      return {
        success: false,
        error: `Vertex AI error: ${response.status} - ${errorText.substring(0, 200)}`,
      };
    }

    const result = await response.json();
    
    if (result.name) {
      console.log(`[Veo-Vertex] Operation started: ${result.name}`);
      return {
        success: true,
        taskId: result.name,
        status: 'processing',
        hasAudio: generateAudio,
      };
    }

    return {
      success: false,
      error: "Unexpected response format from Vertex AI",
    };
  } catch (error: any) {
    console.error("[Veo-Vertex] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to start Vertex AI video generation",
    };
  }
}

async function generateWithGeminiAPI(
  prompt: string,
  options: Veo31Options
): Promise<Veo31Result> {
  // Prefer GEMINI_API_KEY first as it's the validated key
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY not configured for Veo 3.1",
    };
  }

  const {
    aspectRatio = '16:9',
    duration = 8,
    generateAudio = true,
    negativePrompt,
    imageUrl,
    imageBase64,
    brandGuidelines,
  } = options;
  
  const enhancedPrompt = buildBrandEnhancedPrompt(prompt, brandGuidelines);

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

  const selectedModel = options.model || 'veo-3.1';
  const modelId = VEO_MODEL_IDS[selectedModel];
  const isImageToVideo = !!(imageUrl || imageBase64);

  console.log(`[Veo3] Starting ${isImageToVideo ? 'image-to-video' : 'text-to-video'} generation with ${selectedModel}...`);
  console.log(`[Veo3] Model ID: ${modelId}`);
  console.log(`[Veo3] generateAudio: ${generateAudio}`);
  console.log(`[Veo3] Prompt: ${enhancedPrompt.substring(0, 150)}...`);

  const requestBody: any = {
    instances: [{
      prompt: enhancedPrompt,
    }],
    parameters: {
      aspectRatio: validAspectRatio,
      sampleCount: 1,
      durationSeconds: snappedDuration,
      generateAudio: generateAudio,
    },
  };

  if (imageBase64) {
    let base64Data = imageBase64;
    let mimeType = 'image/png';
    
    if (imageBase64.startsWith('data:')) {
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      }
    }
    
    requestBody.instances[0].image = {
      bytesBase64Encoded: base64Data,
      mimeType: mimeType,
    };
    console.log(`[Veo3.1] Using image with mimeType: ${mimeType}, data length: ${base64Data.length}`);
  } else if (imageUrl) {
    requestBody.instances[0].image = {
      uri: imageUrl,
    };
  }

  if (negativePrompt) {
    requestBody.instances[0].negativePrompt = negativePrompt;
  }

  try {
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

export async function generateVideoWithVeo31(
  prompt: string,
  options: Veo31Options = {}
): Promise<Veo31Result> {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.log('[Veo] Trying Vertex AI with service account...');
    const vertexResult = await generateWithVertexAI(prompt, options);
    if (vertexResult.success) {
      return vertexResult;
    }
    console.log('[Veo] Vertex AI failed, trying Gemini API...');
  }

  return generateWithGeminiAPI(prompt, options);
}

export async function checkVeo31Status(operationName: string): Promise<Veo31Result> {
  if (operationName.includes('aiplatform.googleapis.com') || operationName.startsWith('projects/')) {
    return checkVertexAIStatus(operationName);
  }
  
  return checkGeminiStatus(operationName);
}

async function checkVertexAIStatus(operationName: string): Promise<Veo31Result> {
  const accessToken = await getVertexAIAccessToken();
  
  if (!accessToken) {
    return {
      success: false,
      error: "Failed to get Vertex AI access token for status check",
    };
  }

  try {
    const url = operationName.startsWith('http') 
      ? operationName 
      : `https://${getLocation()}-aiplatform.googleapis.com/v1/${operationName}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
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
        const videoUrl = videos[0].video?.uri || videos[0].uri || videos[0].videoUri || videos[0].gcsUri;
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

    return {
      success: true,
      taskId: operationName,
      status: 'processing',
    };
  } catch (error: any) {
    console.error("[Veo-Vertex] Status check error:", error);
    return {
      success: false,
      error: error.message || "Failed to check video status",
    };
  }
}

async function checkGeminiStatus(operationName: string): Promise<Veo31Result> {
  // Prefer GEMINI_API_KEY first as it's the validated key
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  
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
    
    console.log('[Veo3.1] Operation status response:', JSON.stringify(operation, null, 2).substring(0, 500));
    
    if (operation.done) {
      if (operation.error) {
        return {
          success: false,
          status: 'failed',
          error: operation.error.message || 'Video generation failed',
        };
      }

      // Try multiple response formats based on API docs
      // Format 1: response.generateVideoResponse.generatedSamples[0].video.uri (REST API)
      const generatedSamples = operation.response?.generateVideoResponse?.generatedSamples;
      if (generatedSamples?.length > 0) {
        const videoUrl = generatedSamples[0].video?.uri;
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

      // Format 2: response.generatedVideos[0].video.uri (SDK format)
      const generatedVideos = operation.response?.generatedVideos;
      if (generatedVideos?.length > 0) {
        const videoUrl = generatedVideos[0].video?.uri || generatedVideos[0].uri;
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

      // Format 3: Fallback to other possible locations
      const result = operation.response || operation.result || operation.metadata;
      const videos = result?.predictions || result?.videos;
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
        error: 'No videos were generated. Response: ' + JSON.stringify(operation.response || {}).substring(0, 200),
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

  console.log(`[Veo] Waiting for video completion: ${operationName}`);

  while (Date.now() - startTime < maxWaitMs) {
    const result = await checkVeo31Status(operationName);

    if (result.status === 'completed') {
      console.log(`[Veo] Video completed: ${result.videoUrl}`);
      return result;
    }

    if (result.status === 'failed' || (!result.success && result.status !== 'processing')) {
      console.error(`[Veo] Video failed: ${result.error}`);
      return result;
    }

    console.log(`[Veo] Still processing, waiting ${pollIntervalSeconds}s...`);
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
  provider?: string;
}> {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const accessToken = await getVertexAIAccessToken();
    if (accessToken) {
      return {
        success: true,
        message: "Vertex AI connected with service account",
        status: 'working',
        tier: 'vertex',
        provider: 'vertex-ai',
      };
    }
  }

  // Prefer GEMINI_API_KEY first as it's the validated key
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      message: "No Gemini API key or Vertex AI credentials configured",
      status: 'not_configured',
    };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (response.ok) {
      return { 
        success: true, 
        message: "Gemini API connected", 
        status: 'working',
        tier: 'gemini',
        provider: 'gemini-api',
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
  return generateVideoWithVeo31(prompt, {
    ...options,
    imageBase64,
  });
}

export interface QuickVideoOptions {
  model?: Veo3Model;
  duration?: 4 | 6 | 8;
  aspectRatio?: '16:9' | '9:16';
  style?: string;
  brandName?: string;
}

export interface QuickVideoResult {
  success: boolean;
  videoUrl?: string;
  duration?: number;
  hasAudio?: boolean;
  model?: string;
  error?: string;
  processingTimeMs?: number;
}

export async function generateQuickVideo(
  prompt: string,
  options: QuickVideoOptions = {}
): Promise<QuickVideoResult> {
  const startTime = Date.now();
  const {
    model = 'veo-3.1-fast',
    duration = 8,
    aspectRatio = '16:9',
    style,
    brandName,
  } = options;

  let enhancedPrompt = prompt;
  if (style) {
    enhancedPrompt += `. Style: ${style}`;
  }
  if (brandName) {
    enhancedPrompt += `. Brand: ${brandName}`;
  }

  console.log(`[QuickVideo] Starting single-shot generation with ${model}...`);
  console.log(`[QuickVideo] Prompt: ${enhancedPrompt.substring(0, 200)}...`);
  console.log(`[QuickVideo] Native audio: enabled`);

  const generateResult = await generateVideoWithVeo31(enhancedPrompt, {
    model,
    duration,
    aspectRatio,
    generateAudio: true, // Always request native audio for quick videos
  });

  if (!generateResult.success) {
    return {
      success: false,
      error: generateResult.error,
      model,
    };
  }

  if (generateResult.videoUrl) {
    return {
      success: true,
      videoUrl: generateResult.videoUrl,
      duration,
      hasAudio: true,
      model,
      processingTimeMs: Date.now() - startTime,
    };
  }

  if (!generateResult.taskId) {
    return {
      success: false,
      error: 'No task ID received from Veo',
      model,
    };
  }

  console.log(`[QuickVideo] Waiting for completion: ${generateResult.taskId}`);
  const completionResult = await waitForVeo31Completion(generateResult.taskId, 600, 15);

  if (!completionResult.success || !completionResult.videoUrl) {
    return {
      success: false,
      error: completionResult.error || 'Video generation failed',
      model,
      processingTimeMs: Date.now() - startTime,
    };
  }

  console.log(`[QuickVideo] Video completed: ${completionResult.videoUrl}`);
  return {
    success: true,
    videoUrl: completionResult.videoUrl,
    duration,
    hasAudio: completionResult.hasAudio ?? true,
    model,
    processingTimeMs: Date.now() - startTime,
  };
}
