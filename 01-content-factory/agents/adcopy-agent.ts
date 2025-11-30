import { generateWithClaude } from "../integrations/anthropic";
import { generateAdCreativeImage } from "../integrations/gemini-image";
import type { ClientBrief, ContentTopic, GeneratedContent, ContentType, AgentResponse } from "../types";

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

const SYSTEM_PROMPT = `You are a direct-response copywriter specializing in paid advertising. You create high-converting ad copy that:

- Captures attention in the first 3 words
- Addresses pain points and desires
- Uses power words and emotional triggers
- Includes clear value propositions
- Has irresistible calls-to-action
- A/B tests through multiple variations

You understand platform policies and character limits. Create copy that converts.`;

export async function generateAdCopy(
  topic: ContentTopic,
  brief: ClientBrief,
  platform: 'facebook_ad' | 'google_ad'
): Promise<AgentResponse<GeneratedContent>> {
  try {
    const config = AD_CONFIGS[platform];
    
    const userPrompt = `Create ${config.variations} ad variations for ${platform === 'facebook_ad' ? 'Facebook/Meta' : 'Google'} Ads.

**Product/Service:** ${brief.clientName}
**Topic/Offer:** ${topic.title}
**Angle:** ${topic.angle}
**Target Audience:** ${brief.targetAudience}
**Keywords:** ${topic.keywords.join(', ')}
**Content Goals:** ${brief.contentGoals.join(', ')}

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

Create ${config.variations} variations with different angles:
1. Problem-agitate-solve approach
2. Benefit-focused approach
3. Social proof / urgency approach

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

    const response = await generateWithClaude(SYSTEM_PROMPT, userPrompt, {
      maxTokens: 2048,
      temperature: 0.8,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    const adData = jsonMatch ? JSON.parse(jsonMatch[0]) : { variations: [] };

    let imageDataUrl: string | undefined;
    
    if (process.env.AI_INTEGRATIONS_GEMINI_API_KEY && platform === 'facebook_ad') {
      try {
        const imageResult = await generateAdCreativeImage(
          `${brief.clientName} - ${topic.title}`,
          platform
        );
        
        if (imageResult.success && imageResult.imageDataUrl) {
          imageDataUrl = imageResult.imageDataUrl;
          console.log(`[AdCopyAgent] Image generated for ${platform}`);
        }
      } catch (imageError) {
        console.log(`[AdCopyAgent] Image generation skipped for ${platform}:`, imageError);
      }
    }

    const generatedContent: GeneratedContent = {
      id: `${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topicId: topic.id,
      clientId: brief.clientId,
      type: platform as ContentType,
      title: `${topic.title} - Ad Copy`,
      content: JSON.stringify(adData, null, 2),
      metadata: {
        callToAction: brief.contentGoals?.[0] || 'Learn More',
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
  brief: ClientBrief
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
