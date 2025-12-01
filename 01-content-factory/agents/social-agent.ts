import { generateWithClaude } from "../integrations/anthropic";
import { generateSocialMediaGraphic } from "../integrations/nano-banana-pro";
import type { ClientBrief, ContentTopic, GeneratedContent, ContentType, AgentResponse, EnrichedClientBrief } from "../types";
import { 
  formatTextualBriefForPrompt, 
  buildSystemPromptSuffix,
  buildImagePromptEnrichment,
  getEffectiveCTA 
} from "../services/brand-brief";

const PLATFORM_CONFIGS = {
  linkedin: {
    maxChars: 3000,
    style: "Professional, thought-leadership focused, use line breaks for readability, include 3-5 relevant hashtags",
    tone: "authoritative yet approachable",
  },
  twitter: {
    maxChars: 280,
    style: "Punchy, conversational, use emojis sparingly, include 1-2 hashtags",
    tone: "witty and engaging",
  },
  instagram: {
    maxChars: 2200,
    style: "Visual-first caption, storytelling format, heavy hashtag usage (20-30), include call-to-action",
    tone: "authentic and relatable",
  },
};

function buildSocialSystemPrompt(brief: EnrichedClientBrief, platform: string): string {
  const baseSuffix = buildSystemPromptSuffix(brief);
  
  return `You are a social media content expert who creates scroll-stopping posts for ${platform}. You understand:

- Platform-specific best practices and algorithms
- Engagement-driving hooks and formats
- Hashtag strategies for discoverability
- Call-to-action optimization
- Visual content suggestions

${baseSuffix}

Create content that drives engagement, shares, and conversions while maintaining brand consistency.`;
}

export async function generateSocialPost(
  topic: ContentTopic,
  brief: ClientBrief | EnrichedClientBrief,
  platform: 'linkedin' | 'twitter' | 'instagram'
): Promise<AgentResponse<GeneratedContent>> {
  try {
    const config = PLATFORM_CONFIGS[platform];
    const isEnriched = 'textual' in brief && 'visual' in brief;
    const enrichedBrief = brief as EnrichedClientBrief;
    
    const brandContext = isEnriched 
      ? formatTextualBriefForPrompt(enrichedBrief)
      : `Brand Voice: ${brief.brandVoice}\nTarget Audience: ${brief.targetAudience}`;
    
    const systemPrompt = isEnriched 
      ? buildSocialSystemPrompt(enrichedBrief, platform)
      : `You are a social media content expert. Create content in the brand voice: ${brief.brandVoice}.`;
    
    const effectiveCta = isEnriched ? getEffectiveCTA(enrichedBrief) : undefined;
    const forbiddenWords = isEnriched ? enrichedBrief.textual.forbiddenWords : [];
    
    const userPrompt = `Create a ${platform.toUpperCase()} post for ${brief.clientName}.

**Topic:** ${topic.title}
**Angle:** ${topic.angle}
**Keywords:** ${topic.keywords.join(', ')}

${brandContext}

**Platform Requirements:**
- Max characters: ${config.maxChars}
- Style: ${config.style}
- Platform tone: ${config.tone}

Create a highly engaging post that:
1. Opens with a hook that stops scrolling and speaks to ${isEnriched ? enrichedBrief.textual.audienceDemographics : brief.targetAudience}
2. Delivers value or insight aligned with brand personality (${isEnriched ? enrichedBrief.textual.archetype : 'professional'})
3. Maintains ${isEnriched ? `${enrichedBrief.textual.toneDescription} tone` : 'brand voice'}
4. ${effectiveCta ? `Ends with CTA: "${effectiveCta}"` : 'Ends with engagement prompt or CTA'}
5. Includes appropriate hashtags
${forbiddenWords.length ? `6. NEVER use: ${forbiddenWords.join(', ')}` : ''}

Output ONLY the post content, ready to publish.`;

    const content = await generateWithClaude(systemPrompt, userPrompt, {
      maxTokens: 1024,
      temperature: 0.8,
    });

    const hashtagMatch = content.match(/#\w+/g);
    
    let imageDataUrl: string | undefined;
    
    const geminiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    if (geminiKey) {
      try {
        console.log(`[SocialAgent] Generating image with Nano Banana Pro for ${platform} post...`);
        
        const basePrompt = `Social media graphic for ${platform}: ${topic.title}`;
        const brandVoice = isEnriched 
          ? `${enrichedBrief.visual.aesthetic.join(', ')}, ${enrichedBrief.visual.moodKeywords.join(', ')}`
          : brief.brandVoice;
        
        const imageResult = await generateSocialMediaGraphic(
          isEnriched ? buildImagePromptEnrichment(enrichedBrief, basePrompt) : topic.title,
          platform,
          brandVoice
        );
        
        if (imageResult.success && imageResult.imageDataUrl) {
          imageDataUrl = imageResult.imageDataUrl;
          console.log(`[SocialAgent] Image generated for ${platform} post`);
        } else {
          console.log(`[SocialAgent] Image generation failed for ${platform}: ${imageResult.error}`);
        }
      } catch (imageError: any) {
        console.log(`[SocialAgent] Image generation error for ${platform}:`, imageError.message);
      }
    } else {
      console.log(`[SocialAgent] Skipping image generation - no Gemini API key configured`);
    }
    
    const generatedContent: GeneratedContent = {
      id: `${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topicId: topic.id,
      clientId: brief.clientId,
      type: platform as ContentType,
      title: topic.title,
      content: content.trim(),
      metadata: {
        characterCount: content.length,
        hashtags: hashtagMatch || [],
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
      error: error.message || `Failed to generate ${platform} post`,
    };
  }
}

export async function generateAllSocialPosts(
  topic: ContentTopic,
  brief: ClientBrief | EnrichedClientBrief,
  platforms: ('linkedin' | 'twitter' | 'instagram')[] = ['linkedin', 'twitter', 'instagram']
): Promise<AgentResponse<GeneratedContent[]>> {
  try {
    const results = await Promise.all(
      platforms.map(platform => generateSocialPost(topic, brief, platform))
    );

    const successfulPosts = results
      .filter(r => r.success && r.data)
      .map(r => r.data as GeneratedContent);

    return {
      success: successfulPosts.length > 0,
      data: successfulPosts,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to generate social posts",
    };
  }
}
