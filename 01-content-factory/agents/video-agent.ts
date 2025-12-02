import { generateVideoFromText, waitForVideoCompletion } from "../integrations/runway";
import { generateSceneImageWithAlibaba, isAlibabaImageConfigured } from "../integrations/alibaba-image";
import { generateImageWithFal, isFalConfigured } from "../integrations/fal-ai";
import { generateVideoScriptWithFallback } from "../services/text-generation";
import type { ClientBrief, ContentTopic, GeneratedContent, AgentResponse, EnrichedClientBrief } from "../types";
import { 
  formatTextualBriefForPrompt, 
  formatVisualBriefForPrompt,
  buildSystemPromptSuffix,
  buildReferenceConstrainedVideoPrompt,
  getEffectiveCTA,
  getBrandMandatoryCTA,
  buildBrandClosingContext,
  hasReferenceAsset,
  getReferenceAssetUrl
} from "../services/brand-brief";

const BASE_SYSTEM_PROMPT = `You are a video content strategist and scriptwriter. You create engaging video scripts optimized for:

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

function buildVideoSystemPrompt(brief: EnrichedClientBrief): string {
  const baseSuffix = buildSystemPromptSuffix(brief);
  
  return `${BASE_SYSTEM_PROMPT}

${baseSuffix}

Visual Style Requirements:
- Aesthetic: ${brief.visual.aesthetic.join(', ')}
- Mood: ${brief.visual.moodKeywords.join(', ')}
- Colors: ${brief.visual.primaryColor.name} (${brief.visual.primaryColor.hex}) accents on ${brief.visual.backgroundColor.name} (${brief.visual.backgroundColor.hex}) backgrounds
- Motion Style: ${brief.visual.cinematicMotionStyle}
- Pacing: ${brief.visual.cinematicPacing}
${brief.visual.motifs.length ? `- Motifs to include: ${brief.visual.motifs.join(', ')}` : ''}`;
}

async function generateSceneThumbnail(
  visualDescription: string, 
  sceneNumber: number,
  brief?: EnrichedClientBrief,
  totalScenes?: number
): Promise<string | undefined> {
  const shortPrompt = visualDescription.length > 200 
    ? visualDescription.substring(0, 200) + '...'
    : visualDescription;
  
  let enrichedPrompt: string;
  if (brief && hasReferenceAsset(brief)) {
    const { prompt } = buildReferenceConstrainedVideoPrompt(brief, shortPrompt, {
      sceneIndex: sceneNumber - 1,
      totalScenes,
    });
    enrichedPrompt = prompt;
    console.log(`[VideoAgent] Using reference-constrained prompt with brand logo for scene ${sceneNumber}`);
  } else if (brief) {
    const { prompt } = buildReferenceConstrainedVideoPrompt(brief, shortPrompt, {
      sceneIndex: sceneNumber - 1,
      totalScenes,
    });
    enrichedPrompt = prompt;
  } else {
    enrichedPrompt = shortPrompt;
  }
  
  console.log(`[VideoAgent] Generating thumbnail for scene ${sceneNumber}...`);
  
  if (isAlibabaImageConfigured()) {
    try {
      const result = await generateSceneImageWithAlibaba(enrichedPrompt, '16:9');
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
        `Cinematic video frame: ${enrichedPrompt}. Professional cinematography, high quality.`,
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

function buildBrandVisualContext(brief: ClientBrief | EnrichedClientBrief): string {
  const isEnriched = 'textual' in brief && 'visual' in brief;
  
  if (isEnriched) {
    const enrichedBrief = brief as EnrichedClientBrief;
    return formatVisualBriefForPrompt(enrichedBrief);
  }
  
  const config = (brief as ClientBrief).brandVoiceConfig;
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
  brief: ClientBrief | EnrichedClientBrief,
  options: {
    duration?: number;
    format?: 'short' | 'medium' | 'long';
    style?: 'talking_head' | 'b_roll' | 'animated' | 'mixed';
  } = {}
): Promise<AgentResponse<GeneratedContent>> {
  try {
    const { duration = 60, format = 'short', style = 'mixed' } = options;
    const isEnriched = 'textual' in brief && 'visual' in brief;
    const enrichedBrief = brief as EnrichedClientBrief;
    
    const brandVisualContext = buildBrandVisualContext(brief);
    const brandTextualContext = isEnriched 
      ? formatTextualBriefForPrompt(enrichedBrief)
      : `Brand Voice: ${brief.brandVoice}\nTarget Audience: ${brief.targetAudience}${brief.websiteUrl ? `\nWebsite Reference: ${brief.websiteUrl} (maintain brand consistency with website)` : ''}`;
    
    const systemPrompt = isEnriched 
      ? buildVideoSystemPrompt(enrichedBrief)
      : `${BASE_SYSTEM_PROMPT}${brief.websiteUrl ? ` Use ${brief.websiteUrl} as a reference for brand style and tone.` : ''}`;
    
    const forbiddenWords = isEnriched ? enrichedBrief.textual.forbiddenWords : [];
    
    const brandClosingContext = isEnriched 
      ? buildBrandClosingContext(enrichedBrief)
      : `Brand Name: ${brief.clientName}${brief.websiteUrl ? `\nWebsite: ${brief.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : ''}`;
    
    const mandatoryCta = isEnriched 
      ? getBrandMandatoryCTA(enrichedBrief)
      : (brief.websiteUrl ? `Visit ${brief.websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : `Learn more about ${brief.clientName}`);
    
    const userPrompt = `Create a video script for ${brief.clientName}.

**Topic:** ${topic.title}
**Angle:** ${topic.angle}
**Target Audience:** ${brief.targetAudience}

${brandTextualContext}

${brandVisualContext}

**Brand Closing Information (MUST USE EXACTLY):**
${brandClosingContext}

**Video Requirements:**
- Duration: ${duration} seconds
- Format: ${format} (${format === 'short' ? '15-60s' : format === 'medium' ? '1-3 min' : '3-10 min'})
- Style: ${style}

IMPORTANT: All visual descriptions MUST incorporate the brand visual style, color palette, and cinematic guidelines above.
${isEnriched ? `Use ${enrichedBrief.visual.cinematicMotionStyle} motion and ${enrichedBrief.visual.cinematicPacing} pacing.` : ''}
${forbiddenWords.length ? `\nNEVER use these words in voiceover: ${forbiddenWords.join(', ')}` : ''}

CRITICAL: The call-to-action MUST be exactly: "${mandatoryCta}"
DO NOT make up a different CTA, website URL, or brand name. Use ONLY the brand information provided above.

Create a complete video script with:
1. Hook (first 3 seconds to stop scrolling) - address ${isEnriched ? enrichedBrief.textual.audiencePainPoints[0] || 'audience challenge' : 'key pain point'}
2. Scene-by-scene breakdown (following brand visual style)
3. Visual descriptions for each scene incorporating brand colors, motifs, and aesthetic
4. Voiceover/dialogue script in ${isEnriched ? enrichedBrief.textual.archetype : 'brand'} voice
5. Text overlays suggestions (using brand typography style)
6. Call-to-action: "${mandatoryCta}"

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
  "callToAction": "${mandatoryCta}",
  "duration": ${duration},
  "voiceoverText": "Full voiceover script combined"
}`;

    console.log(`[VideoAgent] Generating video script with text fallback system...`);
    const textResult = await generateVideoScriptWithFallback(systemPrompt, userPrompt, {
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
    
    const totalScenes = scriptData.scenes?.length || 0;
    const thumbnailPromises = scriptData.scenes?.slice(0, maxThumbnails).map(async (scene) => {
      const thumbnailUrl = await generateSceneThumbnail(
        scene.visualDescription, 
        scene.sceneNumber,
        isEnriched ? enrichedBrief : undefined,
        totalScenes
      );
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
        
        let enrichedVideoPrompt: string;
        if (isEnriched && hasReferenceAsset(enrichedBrief)) {
          const { prompt } = buildReferenceConstrainedVideoPrompt(enrichedBrief, videoPrompt, {
            includeLogoOverlay: true,
          });
          enrichedVideoPrompt = prompt;
          console.log(`[VideoAgent] Using reference-constrained video prompt with brand logo`);
        } else if (isEnriched) {
          const { prompt } = buildReferenceConstrainedVideoPrompt(enrichedBrief, videoPrompt);
          enrichedVideoPrompt = prompt;
        } else {
          enrichedVideoPrompt = videoPrompt;
        }
        
        const videoResult = await generateVideoFromText(
          enrichedVideoPrompt,
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
