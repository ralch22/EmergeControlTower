import { GoogleGenAI, Modality } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface ImageGenerationResult {
  success: boolean;
  imageDataUrl?: string;
  error?: string;
}

export async function generateImageWithGemini(
  prompt: string,
  style: string = "professional corporate photography"
): Promise<ImageGenerationResult> {
  try {
    const enhancedPrompt = `${prompt}, ${style}, high quality, professional lighting, 8k resolution`;
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts: [{ text: enhancedPrompt }] }],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    const candidate = response.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart?.inlineData?.data) {
      return {
        success: false,
        error: "No image data in response",
      };
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const imageDataUrl = `data:${mimeType};base64,${imagePart.inlineData.data}`;

    return {
      success: true,
      imageDataUrl,
    };
  } catch (error: any) {
    console.error("Gemini image generation error:", error);
    return {
      success: false,
      error: error.message || "Failed to generate image",
    };
  }
}

export async function generateSocialMediaImage(
  topic: string,
  platform: 'linkedin' | 'instagram' | 'twitter' | 'facebook',
  brandStyle: string = "modern, professional"
): Promise<ImageGenerationResult> {
  const platformStyles: Record<string, string> = {
    linkedin: "corporate, professional, business-focused, clean design",
    instagram: "vibrant, visually striking, lifestyle-focused, trendy",
    twitter: "bold, attention-grabbing, simple, high contrast",
    facebook: "engaging, community-focused, warm colors",
  };

  const prompt = `Create a social media graphic for ${platform} about: ${topic}. Style: ${platformStyles[platform]}, ${brandStyle}`;
  
  return generateImageWithGemini(prompt, platformStyles[platform]);
}

export async function generateBlogHeroImage(
  blogTitle: string,
  industry: string
): Promise<ImageGenerationResult> {
  const prompt = `Blog header image for article titled "${blogTitle}" in the ${industry} industry. Professional, editorial style, suitable for business blog.`;
  
  return generateImageWithGemini(prompt, "editorial photography, professional, clean composition");
}

export async function generateAdCreativeImage(
  productDescription: string,
  adType: 'facebook_ad' | 'google_ad' = 'facebook_ad'
): Promise<ImageGenerationResult> {
  const adStyles: Record<string, string> = {
    facebook_ad: "eye-catching, scroll-stopping, vibrant colors, clear focal point",
    google_ad: "clean, professional, minimal, high contrast",
  };

  const prompt = `Advertisement creative image for: ${productDescription}. Marketing focused, conversion-optimized.`;
  
  return generateImageWithGemini(prompt, adStyles[adType]);
}
