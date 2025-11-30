export interface NanoBananaProResult {
  success: boolean;
  imageDataUrl?: string;
  imageUrl?: string;
  error?: string;
}

export interface NanoBananaProOptions {
  resolution?: '1K' | '2K' | '4K';
  style?: string;
}

export async function generateImageWithNanoBananaPro(
  prompt: string,
  options: NanoBananaProOptions = {}
): Promise<NanoBananaProResult> {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "GEMINI_API_KEY not configured for Nano Banana Pro",
    };
  }

  try {
    const { resolution = '2K', style = 'professional, cinematic, high quality' } = options;
    
    const enhancedPrompt = `${prompt}. Style: ${style}, studio quality, professional lighting, sharp details.`;
    
    console.log(`[NanoBananaPro] Generating ${resolution} image with prompt: ${prompt.substring(0, 100)}...`);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: enhancedPrompt
            }]
          }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[NanoBananaPro] API error:", response.status, errorText);
      
      if (response.status === 403 || response.status === 400) {
        return {
          success: false,
          error: "Nano Banana Pro may require billing enabled on your Google Cloud project",
        };
      }
      
      return {
        success: false,
        error: `Nano Banana Pro API error: ${response.status}`,
      };
    }

    const result = await response.json();
    
    const candidates = result.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          const imageData = part.inlineData.data;
          const mimeType = part.inlineData.mimeType;
          const dataUrl = `data:${mimeType};base64,${imageData}`;
          console.log(`[NanoBananaPro] Successfully generated ${resolution} image`);
          return { 
            success: true, 
            imageDataUrl: dataUrl,
            imageUrl: dataUrl,
          };
        }
      }
    }

    console.error("[NanoBananaPro] No image data in response");
    return {
      success: false,
      error: "No image data in response from Nano Banana Pro",
    };
  } catch (error: any) {
    console.error("[NanoBananaPro] Image generation error:", error);
    return {
      success: false,
      error: error.message || "Failed to generate image with Nano Banana Pro",
    };
  }
}

export async function generateVideoThumbnail(
  scenePrompt: string,
  options: NanoBananaProOptions = {}
): Promise<NanoBananaProResult> {
  const thumbnailPrompt = `Cinematic video frame: ${scenePrompt}. Widescreen 16:9 aspect ratio, suitable for video thumbnail, dynamic composition, professional cinematography.`;
  
  return generateImageWithNanoBananaPro(thumbnailPrompt, {
    resolution: options.resolution || '2K',
    style: 'cinematic, film still, dynamic lighting, professional color grading',
  });
}

export async function generateSocialMediaGraphic(
  topic: string,
  platform: 'linkedin' | 'instagram' | 'twitter' | 'facebook',
  brandStyle: string = "modern, professional"
): Promise<NanoBananaProResult> {
  const platformSpecs: Record<string, { style: string; resolution: '1K' | '2K' }> = {
    linkedin: { style: "corporate, professional, business-focused, clean design with clear readable text", resolution: '2K' },
    instagram: { style: "vibrant, visually striking, lifestyle-focused, trendy, eye-catching", resolution: '2K' },
    twitter: { style: "bold, attention-grabbing, simple, high contrast, impactful", resolution: '1K' },
    facebook: { style: "engaging, community-focused, warm colors, inviting", resolution: '2K' },
  };

  const spec = platformSpecs[platform];
  const prompt = `Create a ${platform} social media graphic about: ${topic}. ${brandStyle}`;
  
  return generateImageWithNanoBananaPro(prompt, {
    resolution: spec.resolution,
    style: spec.style,
  });
}

export async function generateProductShot(
  productDescription: string,
  context: string = "studio setting"
): Promise<NanoBananaProResult> {
  const prompt = `Professional product photography: ${productDescription}. ${context}, commercial quality, clean background, perfect lighting, sharp focus.`;
  
  return generateImageWithNanoBananaPro(prompt, {
    resolution: '4K',
    style: 'commercial product photography, studio lighting, professional',
  });
}

export async function testNanoBananaProConnection(): Promise<{ 
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
      return { 
        success: true, 
        message: "Nano Banana Pro (Gemini Image) connected", 
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
