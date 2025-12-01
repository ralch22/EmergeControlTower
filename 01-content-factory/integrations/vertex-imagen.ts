import { getVertexAIAccessToken, getProjectId, getLocation } from './vertex-auth';

export interface VertexImagenResult {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  error?: string;
}

export interface VertexImagenOptions {
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  sampleCount?: number;
  negativePrompt?: string;
}

export async function isVertexImagenConfigured(): Promise<boolean> {
  const token = await getVertexAIAccessToken();
  return !!token;
}

export async function generateImageWithVertexImagen(
  prompt: string,
  options: VertexImagenOptions = {}
): Promise<VertexImagenResult> {
  const accessToken = await getVertexAIAccessToken();
  
  if (!accessToken) {
    return {
      success: false,
      error: "Failed to get Vertex AI access token. Check GOOGLE_SERVICE_ACCOUNT_JSON.",
    };
  }

  const projectId = getProjectId();
  const location = getLocation();
  
  const modelId = 'imagen-3.0-generate-002';

  const {
    aspectRatio = '16:9',
    sampleCount = 1,
    negativePrompt,
  } = options;

  console.log(`[VertexImagen] Starting image generation...`);
  console.log(`[VertexImagen] Project: ${projectId}, Location: ${location}`);
  console.log(`[VertexImagen] Model: ${modelId}`);
  console.log(`[VertexImagen] Prompt: ${prompt.substring(0, 100)}...`);

  const requestBody: any = {
    instances: [{
      prompt: prompt,
    }],
    parameters: {
      sampleCount: sampleCount,
      aspectRatio: aspectRatio,
      safetySetting: "block_some",
      personGeneration: "allow_adult",
    },
  };

  if (negativePrompt) {
    requestBody.parameters.negativePrompt = negativePrompt;
  }

  try {
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;
    
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
      console.error('[VertexImagen] API error:', response.status, errorText);
      
      if (response.status === 403) {
        return {
          success: false,
          error: `Access denied. Ensure the service account has 'Vertex AI User' role and Imagen API is enabled. Error: ${errorText.substring(0, 200)}`,
        };
      }
      
      if (response.status === 400 && errorText.includes('not found')) {
        console.log('[VertexImagen] Model not available, trying fallback model...');
        return generateImageWithFallbackModel(prompt, options, accessToken, projectId, location);
      }
      
      return {
        success: false,
        error: `Vertex AI Imagen error: ${response.status} - ${errorText.substring(0, 200)}`,
      };
    }

    const result = await response.json();
    
    const predictions = result.predictions || [];
    if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
      const base64Data = predictions[0].bytesBase64Encoded;
      const mimeType = predictions[0].mimeType || 'image/png';
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      
      console.log('[VertexImagen] Successfully generated image');
      return {
        success: true,
        imageUrl: dataUrl,
        imageBase64: base64Data,
      };
    }

    console.error('[VertexImagen] No image data in response:', JSON.stringify(result).substring(0, 500));
    return {
      success: false,
      error: 'No image data in Vertex AI response',
    };
  } catch (error: any) {
    console.error('[VertexImagen] Error:', error);
    return {
      success: false,
      error: error.message || 'Vertex AI Imagen generation failed',
    };
  }
}

async function generateImageWithFallbackModel(
  prompt: string,
  options: VertexImagenOptions,
  accessToken: string,
  projectId: string,
  location: string
): Promise<VertexImagenResult> {
  const fallbackModels = ['imagen-3.0-generate-001', 'imagegeneration@006', 'imagegeneration@005'];
  
  for (const modelId of fallbackModels) {
    console.log(`[VertexImagen] Trying fallback model: ${modelId}`);
    
    const requestBody: any = {
      instances: [{
        prompt: prompt,
      }],
      parameters: {
        sampleCount: options.sampleCount || 1,
        aspectRatio: options.aspectRatio || '16:9',
      },
    };

    if (options.negativePrompt) {
      requestBody.parameters.negativePrompt = options.negativePrompt;
    }

    try {
      const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const result = await response.json();
        const predictions = result.predictions || [];
        
        if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
          const base64Data = predictions[0].bytesBase64Encoded;
          const mimeType = predictions[0].mimeType || 'image/png';
          const dataUrl = `data:${mimeType};base64,${base64Data}`;
          
          console.log(`[VertexImagen] Successfully generated image with ${modelId}`);
          return {
            success: true,
            imageUrl: dataUrl,
            imageBase64: base64Data,
          };
        }
      } else {
        const errorText = await response.text();
        console.log(`[VertexImagen] Model ${modelId} failed: ${response.status}`);
      }
    } catch (error: any) {
      console.log(`[VertexImagen] Model ${modelId} error: ${error.message}`);
    }
  }

  return {
    success: false,
    error: 'All Vertex AI Imagen models failed',
  };
}

export async function generateSceneImageWithVertexImagen(
  prompt: string,
  aspectRatio: '16:9' | '9:16' | '1:1' = '16:9'
): Promise<VertexImagenResult> {
  const cinematicPrompt = `Cinematic video frame: ${prompt}. Professional cinematography, movie quality, dramatic lighting, sharp focus, high production value, 4K resolution.`;
  
  return generateImageWithVertexImagen(cinematicPrompt, {
    aspectRatio,
    negativePrompt: 'blurry, low quality, watermark, text overlay, amateur, grainy',
  });
}

export async function testVertexImagenConnection(): Promise<{
  success: boolean;
  message: string;
  status: 'working' | 'error' | 'not_configured';
}> {
  const accessToken = await getVertexAIAccessToken();
  
  if (!accessToken) {
    return {
      success: false,
      message: 'GOOGLE_SERVICE_ACCOUNT_JSON not configured or invalid',
      status: 'not_configured',
    };
  }

  const projectId = getProjectId();
  const location = getLocation();

  try {
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models`;
    
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      return {
        success: true,
        message: `Vertex AI Imagen connected (Project: ${projectId}, Location: ${location})`,
        status: 'working',
      };
    }

    const errorText = await response.text();
    return {
      success: false,
      message: `API error: ${response.status} - ${errorText.substring(0, 100)}`,
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
