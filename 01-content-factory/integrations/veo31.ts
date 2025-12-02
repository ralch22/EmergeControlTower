import { getVertexAIAccessToken, getProjectId, getLocation } from './vertex-auth';
import { sanitizeForVeo } from '../utils/prompt-sanitizer';
import { costControl } from '../services/cost-control';

export interface Veo31Result {
  success: boolean;
  taskId?: string;
  videoUrl?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  hasAudio?: boolean;
  budgetBlocked?: boolean;
  approvalRequired?: boolean;
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
  contentId?: string;
  clientId?: number;
  skipBudgetCheck?: boolean;
  skipApprovalCheck?: boolean;
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
  const duration = options.duration || 8;
  const provider = 'veo31';
  const operation = duration <= 4 ? 'video_generation_4s' : 'video_generation_8s';
  
  if (!options.skipBudgetCheck) {
    const budgetCheck = await costControl.checkBudget(provider, operation);
    if (!budgetCheck.allowed) {
      console.log(`[Veo] Budget blocked: ${budgetCheck.reason}`);
      return {
        success: false,
        error: budgetCheck.reason,
        budgetBlocked: true,
      };
    }
    console.log(`[Veo] Budget check passed: $${budgetCheck.dailySpent.toFixed(2)} / $${budgetCheck.dailyLimit.toFixed(2)} spent`);
  }
  
  if (!options.skipApprovalCheck && options.contentId) {
    const approvalCheck = await costControl.checkContentApproval(options.contentId);
    if (!approvalCheck.allowed) {
      console.log(`[Veo] Approval required: ${approvalCheck.reason}`);
      return {
        success: false,
        error: approvalCheck.reason,
        approvalRequired: true,
      };
    }
  }
  
  let result: Veo31Result;
  
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.log('[Veo] Trying Vertex AI with service account...');
    result = await generateWithVertexAI(prompt, options);
    if (!result.success) {
      console.log('[Veo] Vertex AI failed, trying Gemini API...');
      result = await generateWithGeminiAPI(prompt, options);
    }
  } else {
    result = await generateWithGeminiAPI(prompt, options);
  }
  
  if (result.success || result.taskId) {
    const estimatedCost = costControl.getEstimatedCost(provider, operation);
    await costControl.trackCost(
      provider,
      operation,
      estimatedCost,
      options.clientId,
      { prompt: prompt.substring(0, 100), duration }
    );
  }
  
  return result;
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
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY not configured",
    };
  }

  try {
    let url: string;
    if (operationName.startsWith('http')) {
      const urlObj = new URL(operationName);
      urlObj.searchParams.set('key', apiKey);
      url = urlObj.toString();
    } else {
      url = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`;
    }

    console.log(`[Veo3.1] Checking status at: ${url.substring(0, 80)}...`);

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

// ==========================================
// Scene Extension Types & Configuration
// ==========================================

export interface SceneExtensionConfig {
  model?: Veo3Model;
  aspectRatio?: '16:9' | '9:16';
  generateAudio?: boolean;
  brandGuidelines?: BrandGuidelines;
  maxHops?: number; // Max 20 for Veo 3.1
  maxRetries?: number; // Max retries per scene (default: 2)
  retryDelayMs?: number; // Base delay between retries (default: 5000ms)
}

export interface SceneDefinition {
  prompt: string;
  durationSeconds?: number; // 7 seconds per hop for Veo 3.1
  resetRequired?: boolean; // If true, start fresh instead of extending
}

export interface ContinuousVideoResult {
  success: boolean;
  videoUrl?: string;
  totalDuration?: number;
  hopCount?: number;
  error?: string;
  processingTimeMs?: number;
  sceneResults?: Array<{
    sceneIndex: number;
    prompt: string;
    success: boolean;
    videoUrl?: string;
    error?: string;
  }>;
}

const EXTENSION_DURATION_SECONDS = 7; // Veo 3.1 fixed extension duration
const MAX_EXTENSION_HOPS = 20; // Up to 148 seconds total
const EXTENSION_POLL_INTERVAL = 15; // seconds
const EXTENSION_MAX_WAIT = 600; // 10 minutes per extension

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

  // Try Veo 3.1 first
  const generateResult = await generateVideoWithVeo31(enhancedPrompt, {
    model,
    duration,
    aspectRatio,
    generateAudio: true,
  });

  if (generateResult.success && generateResult.videoUrl) {
    return {
      success: true,
      videoUrl: generateResult.videoUrl,
      duration,
      hasAudio: true,
      model,
      processingTimeMs: Date.now() - startTime,
    };
  }

  if (generateResult.success && generateResult.taskId) {
    console.log(`[QuickVideo] Waiting for Veo completion: ${generateResult.taskId}`);
    const completionResult = await waitForVeo31Completion(generateResult.taskId, 600, 15);

    if (completionResult.success && completionResult.videoUrl) {
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
    
    console.log(`[QuickVideo] Veo completion failed: ${completionResult.error}`);
  } else {
    console.log(`[QuickVideo] Veo generation failed: ${generateResult.error}`);
  }

  // Fallback to Runway if Veo fails
  console.log(`[QuickVideo] Falling back to Runway...`);
  try {
    const { generateVideoWithRunway, waitForVideoCompletion } = await import('./runway');
    
    if (!process.env.RUNWAY_API_KEY) {
      return {
        success: false,
        error: 'No video providers available. Veo failed and RUNWAY_API_KEY not configured.',
        model,
        processingTimeMs: Date.now() - startTime,
      };
    }

    const runwayResult = await generateVideoWithRunway(enhancedPrompt, {
      duration: Math.min(duration, 10), // Runway supports up to 10s
      aspectRatio: aspectRatio as '16:9' | '9:16',
      model: 'gen4_turbo',
    });

    if (!runwayResult.success || !runwayResult.taskId) {
      return {
        success: false,
        error: runwayResult.error || 'Runway video generation failed to start',
        model: 'runway_fallback',
        processingTimeMs: Date.now() - startTime,
      };
    }

    console.log(`[QuickVideo] Waiting for Runway completion: ${runwayResult.taskId}`);
    const runwayCompletion = await waitForVideoCompletion(runwayResult.taskId, 300, 5);

    if (runwayCompletion.success && runwayCompletion.videoUrl) {
      console.log(`[QuickVideo] Runway video completed: ${runwayCompletion.videoUrl}`);
      return {
        success: true,
        videoUrl: runwayCompletion.videoUrl,
        duration: Math.min(duration, 10),
        hasAudio: false, // Runway doesn't generate native audio like Veo
        model: 'runway_gen4_turbo',
        processingTimeMs: Date.now() - startTime,
      };
    }

    return {
      success: false,
      error: runwayCompletion.error || 'Runway video generation failed',
      model: 'runway_fallback',
      processingTimeMs: Date.now() - startTime,
    };
  } catch (runwayError: any) {
    console.error(`[QuickVideo] Runway fallback error:`, runwayError);
    return {
      success: false,
      error: `All providers failed. Last error: ${runwayError.message || 'Unknown error'}`,
      model,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// ==========================================
// Scene Extension Functions
// ==========================================

/**
 * Extend an existing Veo-generated video with a new prompt.
 * The model uses the last 1-2 seconds of the source video for continuity.
 * Each extension adds ~7 seconds (Veo 3.1).
 */
async function extendVideoWithVertexAI(
  sourceVideoUrl: string,
  prompt: string,
  options: SceneExtensionConfig
): Promise<Veo31Result> {
  const accessToken = await getVertexAIAccessToken();
  
  if (!accessToken) {
    return {
      success: false,
      error: "Failed to get Vertex AI access token for extension",
    };
  }

  const projectId = getProjectId();
  const location = getLocation();
  const selectedModel = options.model || 'veo-3.1';
  const modelId = VEO_VERTEX_MODEL_IDS[selectedModel];

  const {
    aspectRatio = '16:9',
    generateAudio = true,
    brandGuidelines,
  } = options;
  
  const brandEnhancedPrompt = buildBrandEnhancedPrompt(prompt, brandGuidelines);
  const enhancedPrompt = sanitizeForVeo(brandEnhancedPrompt);

  console.log(`[Veo-Extend-Vertex] Extending video with Vertex AI...`);
  console.log(`[Veo-Extend-Vertex] Source: ${sourceVideoUrl}`);
  console.log(`[Veo-Extend-Vertex] Prompt: ${enhancedPrompt.substring(0, 150)}...`);

  const requestBody = {
    instances: [{
      prompt: enhancedPrompt,
      video: {
        gcsUri: sourceVideoUrl,
        mimeType: 'video/mp4',
      },
    }],
    parameters: {
      aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
      sampleCount: 1,
      durationSeconds: EXTENSION_DURATION_SECONDS,
      generateAudio: generateAudio,
    },
  };

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
      console.error("[Veo-Extend-Vertex] API error:", response.status, errorText);
      return {
        success: false,
        error: `Vertex AI extension error: ${response.status} - ${errorText.substring(0, 200)}`,
      };
    }

    const result = await response.json();
    
    if (result.name) {
      console.log(`[Veo-Extend-Vertex] Extension operation started: ${result.name}`);
      return {
        success: true,
        taskId: result.name,
        status: 'processing',
        hasAudio: generateAudio,
      };
    }

    return {
      success: false,
      error: "Unexpected response format from Vertex AI extension",
    };
  } catch (error: any) {
    console.error("[Veo-Extend-Vertex] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to start Vertex AI video extension",
    };
  }
}

async function extendVideoWithGeminiAPI(
  sourceVideoUrl: string,
  prompt: string,
  options: SceneExtensionConfig
): Promise<Veo31Result> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY not configured for Veo 3.1 extension",
    };
  }

  const {
    aspectRatio = '16:9',
    generateAudio = true,
    brandGuidelines,
  } = options;
  
  const enhancedPrompt = buildBrandEnhancedPrompt(prompt, brandGuidelines);
  const selectedModel = options.model || 'veo-3.1';
  const modelId = VEO_MODEL_IDS[selectedModel];

  console.log(`[Veo-Extend-Gemini] Extending video with Gemini API...`);
  console.log(`[Veo-Extend-Gemini] Source: ${sourceVideoUrl}`);
  console.log(`[Veo-Extend-Gemini] Prompt: ${enhancedPrompt.substring(0, 150)}...`);

  const requestBody = {
    instances: [{
      prompt: enhancedPrompt,
      video: {
        uri: sourceVideoUrl,
        mimeType: 'video/mp4',
      },
    }],
    parameters: {
      aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
      sampleCount: 1,
      durationSeconds: EXTENSION_DURATION_SECONDS,
      generateAudio: generateAudio,
    },
  };

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
      console.error("[Veo-Extend-Gemini] API error:", response.status, errorText);
      return {
        success: false,
        error: `Veo 3.1 extension error: ${response.status} - ${errorText.substring(0, 200)}`,
      };
    }

    const result = await response.json();
    
    if (result.name) {
      console.log(`[Veo-Extend-Gemini] Extension operation started: ${result.name}`);
      return {
        success: true,
        taskId: result.name,
        status: 'processing',
        hasAudio: generateAudio,
      };
    }

    return {
      success: false,
      error: "Unexpected response format from Gemini API extension",
    };
  } catch (error: any) {
    console.error("[Veo-Extend-Gemini] Error:", error);
    return {
      success: false,
      error: error.message || "Failed to start Gemini API video extension",
    };
  }
}

/**
 * Extend an existing video with a new scene prompt.
 * Automatically selects Vertex AI or Gemini API based on configuration.
 */
export async function extendVideoWithVeo31(
  sourceVideoUrl: string,
  prompt: string,
  options: SceneExtensionConfig = {}
): Promise<Veo31Result> {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    console.log('[Veo-Extend] Trying Vertex AI extension...');
    const vertexResult = await extendVideoWithVertexAI(sourceVideoUrl, prompt, options);
    if (vertexResult.success) {
      return vertexResult;
    }
    console.log('[Veo-Extend] Vertex AI failed, trying Gemini API...');
  }

  return extendVideoWithGeminiAPI(sourceVideoUrl, prompt, options);
}

/**
 * Helper to sleep for a specified time with exponential backoff
 */
async function sleepWithBackoff(baseDelayMs: number, attempt: number): Promise<void> {
  const delayMs = baseDelayMs * Math.pow(2, attempt); // Exponential: 5s, 10s, 20s, etc.
  console.log(`[ContinuousVideo] Waiting ${delayMs / 1000}s before retry...`);
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

/**
 * Generate a continuous video by creating a base clip and extending it
 * for each scene in the script. Maintains visual consistency across scenes.
 * 
 * Uses retry logic with exponential backoff for failed scenes. If all retries
 * exhaust for any scene, the chain halts and returns the last successful clip.
 * 
 * @param scenes - Array of scene definitions with prompts
 * @param config - Extension configuration (model, aspect ratio, retries, etc.)
 * @returns Continuous video result with final video URL
 */
export async function generateContinuousVideo(
  scenes: SceneDefinition[],
  config: SceneExtensionConfig = {}
): Promise<ContinuousVideoResult> {
  const startTime = Date.now();
  const sceneResults: ContinuousVideoResult['sceneResults'] = [];
  
  if (!scenes.length) {
    return {
      success: false,
      error: 'No scenes provided',
      sceneResults: [],
    };
  }

  const maxHops = Math.min(config.maxHops || MAX_EXTENSION_HOPS, MAX_EXTENSION_HOPS);
  const maxRetries = config.maxRetries ?? 2; // Default 2 retries (3 total attempts)
  const retryDelayMs = config.retryDelayMs ?? 5000; // Default 5 second base delay
  
  if (scenes.length > maxHops) {
    console.warn(`[ContinuousVideo] Scene count (${scenes.length}) exceeds max hops (${maxHops}). Will process first ${maxHops} scenes.`);
  }

  const scenesToProcess = scenes.slice(0, maxHops);
  let currentVideoUrl: string | null = null;
  let hopCount = 0;
  let chainBroken = false;
  let breakReason: string | undefined;

  console.log(`[ContinuousVideo] Starting continuous generation with ${scenesToProcess.length} scenes...`);
  console.log(`[ContinuousVideo] Model: ${config.model || 'veo-3.1'}, Aspect: ${config.aspectRatio || '16:9'}`);
  console.log(`[ContinuousVideo] Retry config: ${maxRetries} retries, ${retryDelayMs}ms base delay`);

  for (let i = 0; i < scenesToProcess.length; i++) {
    const scene = scenesToProcess[i];
    const isFirstScene = i === 0;
    const shouldReset = scene.resetRequired || isFirstScene;
    
    let sceneSuccess = false;
    let lastError: string | undefined;
    let attemptCount = 0;

    console.log(`[ContinuousVideo] Processing scene ${i + 1}/${scenesToProcess.length}: ${scene.prompt.substring(0, 80)}...`);

    // Retry loop for this scene
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      attemptCount++;
      
      if (attempt > 0) {
        console.log(`[ContinuousVideo] Retry ${attempt}/${maxRetries} for scene ${i + 1}...`);
        await sleepWithBackoff(retryDelayMs, attempt - 1);
      }

      try {
        let result: Veo31Result;

        if (shouldReset || !currentVideoUrl) {
          console.log(`[ContinuousVideo] Generating base video for scene ${i + 1} (attempt ${attemptCount})...`);
          result = await generateVideoWithVeo31(scene.prompt, {
            model: config.model,
            aspectRatio: config.aspectRatio,
            generateAudio: config.generateAudio ?? true,
            brandGuidelines: config.brandGuidelines,
            duration: 8,
          });
        } else {
          console.log(`[ContinuousVideo] Extending video for scene ${i + 1} (attempt ${attemptCount}) from: ${currentVideoUrl.substring(0, 60)}...`);
          result = await extendVideoWithVeo31(currentVideoUrl, scene.prompt, config);
        }

        if (!result.success) {
          lastError = result.error || 'Generation failed';
          console.warn(`[ContinuousVideo] Scene ${i + 1} attempt ${attemptCount} failed: ${lastError}`);
          continue; // Try next attempt
        }

        // Wait for completion if we got a task ID
        let finalResult = result;
        if (result.taskId && !result.videoUrl) {
          console.log(`[ContinuousVideo] Waiting for scene ${i + 1} completion (attempt ${attemptCount})...`);
          finalResult = await waitForVeo31Completion(
            result.taskId,
            EXTENSION_MAX_WAIT,
            EXTENSION_POLL_INTERVAL
          );
        }

        if (!finalResult.success || !finalResult.videoUrl) {
          lastError = finalResult.error || 'No video URL returned after completion';
          console.warn(`[ContinuousVideo] Scene ${i + 1} completion attempt ${attemptCount} failed: ${lastError}`);
          continue; // Try next attempt
        }

        // Success! Update current video URL for next extension
        currentVideoUrl = finalResult.videoUrl;
        hopCount++;
        sceneSuccess = true;

        sceneResults.push({
          sceneIndex: i,
          prompt: scene.prompt,
          success: true,
          videoUrl: currentVideoUrl,
        });

        console.log(`[ContinuousVideo] Scene ${i + 1} completed after ${attemptCount} attempt(s): ${currentVideoUrl.substring(0, 60)}...`);
        break; // Exit retry loop on success

      } catch (error: any) {
        lastError = error.message || 'Unknown error';
        console.warn(`[ContinuousVideo] Scene ${i + 1} attempt ${attemptCount} threw error: ${lastError}`);
        // Continue to next retry attempt
      }
    }

    // If scene failed after all retries, halt the chain
    if (!sceneSuccess) {
      chainBroken = true;
      breakReason = `Scene ${i + 1} failed after ${attemptCount} attempts: ${lastError}`;
      
      sceneResults.push({
        sceneIndex: i,
        prompt: scene.prompt,
        success: false,
        error: `Failed after ${attemptCount} attempts: ${lastError}`,
      });

      console.error(`[ContinuousVideo] Chain broken at scene ${i + 1}! ${breakReason}`);
      console.log(`[ContinuousVideo] Halting generation. Returning last successful clip.`);
      
      // Mark remaining scenes as skipped
      for (let j = i + 1; j < scenesToProcess.length; j++) {
        sceneResults.push({
          sceneIndex: j,
          prompt: scenesToProcess[j].prompt,
          success: false,
          error: 'Skipped - previous scene failed',
        });
      }
      
      break; // Exit the scene loop
    }
  }

  const successfulScenes = sceneResults.filter(r => r.success);
  const lastSuccessful = successfulScenes[successfulScenes.length - 1];

  if (!lastSuccessful) {
    return {
      success: false,
      error: breakReason || 'All scenes failed to generate',
      sceneResults,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Calculate total duration: base (8s) + extensions (7s each)
  const baseDuration = 8;
  const extensionDuration = (hopCount - 1) * EXTENSION_DURATION_SECONDS;
  const totalDuration = baseDuration + Math.max(0, extensionDuration);

  console.log(`[ContinuousVideo] Generation ${chainBroken ? 'partially complete (chain broken)' : 'complete'}!`);
  console.log(`[ContinuousVideo] Final video: ${lastSuccessful.videoUrl}`);
  console.log(`[ContinuousVideo] Successful scenes: ${successfulScenes.length}/${scenesToProcess.length}`);
  console.log(`[ContinuousVideo] Total duration: ~${totalDuration}s`);

  return {
    success: !chainBroken, // Only fully successful if no chain break
    videoUrl: lastSuccessful.videoUrl,
    totalDuration,
    hopCount,
    sceneResults,
    processingTimeMs: Date.now() - startTime,
    error: chainBroken ? breakReason : undefined,
  };
}

/**
 * Helper function to calculate estimated duration for a multi-scene video.
 */
export function estimateContinuousVideoDuration(sceneCount: number): number {
  if (sceneCount <= 0) return 0;
  if (sceneCount === 1) return 8; // Base clip is 8 seconds
  // First scene: 8s, each additional: 7s
  return 8 + (sceneCount - 1) * EXTENSION_DURATION_SECONDS;
}

/**
 * Helper function to calculate the number of scenes needed for a target duration.
 */
export function calculateScenesForDuration(targetSeconds: number): number {
  if (targetSeconds <= 0) return 0;
  if (targetSeconds <= 8) return 1;
  // First scene: 8s, each additional: 7s
  return 1 + Math.ceil((targetSeconds - 8) / EXTENSION_DURATION_SECONDS);
}
