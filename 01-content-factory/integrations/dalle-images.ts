import OpenAI from 'openai';

export interface DalleImageResult {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  error?: string;
}

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export async function generateSceneImage(
  prompt: string,
  size: '1024x1024' | '1792x1024' | '1024x1792' = '1792x1024'
): Promise<DalleImageResult> {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    console.log('[DALL-E] OpenAI API key not configured');
    return {
      success: false,
      error: 'OpenAI API key not configured',
    };
  }

  try {
    console.log(`[DALL-E] Generating unique image for scene...`);
    console.log(`[DALL-E] Prompt: ${prompt.substring(0, 100)}...`);

    const enhancedPrompt = `Cinematic still frame for video production: ${prompt}. Professional lighting, high quality, 4K resolution, photorealistic, movie-quality visuals.`;

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: enhancedPrompt,
      size: size,
      n: 1,
    });

    const imageData = response.data?.[0];
    
    if (imageData?.b64_json) {
      console.log('[DALL-E] Image generated successfully (base64)');
      return {
        success: true,
        imageBase64: imageData.b64_json,
      };
    }

    if (imageData?.url) {
      console.log('[DALL-E] Image generated successfully (URL)');
      return {
        success: true,
        imageUrl: imageData.url,
      };
    }

    return {
      success: false,
      error: 'No image data in response',
    };
  } catch (error: any) {
    console.error('[DALL-E] Image generation error:', error.message);
    return {
      success: false,
      error: error.message || 'Failed to generate image',
    };
  }
}

export async function generateSceneImageWithRetry(
  prompt: string,
  maxRetries: number = 3
): Promise<DalleImageResult> {
  let lastError = '';
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[DALL-E] Attempt ${attempt}/${maxRetries}...`);
    
    const result = await generateSceneImage(prompt);
    
    if (result.success) {
      return result;
    }
    
    lastError = result.error || 'Unknown error';
    
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[DALL-E] Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return {
    success: false,
    error: `Failed after ${maxRetries} attempts: ${lastError}`,
  };
}

export function isDalleConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}
