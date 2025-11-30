import { generateWithClaude } from "../integrations/anthropic";
import type { ClientBrief, ContentTopic, GeneratedContent, AgentResponse } from "../types";

const SYSTEM_PROMPT = `You are an expert long-form content writer for B2B and B2C brands. You create compelling, SEO-optimized blog posts that:

- Hook readers in the first paragraph
- Use clear structure with headers (H2, H3)
- Include actionable insights and data
- Maintain brand voice consistency
- End with strong calls-to-action
- Are optimized for featured snippets

Write in a professional yet engaging tone. Include relevant examples and statistics where appropriate.`;

export async function generateBlogPost(
  topic: ContentTopic,
  brief: ClientBrief,
  wordCount: number = 1500
): Promise<AgentResponse<GeneratedContent>> {
  try {
    const userPrompt = `Write a comprehensive blog post for ${brief.clientName}.

**Topic:** ${topic.title}
**Angle:** ${topic.angle}
**Target Keywords:** ${topic.keywords.join(', ')}
**Brand Voice:** ${brief.brandVoice}
**Target Audience:** ${brief.targetAudience}
**Target Word Count:** ${wordCount} words

Structure the post with:
1. Attention-grabbing headline
2. Hook introduction (2-3 sentences)
3. 4-6 main sections with H2 headers
4. Practical takeaways or action items
5. Strong conclusion with CTA

Format in Markdown. Make it scannable with bullet points where appropriate.`;

    const content = await generateWithClaude(SYSTEM_PROMPT, userPrompt, {
      maxTokens: 4096,
      temperature: 0.7,
    });

    const titleMatch = content.match(/^#\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1] : topic.title;

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
