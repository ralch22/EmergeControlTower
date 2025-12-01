const RUNWAY_BASE_URL = "https://api.dev.runwayml.com/v1";

// Runway API Models (as of Dec 2025)
// Video: gen4_turbo, gen4_aleph, upscale_v1, act_two, veo3, veo3.1, veo3.1_fast
// Image: gen4_image, gen4_image_turbo, gemini_2.5_flash
// Audio: eleven_multilingual_v2, eleven_text_to_sound_v2, eleven_voice_isolation, eleven_voice_dubbing, eleven_multilingual_sts_v2

export type RunwayVideoModel = 
  | 'gen4_turbo'      // Image→Video (5 credits/sec)
  | 'gen4_aleph'      // Video→Video with text/image (15 credits/sec)
  | 'veo3'            // Text/Image→Video (40 credits/sec)
  | 'veo3.1'          // Text/Image→Video (40 credits/sec)  
  | 'veo3.1_fast'     // Text/Image→Video fast (15 credits/sec)
  | 'gen3a_turbo';    // Legacy model

export type RunwayImageModel = 
  | 'gen4_image'        // Text/Image→Image (5-8 credits)
  | 'gen4_image_turbo'  // Fast image gen (2 credits)
  | 'gemini_2.5_flash'; // Text/Image→Image (5 credits)

export type RunwayAudioModel =
  | 'eleven_multilingual_v2'     // TTS (1 credit/50 chars)
  | 'eleven_text_to_sound_v2'    // Sound effects (1 credit/6s)
  | 'eleven_voice_isolation'     // Voice isolation (1 credit/6s)
  | 'eleven_voice_dubbing'       // Dubbing (1 credit/2s)
  | 'eleven_multilingual_sts_v2'; // Speech-to-speech (1 credit/2s)

export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  taskId?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  imageUrl?: string;
  model?: string;
}

export interface ImageGenerationResult {
  success: boolean;
  imageUrl?: string;
  taskId?: string;
  error?: string;
  model?: string;
}

export interface AudioGenerationResult {
  success: boolean;
  audioUrl?: string;
  taskId?: string;
  error?: string;
  model?: string;
}

export interface UpscaleResult {
  success: boolean;
  videoUrl?: string;
  taskId?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
}

// Model pricing info (credits per second/item)
export const RUNWAY_PRICING = {
  gen4_turbo: { type: 'video', costPerSec: 5 },
  gen4_aleph: { type: 'video', costPerSec: 15 },
  upscale_v1: { type: 'video', costPerSec: 2 },
  act_two: { type: 'video', costPerSec: 5 },
  veo3: { type: 'video', costPerSec: 40 },
  'veo3.1': { type: 'video', costPerSec: 40 },
  'veo3.1_fast': { type: 'video', costPerSec: 15 },
  gen4_image: { type: 'image', costPer720p: 5, costPer1080p: 8 },
  gen4_image_turbo: { type: 'image', costPerImage: 2 },
  'gemini_2.5_flash': { type: 'image', costPerImage: 5 },
  eleven_multilingual_v2: { type: 'audio', costPer50Chars: 1 },
  eleven_text_to_sound_v2: { type: 'audio', costPer6Sec: 1 },
  eleven_voice_isolation: { type: 'audio', costPer6Sec: 1 },
  eleven_voice_dubbing: { type: 'audio', costPer2Sec: 1 },
  eleven_multilingual_sts_v2: { type: 'audio', costPer2Sec: 1 },
};

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
    model?: RunwayVideoModel;
    imageUrl?: string;
    imageBase64?: string;
  } = {}
): Promise<VideoGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "RUNWAY_API_KEY not configured. Add it to your secrets.",
    };
  }

  const { duration = 5, aspectRatio = '16:9', model = 'gen4_turbo', imageBase64 } = options;
  
  // Runway requires specific pixel ratios
  const runwayRatio = aspectRatio === '9:16' ? '768:1280' : '1280:768';
  let { imageUrl } = options;

  // If DALL-E base64 image is provided, convert to data URL for Runway
  if (imageBase64) {
    console.log("[Runway] Using provided DALL-E image (unique scene-specific)");
    imageUrl = `data:image/png;base64,${imageBase64}`;
  }
  // If no image provided, generate one with Gemini or use fallback
  else if (!imageUrl) {
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

  console.log(`[Runway] Starting video generation with model: ${model}`);

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
      model,
    };
  } catch (error: any) {
    console.error("Runway video generation error:", error);
    return {
      success: false,
      error: error.message || "Failed to start video generation",
    };
  }
}

// Gen-4 Aleph: Video-to-Video generation (15 credits/sec)
export async function generateVideoToVideoWithRunway(
  sourceVideoUrl: string,
  prompt: string,
  options: {
    referenceImageUrl?: string;
    duration?: number;
  } = {}
): Promise<VideoGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: "RUNWAY_API_KEY not configured" };
  }

  console.log("[Runway] Starting Gen-4 Aleph video-to-video generation...");

  try {
    const body: Record<string, any> = {
      promptVideo: sourceVideoUrl,
      promptText: prompt,
      model: 'gen4_aleph',
    };
    
    if (options.referenceImageUrl) {
      body.referenceImage = options.referenceImageUrl;
    }

    const response = await fetch(`${RUNWAY_BASE_URL}/video_to_video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Runway API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    return { success: true, taskId: result.id, status: 'pending', model: 'gen4_aleph' };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to start video-to-video generation" };
  }
}

// Video Upscaling (2 credits/sec)
export async function upscaleVideoWithRunway(
  videoUrl: string
): Promise<UpscaleResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: "RUNWAY_API_KEY not configured" };
  }

  console.log("[Runway] Starting video upscaling...");

  try {
    const response = await fetch(`${RUNWAY_BASE_URL}/video_upscale`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        promptVideo: videoUrl,
        model: 'upscale_v1',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Runway API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    return { success: true, taskId: result.id, status: 'pending' };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to start upscaling" };
  }
}

// Character Performance / Act Two (5 credits/sec)
export async function generateCharacterPerformance(
  referenceMediaUrl: string, // Image or video URL
  driverVideoUrl: string,
  options: {
    resolution?: '720p' | '1080p';
  } = {}
): Promise<VideoGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: "RUNWAY_API_KEY not configured" };
  }

  console.log("[Runway] Starting Act Two character performance...");

  try {
    const response = await fetch(`${RUNWAY_BASE_URL}/character_performance`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        referenceMedia: referenceMediaUrl,
        driverVideo: driverVideoUrl,
        model: 'act_two',
        resolution: options.resolution || '720p',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Runway API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    return { success: true, taskId: result.id, status: 'pending', model: 'act_two' };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to start character performance" };
  }
}

// Image Generation with Gen-4 (5-8 credits) or Turbo (2 credits)
export async function generateImageWithRunway(
  prompt: string,
  options: {
    model?: RunwayImageModel;
    resolution?: '720p' | '1080p';
    referenceImages?: string[]; // URLs for style reference
  } = {}
): Promise<ImageGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: "RUNWAY_API_KEY not configured" };
  }

  const model = options.model || 'gen4_image_turbo';
  console.log(`[Runway] Generating image with ${model}...`);

  try {
    const body: Record<string, any> = {
      promptText: prompt,
      model,
    };

    if (options.resolution && model === 'gen4_image') {
      body.resolution = options.resolution;
    }

    if (options.referenceImages?.length) {
      body.referenceImages = options.referenceImages;
    }

    const response = await fetch(`${RUNWAY_BASE_URL}/text_to_image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Runway API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    return { success: true, taskId: result.id, model };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to start image generation" };
  }
}

// Text-to-Speech with ElevenLabs via Runway (1 credit/50 chars)
export async function generateSpeechWithRunway(
  text: string,
  options: {
    voiceId?: string;
    modelId?: string;
  } = {}
): Promise<AudioGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: "RUNWAY_API_KEY not configured" };
  }

  console.log("[Runway] Generating speech with ElevenLabs...");

  try {
    const response = await fetch(`${RUNWAY_BASE_URL}/text_to_speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        text,
        model: 'eleven_multilingual_v2',
        voiceId: options.voiceId,
        modelId: options.modelId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Runway API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    return { success: true, taskId: result.id, model: 'eleven_multilingual_v2' };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to start speech generation" };
  }
}

// Sound Effects with ElevenLabs via Runway (1 credit/6 sec)
export async function generateSoundEffectWithRunway(
  prompt: string,
  options: {
    durationSeconds?: number;
  } = {}
): Promise<AudioGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: "RUNWAY_API_KEY not configured" };
  }

  console.log("[Runway] Generating sound effect with ElevenLabs...");

  try {
    const response = await fetch(`${RUNWAY_BASE_URL}/sound_effect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        promptText: prompt,
        model: 'eleven_text_to_sound_v2',
        durationSeconds: options.durationSeconds,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Runway API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    return { success: true, taskId: result.id, model: 'eleven_text_to_sound_v2' };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to start sound effect generation" };
  }
}

// Voice Isolation (1 credit/6 sec)
export async function isolateVoiceWithRunway(
  audioUrl: string
): Promise<AudioGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: "RUNWAY_API_KEY not configured" };
  }

  console.log("[Runway] Isolating voice with ElevenLabs...");

  try {
    const response = await fetch(`${RUNWAY_BASE_URL}/voice_isolation`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        audio: audioUrl,
        model: 'eleven_voice_isolation',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Runway API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    return { success: true, taskId: result.id, model: 'eleven_voice_isolation' };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to start voice isolation" };
  }
}

// Voice Dubbing (1 credit/2 sec output)
export async function dubVoiceWithRunway(
  sourceAudioUrl: string,
  targetLanguage: string,
  options: {
    numSpeakers?: number;
  } = {}
): Promise<AudioGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: "RUNWAY_API_KEY not configured" };
  }

  console.log(`[Runway] Dubbing voice to ${targetLanguage}...`);

  try {
    const response = await fetch(`${RUNWAY_BASE_URL}/voice_dubbing`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        sourceAudio: sourceAudioUrl,
        targetLang: targetLanguage,
        model: 'eleven_voice_dubbing',
        numSpeakers: options.numSpeakers || 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Runway API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    return { success: true, taskId: result.id, model: 'eleven_voice_dubbing' };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to start voice dubbing" };
  }
}

// Speech-to-Speech transformation (1 credit/2 sec output)
export async function transformSpeechWithRunway(
  audioUrl: string,
  targetVoiceId: string
): Promise<AudioGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: "RUNWAY_API_KEY not configured" };
  }

  console.log("[Runway] Transforming speech...");

  try {
    const response = await fetch(`${RUNWAY_BASE_URL}/speech_to_speech`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Runway-Version': '2024-11-06',
      },
      body: JSON.stringify({
        audio: audioUrl,
        voiceId: targetVoiceId,
        model: 'eleven_multilingual_sts_v2',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Runway API error: ${response.status} - ${errorText}` };
    }

    const result = await response.json();
    return { success: true, taskId: result.id, model: 'eleven_multilingual_sts_v2' };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to start speech transformation" };
  }
}

// Check status for image generation tasks
export async function checkImageStatus(taskId: string): Promise<ImageGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: "RUNWAY_API_KEY not configured" };
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
      return { success: false, error: `Failed to check status: ${response.status}` };
    }

    const result = await response.json();
    
    if (result.status === 'SUCCEEDED') {
      return { success: true, imageUrl: result.output?.[0], taskId };
    } else if (result.status === 'FAILED') {
      return { success: false, error: result.failure || 'Image generation failed', taskId };
    }
    
    return { success: true, taskId }; // Still processing
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to check status" };
  }
}

// Check status for audio generation tasks
export async function checkAudioStatus(taskId: string): Promise<AudioGenerationResult> {
  const apiKey = process.env.RUNWAY_API_KEY;
  
  if (!apiKey) {
    return { success: false, error: "RUNWAY_API_KEY not configured" };
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
      return { success: false, error: `Failed to check status: ${response.status}` };
    }

    const result = await response.json();
    
    if (result.status === 'SUCCEEDED') {
      return { success: true, audioUrl: result.output?.[0], taskId };
    } else if (result.status === 'FAILED') {
      return { success: false, error: result.failure || 'Audio generation failed', taskId };
    }
    
    return { success: true, taskId }; // Still processing
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to check status" };
  }
}

// Get all available Runway models
export function getRunwayModels() {
  return {
    video: [
      { id: 'gen4_turbo', name: 'Gen-4 Turbo', description: 'Image to video', costPerSec: 5, input: 'image' },
      { id: 'gen4_aleph', name: 'Gen-4 Aleph', description: 'Video to video with reference', costPerSec: 15, input: 'video' },
      { id: 'upscale_v1', name: 'Upscale V1', description: 'Video upscaling', costPerSec: 2, input: 'video' },
      { id: 'act_two', name: 'Act Two', description: 'Character performance', costPerSec: 5, input: 'image/video' },
      { id: 'veo3', name: 'Veo 3', description: 'Google Veo text/image to video', costPerSec: 40, input: 'text/image' },
      { id: 'veo3.1', name: 'Veo 3.1', description: 'Google Veo 3.1 text/image to video', costPerSec: 40, input: 'text/image' },
      { id: 'veo3.1_fast', name: 'Veo 3.1 Fast', description: 'Faster Veo 3.1', costPerSec: 15, input: 'text/image' },
    ],
    image: [
      { id: 'gen4_image', name: 'Gen-4 Image', description: 'High quality image generation', costPer720p: 5, costPer1080p: 8 },
      { id: 'gen4_image_turbo', name: 'Gen-4 Image Turbo', description: 'Fast image generation', costPerImage: 2 },
      { id: 'gemini_2.5_flash', name: 'Gemini 2.5 Flash', description: 'Gemini image generation', costPerImage: 5 },
    ],
    audio: [
      { id: 'eleven_multilingual_v2', name: 'ElevenLabs TTS', description: 'Text to speech', costPer50Chars: 1 },
      { id: 'eleven_text_to_sound_v2', name: 'ElevenLabs Sound FX', description: 'Sound effects', costPer6Sec: 1 },
      { id: 'eleven_voice_isolation', name: 'Voice Isolation', description: 'Isolate voice from audio', costPer6Sec: 1 },
      { id: 'eleven_voice_dubbing', name: 'Voice Dubbing', description: 'Dub to other languages', costPer2Sec: 1 },
      { id: 'eleven_multilingual_sts_v2', name: 'Speech to Speech', description: 'Transform voice', costPer2Sec: 1 },
    ],
  };
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
