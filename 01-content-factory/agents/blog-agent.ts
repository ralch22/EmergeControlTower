import { generateWithClaude } from "../integrations/anthropic";
import { generateImageWithNanoBananaPro } from "../integrations/nano-banana-pro";
import type { ClientBrief, ContentTopic, GeneratedContent, AgentResponse, EnrichedClientBrief } from "../types";
import { 
  formatTextualBriefForPrompt, 
  buildSystemPromptSuffix,
  buildReferenceConstrainedImagePrompt,
  getEffectiveCTA,
  hasReferenceAsset
} from "../services/brand-brief";

function buildBlogSystemPrompt(brief: EnrichedClientBrief): string {
  const baseSuffix = buildSystemPromptSuffix(brief);
  
  return `You are an expert long-form content writer for B2B and B2C brands. You create compelling, SEO-optimized blog posts that:

- Hook readers in the first paragraph
- Use clear structure with headers (H2, H3)
- Include actionable insights and data
- Maintain brand voice consistency
- End with strong calls-to-action
- Are optimized for featured snippets

${baseSuffix}

Write in a professional yet engaging tone that matches the brand personality. Include relevant examples and statistics where appropriate.`;
}

export async function generateBlogPost(
  topic: ContentTopic,
  brief: ClientBrief | EnrichedClientBrief,
  wordCount: number = 1500
): Promise<AgentResponse<GeneratedContent>> {
  try {
    const isEnriched = 'textual' in brief && 'visual' in brief;
    const enrichedBrief = brief as EnrichedClientBrief;
    
    const brandContext = isEnriched 
      ? formatTextualBriefForPrompt(enrichedBrief)
      : `Brand Voice: ${brief.brandVoice}\nTarget Audience: ${brief.targetAudience}${brief.websiteUrl ? `\nWebsite Reference: ${brief.websiteUrl} (maintain brand consistency with website)` : ''}`;
    
    const systemPrompt = isEnriched 
      ? buildBlogSystemPrompt(enrichedBrief)
      : `You are an expert content writer. Write in the brand voice: ${brief.brandVoice}. Target audience: ${brief.targetAudience}.${brief.websiteUrl ? ` Use ${brief.websiteUrl} as a reference for brand style and tone.` : ''}`;
    
    const effectiveCta = isEnriched ? getEffectiveCTA(enrichedBrief) : undefined;
    const forbiddenWords = isEnriched ? enrichedBrief.textual.forbiddenWords : [];
    
    const userPrompt = `Write a comprehensive blog post for ${brief.clientName}.

**Topic:** ${topic.title}
**Angle:** ${topic.angle}
**Target Keywords:** ${topic.keywords.join(', ')}
**Target Word Count:** ${wordCount} words

${brandContext}

REQUIREMENTS:
1. Attention-grabbing headline that speaks to audience pain points
2. Hook introduction (2-3 sentences) that resonates with ${isEnriched ? enrichedBrief.textual.audienceDemographics : brief.targetAudience}
3. 4-6 main sections with H2 headers
4. Practical takeaways aligned with brand values
5. Strong conclusion with CTA${effectiveCta ? `: "${effectiveCta}"` : ''}
${forbiddenWords.length ? `6. NEVER use these words: ${forbiddenWords.join(', ')}` : ''}

Format in Markdown. Make it scannable with bullet points where appropriate.
Maintain the ${isEnriched ? enrichedBrief.textual.archetype : 'professional'} brand personality throughout.`;

    const content = await generateWithClaude(systemPrompt, userPrompt, {
      maxTokens: 4096,
      temperature: 0.7,
    });

    const titleMatch = content.match(/^#\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1] : topic.title;

    let imageDataUrl: string | undefined;
    
    const geminiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    if (geminiKey) {
      try {
        console.log(`[BlogAgent] Generating hero image with Nano Banana Pro...`);
        
        const basePrompt = `Professional blog header image for article: "${title}". Industry: ${brief.industry || 'business'}.`;
        
        let imagePrompt: string;
        if (isEnriched && hasReferenceAsset(enrichedBrief)) {
          const { prompt } = buildReferenceConstrainedImagePrompt(enrichedBrief, basePrompt, {
            strictMode: true,
            imageType: 'blog',
          });
          imagePrompt = prompt;
          console.log(`[BlogAgent] Using reference-constrained prompt with brand logo`);
        } else if (isEnriched) {
          const { prompt } = buildReferenceConstrainedImagePrompt(enrichedBrief, basePrompt, {
            strictMode: false,
            imageType: 'blog',
          });
          imagePrompt = prompt;
        } else {
          imagePrompt = `${basePrompt} Clean, modern, editorial style.`;
        }
        
        const imageResult = await generateImageWithNanoBananaPro(imagePrompt, {
          resolution: '2K',
          style: isEnriched 
            ? `${enrichedBrief.visual.aesthetic.join(', ')}, professional, editorial photography`
            : 'editorial photography, professional, clean composition, modern design',
        });
        
        if (imageResult.success && imageResult.imageDataUrl) {
          imageDataUrl = imageResult.imageDataUrl;
          console.log(`[BlogAgent] Hero image generated successfully`);
        } else {
          console.log(`[BlogAgent] Image generation failed: ${imageResult.error}`);
        }
      } catch (imageError: any) {
        console.log(`[BlogAgent] Image generation error:`, imageError.message);
      }
    } else {
      console.log(`[BlogAgent] Skipping image generation - no Gemini API key configured`);
    }

    const generatedContent: GeneratedContent = {
      id: `blog_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      topicId: topic.id,
      clientId: brief.clientId,
      type: 'blog',
      title,
      content,
      metadata: {
        wordCount: content.split(/\s+/).length,
        characterCount: content.length,
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
      error: error.message || "Failed to generate blog post",
    };
  }
}
