import { generateWithClaude } from "../integrations/anthropic";
import { generateSocialMediaGraphic } from "../integrations/nano-banana-pro";
import type { ClientBrief, ContentTopic, GeneratedContent, ContentType, AgentResponse } from "../types";

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

const SYSTEM_PROMPT = `You are a social media content expert who creates scroll-stopping posts for various platforms. You understand:

- Platform-specific best practices and algorithms
- Engagement-driving hooks and formats
- Hashtag strategies for discoverability
- Call-to-action optimization
- Visual content suggestions

Create content that drives engagement, shares, and conversions.`;

export async function generateSocialPost(
  topic: ContentTopic,
  brief: ClientBrief,
  platform: 'linkedin' | 'twitter' | 'instagram'
): Promise<AgentResponse<GeneratedContent>> {
  try {
    const config = PLATFORM_CONFIGS[platform];
    
    const userPrompt = `Create a ${platform.toUpperCase()} post for ${brief.clientName}.

**Topic:** ${topic.title}
**Angle:** ${topic.angle}
**Keywords:** ${topic.keywords.join(', ')}
**Brand Voice:** ${brief.brandVoice}
**Target Audience:** ${brief.targetAudience}

**Platform Requirements:**
- Max characters: ${config.maxChars}
- Style: ${config.style}
- Tone: ${config.tone}

Create a highly engaging post that:
1. Opens with a hook that stops scrolling
2. Delivers value or insight
3. Ends with engagement prompt or CTA
4. Includes appropriate hashtags

Output ONLY the post content, ready to publish.`;

    const content = await generateWithClaude(SYSTEM_PROMPT, userPrompt, {
      maxTokens: 1024,
      temperature: 0.8,
    });

    const hashtagMatch = content.match(/#\w+/g);
    
    let imageDataUrl: string | undefined;
    
    const geminiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    if (geminiKey) {
      try {
        console.log(`[SocialAgent] Generating image with Nano Banana Pro for ${platform} post...`);
        const imageResult = await generateSocialMediaGraphic(
          topic.title,
          platform,
          brief.brandVoice
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
  brief: ClientBrief,
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
