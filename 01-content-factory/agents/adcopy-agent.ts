import { generateWithClaude } from "../integrations/anthropic";
import { generateImageWithNanoBananaPro } from "../integrations/nano-banana-pro";
import type { ClientBrief, ContentTopic, GeneratedContent, ContentType, AgentResponse, EnrichedClientBrief } from "../types";
import { 
  formatTextualBriefForPrompt, 
  buildSystemPromptSuffix,
  buildReferenceConstrainedImagePrompt,
  getEffectiveCTA,
  hasReferenceAsset
} from "../services/brand-brief";

const AD_CONFIGS = {
  facebook_ad: {
    primaryTextLimit: 125,
    headlineLimit: 40,
    descriptionLimit: 30,
    variations: 3,
  },
  google_ad: {
    headlineLimit: 30,
    descriptionLimit: 90,
    variations: 3,
  },
};

function buildAdCopySystemPrompt(brief: EnrichedClientBrief, platform: string): string {
  const baseSuffix = buildSystemPromptSuffix(brief);
  
  return `You are a direct-response copywriter specializing in ${platform} advertising. You create high-converting ad copy that:

- Captures attention in the first 3 words
- Addresses pain points: ${brief.textual.audiencePainPoints.slice(0, 3).join(', ') || 'audience challenges'}
- Uses power words and emotional triggers
- Includes clear value propositions aligned with brand values
- Has irresistible calls-to-action
- A/B tests through multiple variations

${baseSuffix}

You understand platform policies and character limits. Create copy that converts while maintaining brand integrity.`;
}

export async function generateAdCopy(
  topic: ContentTopic,
  brief: ClientBrief | EnrichedClientBrief,
  platform: 'facebook_ad' | 'google_ad'
): Promise<AgentResponse<GeneratedContent>> {
  try {
    const config = AD_CONFIGS[platform];
    const isEnriched = 'textual' in brief && 'visual' in brief;
    const enrichedBrief = brief as EnrichedClientBrief;
    
    const brandContext = isEnriched 
      ? formatTextualBriefForPrompt(enrichedBrief)
      : `Target Audience: ${brief.targetAudience}\nContent Goals: ${brief.contentGoals.join(', ')}${brief.websiteUrl ? `\nWebsite Reference: ${brief.websiteUrl} (maintain brand consistency with website)` : ''}`;
    
    const systemPrompt = isEnriched 
      ? buildAdCopySystemPrompt(enrichedBrief, platform)
      : `You are a direct-response copywriter. Create high-converting ad copy for ${brief.clientName}.${brief.websiteUrl ? ` Use ${brief.websiteUrl} as a reference for brand style and tone.` : ''}`;
    
    const effectiveCta = isEnriched ? getEffectiveCTA(enrichedBrief) : brief.contentGoals?.[0];
    const forbiddenWords = isEnriched ? enrichedBrief.textual.forbiddenWords : [];
    const preferredCtas = isEnriched ? enrichedBrief.textual.callToActions : [];
    
    const userPrompt = `Create ${config.variations} ad variations for ${platform === 'facebook_ad' ? 'Facebook/Meta' : 'Google'} Ads.

**Product/Service:** ${brief.clientName}
**Topic/Offer:** ${topic.title}
**Angle:** ${topic.angle}
**Keywords:** ${topic.keywords.join(', ')}

${brandContext}

${platform === 'facebook_ad' ? `
**Facebook Ad Requirements:**
- Primary Text: Max ${(config as typeof AD_CONFIGS['facebook_ad']).primaryTextLimit} characters
- Headline: Max ${config.headlineLimit} characters
- Description: Max ${config.descriptionLimit} characters
` : `
**Google Ad Requirements:**
- Headlines (3): Max ${config.headlineLimit} characters each
- Descriptions (2): Max ${config.descriptionLimit} characters each
`}

${preferredCtas.length ? `**Preferred CTAs to use:** ${preferredCtas.join(' | ')}` : ''}
${forbiddenWords.length ? `**NEVER use these words:** ${forbiddenWords.join(', ')}` : ''}

Create ${config.variations} variations with different angles:
1. Problem-agitate-solve approach (address pain points: ${isEnriched ? enrichedBrief.textual.audiencePainPoints.slice(0, 2).join(', ') : 'audience challenges'})
2. Benefit-focused approach (align with goals: ${isEnriched ? enrichedBrief.textual.audienceGoals.slice(0, 2).join(', ') : 'desired outcomes'})
3. Social proof / urgency approach

Each variation must:
- Match the ${isEnriched ? enrichedBrief.textual.archetype : 'professional'} brand personality
- Use ${isEnriched ? enrichedBrief.textual.toneDescription : 'brand-appropriate'} tone
${effectiveCta ? `- Drive toward CTA: "${effectiveCta}"` : '- Include compelling CTA'}

Format output as JSON:
{
  "variations": [
    {
      "name": "Variation 1 - Problem/Solution",
      ${platform === 'facebook_ad' ? `
      "primaryText": "...",
      "headline": "...",
      "description": "..."` : `
      "headlines": ["...", "...", "..."],
      "descriptions": ["...", "..."]`}
    }
  ]
}`;

    const response = await generateWithClaude(systemPrompt, userPrompt, {
      maxTokens: 2048,
      temperature: 0.8,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const adData = jsonMatch ? JSON.parse(jsonMatch[0]) : { variations: [] };

    let imageDataUrl: string | undefined;
    
    const geminiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    if (geminiKey) {
      try {
        console.log(`[AdCopyAgent] Generating ad creative image with Nano Banana Pro for ${platform}...`);
        
        const basePrompt = `Advertisement creative for: ${brief.clientName} - ${topic.title}. Marketing focused, conversion-optimized.`;
        
        const adStyle = platform === 'facebook_ad' 
          ? 'eye-catching, scroll-stopping, vibrant colors, clear focal point, marketing focused'
          : 'clean, professional, minimal, high contrast, conversion-optimized';
        
        let imagePrompt: string;
        if (isEnriched && hasReferenceAsset(enrichedBrief)) {
          const { prompt } = buildReferenceConstrainedImagePrompt(enrichedBrief, basePrompt, {
            strictMode: true,
            imageType: 'ad',
          });
          imagePrompt = prompt;
          console.log(`[AdCopyAgent] Using reference-constrained prompt with brand logo`);
        } else if (isEnriched) {
          const { prompt } = buildReferenceConstrainedImagePrompt(enrichedBrief, basePrompt, {
            strictMode: false,
            imageType: 'ad',
          });
          imagePrompt = prompt;
        } else {
          imagePrompt = basePrompt;
        }
        
        const imageResult = await generateImageWithNanoBananaPro(
          imagePrompt,
          {
            resolution: '2K',
            style: isEnriched 
              ? `${enrichedBrief.visual.aesthetic.join(', ')}, ${adStyle}`
              : adStyle,
          }
        );
        
        if (imageResult.success && imageResult.imageDataUrl) {
          imageDataUrl = imageResult.imageDataUrl;
          console.log(`[AdCopyAgent] Image generated for ${platform}`);
        } else {
          console.log(`[AdCopyAgent] Image generation failed for ${platform}: ${imageResult.error}`);
        }
      } catch (imageError: any) {
        console.log(`[AdCopyAgent] Image generation error for ${platform}:`, imageError.message);
      }
    } else {
      console.log(`[AdCopyAgent] Skipping image generation - no Gemini API key configured`);
    }

    const generatedContent: GeneratedContent = {
      id: `${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topicId: topic.id,
      clientId: brief.clientId,
      type: platform as ContentType,
      title: `${topic.title} - Ad Copy`,
      content: JSON.stringify(adData, null, 2),
      metadata: {
        callToAction: effectiveCta || 'Learn More',
        imageDataUrl,
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
      error: error.message || `Failed to generate ${platform} copy`,
    };
  }
}

export async function generateAllAdCopy(
  topic: ContentTopic,
  brief: ClientBrief | EnrichedClientBrief
): Promise<AgentResponse<GeneratedContent[]>> {
  try {
    const [facebookResult, googleResult] = await Promise.all([
      generateAdCopy(topic, brief, 'facebook_ad'),
      generateAdCopy(topic, brief, 'google_ad'),
    ]);

    const successfulAds = [facebookResult, googleResult]
      .filter(r => r.success && r.data)
      .map(r => r.data as GeneratedContent);

    return {
      success: successfulAds.length > 0,
      data: successfulAds,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to generate ad copy",
    };
  }
}
