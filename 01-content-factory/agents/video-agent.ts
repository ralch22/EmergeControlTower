import { generateVideoFromText, waitForVideoCompletion } from "../integrations/runway";
import { generateSceneImageWithAlibaba, isAlibabaImageConfigured } from "../integrations/alibaba-image";
import { generateImageWithFal, isFalConfigured } from "../integrations/fal-ai";
import { generateVideoScriptWithFallback } from "../services/text-generation";
import type { ClientBrief, ContentTopic, GeneratedContent, AgentResponse } from "../types";

const SYSTEM_PROMPT = `You are a video content strategist and scriptwriter. You create engaging video scripts optimized for:

- Social media (TikTok, Reels, Shorts)
- YouTube content
- LinkedIn video
- Explainer videos

You understand pacing, hooks, visual storytelling, and platform-specific formats. Create scripts that are easy to produce and highly engaging.`;

export interface VideoScript {
  hook: string;
  scenes: VideoScene[];
  callToAction: string;
  duration: number;
  voiceoverText: string;
}

export interface VideoScene {
  sceneNumber: number;
  duration: number;
  visualDescription: string;
  voiceover: string;
  textOverlay?: string;
  thumbnailUrl?: string;
}

async function generateSceneThumbnail(visualDescription: string, sceneNumber: number): Promise<string | undefined> {
  const shortPrompt = visualDescription.length > 200 
    ? visualDescription.substring(0, 200) + '...'
    : visualDescription;
  
  console.log(`[VideoAgent] Generating thumbnail for scene ${sceneNumber}...`);
  
  if (isAlibabaImageConfigured()) {
    try {
      const result = await generateSceneImageWithAlibaba(shortPrompt, '16:9');
      if (result.success && result.imageUrl) {
        console.log(`[VideoAgent] Scene ${sceneNumber} thumbnail generated via Alibaba`);
        return result.imageUrl;
      }
    } catch (error) {
      console.log(`[VideoAgent] Alibaba image failed for scene ${sceneNumber}:`, error);
    }
  }
  
  if (isFalConfigured()) {
    try {
      const result = await generateImageWithFal(
        `Cinematic video frame: ${shortPrompt}. Professional cinematography, high quality.`,
        { width: 1280, height: 720 }
      );
      if (result.success && result.imageUrl) {
        console.log(`[VideoAgent] Scene ${sceneNumber} thumbnail generated via Fal AI`);
        return result.imageUrl;
      }
    } catch (error) {
      console.log(`[VideoAgent] Fal AI image failed for scene ${sceneNumber}:`, error);
    }
  }
  
  console.log(`[VideoAgent] No thumbnail generated for scene ${sceneNumber}`);
  return undefined;
}

function buildBrandVisualContext(brief: ClientBrief): string {
  const config = brief.brandVoiceConfig;
  if (!config) {
    return "**Brand Visual Guidelines:** Use professional, modern, clean visuals with high contrast.";
  }
  
  const parts: string[] = [];
  
  if (config.visualStyle && config.visualStyle.trim()) {
    parts.push(`- Visual Style: ${config.visualStyle.trim()}`);
  }
  
  const validColors = config.colorPalette?.filter(c => c && c.trim()) || [];
  if (validColors.length > 0) {
    parts.push(`- Color Palette: ${validColors.join(', ')}`);
  }
  
  const validFonts = config.fonts?.filter(f => f && f.trim()) || [];
  if (validFonts.length > 0) {
    parts.push(`- Fonts: ${validFonts.join(', ')}`);
  }
  
  if (config.referenceAssets && Object.keys(config.referenceAssets).length > 0) {
    const assetsList = Object.entries(config.referenceAssets)
      .filter(([_, path]) => path && path.trim())
      .map(([name, path]) => `${name}: ${path}`)
      .join(', ');
    if (assetsList) {
      parts.push(`- Reference Assets: ${assetsList}`);
    }
  }
  
  if (config.cinematicGuidelines && config.cinematicGuidelines.trim()) {
    parts.push(`- Cinematic Guidelines: ${config.cinematicGuidelines.trim()}`);
  }
  
  if (parts.length === 0) {
    return "**Brand Visual Guidelines:** Use professional, modern, clean visuals with high contrast.";
  }
  
  return `**Brand Visual Guidelines:**\n${parts.join('\n')}`;
}

export async function generateVideoScript(
  topic: ContentTopic,
  brief: ClientBrief,
  options: {
    duration?: number;
    format?: 'short' | 'medium' | 'long';
    style?: 'talking_head' | 'b_roll' | 'animated' | 'mixed';
  } = {}
): Promise<AgentResponse<GeneratedContent>> {
  try {
    const { duration = 60, format = 'short', style = 'mixed' } = options;
    
    const brandVisualContext = buildBrandVisualContext(brief);
    
    const userPrompt = `Create a video script for ${brief.clientName}.

**Topic:** ${topic.title}
**Angle:** ${topic.angle}
**Target Audience:** ${brief.targetAudience}
**Brand Voice:** ${brief.brandVoice}

${brandVisualContext}

**Video Requirements:**
- Duration: ${duration} seconds
- Format: ${format} (${format === 'short' ? '15-60s' : format === 'medium' ? '1-3 min' : '3-10 min'})
- Style: ${style}

IMPORTANT: All visual descriptions MUST incorporate the brand visual style, color palette, and cinematic guidelines above.

Create a complete video script with:
1. Hook (first 3 seconds to stop scrolling)
2. Scene-by-scene breakdown
3. Visual descriptions for each scene (following brand visual style)
4. Voiceover/dialogue script
5. Text overlays suggestions (using brand fonts if specified)
6. Call-to-action

Output as JSON:
{
  "hook": "Opening line that hooks viewers",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": 3,
      "visualDescription": "What appears on screen incorporating brand visual style",
      "voiceover": "What is said",
      "textOverlay": "Optional text on screen"
    }
  ],
  "callToAction": "Final CTA",
  "duration": ${duration},
  "voiceoverText": "Full voiceover script combined"
}`;

    console.log(`[VideoAgent] Generating video script with text fallback system...`);
    const textResult = await generateVideoScriptWithFallback(SYSTEM_PROMPT, userPrompt, {
      maxTokens: 3000,
      temperature: 0.7,
    });

    if (!textResult.success || !textResult.content) {
      throw new Error(textResult.error || "Failed to generate video script");
    }
    
    console.log(`[VideoAgent] Script generated using provider: ${textResult.provider}`);
    const response = textResult.content;

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse video script JSON");
    }

    const scriptData: VideoScript = JSON.parse(jsonMatch[0]);

    console.log(`[VideoAgent] Generating thumbnails for ${scriptData.scenes?.length || 0} scenes...`);
    
    const sceneThumbnails: Record<number, string> = {};
    const maxThumbnails = Math.min(scriptData.scenes?.length || 0, 5);
    
    const thumbnailPromises = scriptData.scenes?.slice(0, maxThumbnails).map(async (scene) => {
      const thumbnailUrl = await generateSceneThumbnail(scene.visualDescription, scene.sceneNumber);
      if (thumbnailUrl) {
        sceneThumbnails[scene.sceneNumber] = thumbnailUrl;
        scene.thumbnailUrl = thumbnailUrl;
      }
    }) || [];
    
    await Promise.all(thumbnailPromises);
    
    console.log(`[VideoAgent] Generated ${Object.keys(sceneThumbnails).length} scene thumbnails`);

    let videoUrl: string | undefined;
    let videoTaskId: string | undefined;
    
    if (process.env.RUNWAY_API_KEY) {
      try {
        const videoPrompt = scriptData.scenes
          .map(s => s.visualDescription)
          .slice(0, 2)
          .join('. ');
        
        const videoResult = await generateVideoFromText(
          videoPrompt,
          style === 'animated' ? 'animated, motion graphics' : 'cinematic, professional'
        );
        
        if (videoResult.success && videoResult.taskId) {
          videoTaskId = videoResult.taskId;
          console.log(`[VideoAgent] Video generation started, task ID: ${videoTaskId}`);
          
          const completedVideo = await waitForVideoCompletion(videoTaskId, 120, 10);
          if (completedVideo.success && completedVideo.videoUrl) {
            videoUrl = completedVideo.videoUrl;
            console.log(`[VideoAgent] Video generated: ${videoUrl}`);
          } else if (completedVideo.status === 'processing') {
            console.log(`[VideoAgent] Video still processing, task ID saved for later retrieval`);
          } else {
            console.log(`[VideoAgent] Video generation failed: ${completedVideo.error}`);
          }
        }
      } catch (videoError) {
        console.log("[VideoAgent] Video generation skipped:", videoError);
      }
    }

    const generatedContent: GeneratedContent = {
      id: `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topicId: topic.id,
      clientId: brief.clientId,
      type: 'video_script',
      title: `${topic.title} - Video Script`,
      content: JSON.stringify(scriptData, null, 2),
      metadata: {
        wordCount: scriptData.voiceoverText?.split(/\s+/).length || 0,
        videoTaskId,
        videoUrl,
        sceneThumbnails,
      },
      status: 'draft',
      createdAt: new Date(),
    };

    return {
      success: true,
      data: generatedContent,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to generate video script",
    };
  }
}

export async function generateElevenLabsVoiceover(
  script: string,
  voiceId: string = 'default'
): Promise<AgentResponse<{ audioUrl: string }>> {
  if (!process.env.ELEVENLABS_API_KEY) {
    return {
      success: false,
      error: "ElevenLabs API key not configured. Add ELEVENLABS_API_KEY to secrets.",
    };
  }

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: script,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.statusText}`);
    }

    return {
      success: true,
      data: { audioUrl: 'Voiceover generated - audio data available' },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to generate voiceover",
    };
  }
}
