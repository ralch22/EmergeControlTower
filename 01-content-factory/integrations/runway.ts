const RUNWAY_BASE_URL = "https://api.dev.runwayml.com/v1";

export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  taskId?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  imageUrl?: string;
}

function getContextualFallbackImage(prompt: string): string {
  const promptLower = prompt.toLowerCase();
  
  const imageCategories: { keywords: string[]; images: string[] }[] = [
    {
      keywords: ['office', 'business', 'corporate', 'meeting', 'team', 'professional', 'desk', 'leader', 'ceo', 'executive'],
      images: [
        'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1497215842964-222b430dc094?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1553028826-f4804a6dba3b?w=1920&h=1080&fit=crop',
      ]
    },
    {
      keywords: ['technology', 'tech', 'digital', 'software', 'data', 'ai', 'dashboard', 'screen', 'ui', 'interface', 'monitoring'],
      images: [
        'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&h=1080&fit=crop',
      ]
    },
    {
      keywords: ['finance', 'money', 'bank', 'payment', 'fintech', 'investment', 'growth', 'chart', 'graph'],
      images: [
        'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1920&h=1080&fit=crop',
      ]
    },
    {
      keywords: ['compliance', 'legal', 'regulation', 'security', 'shield', 'check', 'audit', 'document'],
      images: [
        'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1920&h=1080&fit=crop',
      ]
    },
    {
      keywords: ['success', 'celebration', 'win', 'achievement', 'launch', 'rocket', 'innovation'],
      images: [
        'https://images.unsplash.com/photo-1553729459-efe14ef6055d?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1920&h=1080&fit=crop',
      ]
    },
    {
      keywords: ['call', 'action', 'cta', 'contact', 'website', 'link', 'download'],
      images: [
        'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=1920&h=1080&fit=crop',
        'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1920&h=1080&fit=crop',
      ]
    }
  ];

  for (const category of imageCategories) {
    for (const keyword of category.keywords) {
      if (promptLower.includes(keyword)) {
        const randomIndex = Math.floor(Math.random() * category.images.length);
        return category.images[randomIndex];
      }
    }
  }

  const defaultImages = [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=1920&h=1080&fit=crop',
    'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&h=1080&fit=crop',
  ];
  
  const randomIndex = Math.floor(Math.random() * defaultImages.length);
  return defaultImages[randomIndex];
}

async function generateImageWithGemini(prompt: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.log("[Runway] No Gemini API key, using contextual fallback image");
    return { success: true, imageUrl: getContextualFallbackImage(prompt) };
  }

  try {
    // Use Gemini 2.0 Flash with image generation capability
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent',
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate a high-quality, cinematic image for a video scene: ${prompt}. Make it visually striking, professional quality, suitable for video animation, 16:9 aspect ratio, photorealistic.`
            }]
          }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"]
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini image generation error:", response.status, errorText);
      
      console.log("[Runway] Falling back to contextual sample image for:", prompt.substring(0, 50));
      return { success: true, imageUrl: getContextualFallbackImage(prompt) };
    }

    const result = await response.json();
    
    // Look for image data in the response
    const candidates = result.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith('image/')) {
          const imageData = part.inlineData.data;
          const mimeType = part.inlineData.mimeType;
          const dataUrl = `data:${mimeType};base64,${imageData}`;
          console.log("[Runway] Successfully generated image with Gemini 2.0 Flash");
          return { success: true, imageUrl: dataUrl };
        }
      }
    }
    
    console.log("[Runway] No image in Gemini response, using contextual fallback");
    return { success: true, imageUrl: getContextualFallbackImage(prompt) };
  } catch (error: any) {
    console.error("Gemini image generation error:", error);
    return { success: true, imageUrl: getContextualFallbackImage(prompt) };
  }
}

export async function generateVideoWithRunway(
  prompt: string,
  options: {
    duration?: number;
    aspectRatio?: '16:9' | '9:16';
    model?: 'gen3a_turbo' | 'gen3';
    imageUrl?: string;
  } = {}
): Promise<VideoGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "RUNWAY_API_KEY not configured. Add it to your secrets.",
    };
  }

  const { duration = 5, aspectRatio = '16:9', model = 'gen3a_turbo' } = options;
  
  // Runway requires specific pixel ratios
  const runwayRatio = aspectRatio === '9:16' ? '768:1280' : '1280:768';
  let { imageUrl } = options;

  // If no image provided, generate one with Gemini
  if (!imageUrl) {
    console.log("[Runway] Generating image with Gemini first...");
    const imageResult = await generateImageWithGemini(prompt);
    if (!imageResult.success || !imageResult.imageUrl) {
      return {
        success: false,
        error: imageResult.error || "Failed to generate source image",
      };
    }
    imageUrl = imageResult.imageUrl;
    console.log("[Runway] Image generated, starting video conversion...");
  }

  try {
    const response = await fetch(`${RUNWAY_BASE_URL}/image_to_video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        promptImage: imageUrl,
        promptText: prompt,
        model,
        duration,
        ratio: runwayRatio,
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
      imageUrl,
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
    duration: 5,
    aspectRatio: '16:9',
    model: 'gen3a_turbo',
  });
}

export async function generateSocialVideo(
  topic: string,
  platform: 'tiktok' | 'reels' | 'shorts' | 'linkedin',
  mood: string = "engaging, dynamic"
): Promise<VideoGenerationResult> {
  const platformConfigs: Record<string, { aspectRatio: '16:9' | '9:16'; style: string }> = {
    tiktok: { aspectRatio: '9:16', style: "trendy, fast-paced, attention-grabbing" },
    reels: { aspectRatio: '9:16', style: "vibrant, lifestyle-focused, scroll-stopping" },
    shorts: { aspectRatio: '9:16', style: "dynamic, engaging, quick cuts" },
    linkedin: { aspectRatio: '16:9', style: "professional, polished, business-focused" },
  };

  const config = platformConfigs[platform];
  const prompt = `Create a ${platform} video about: ${topic}. Style: ${config.style}, ${mood}`;
  
  return generateVideoWithRunway(prompt, {
    duration: 5,
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
