import { generateWithClaude } from "../integrations/anthropic";
import type { ClientBrief, ContentTopic, ContentType, AgentResponse } from "../types";

const SYSTEM_PROMPT = `You are an expert content strategist for digital agencies. Your role is to generate highly engaging, SEO-optimized content topics that will resonate with target audiences and drive business results.

You understand:
- Content marketing best practices
- SEO keyword research principles
- Social media engagement patterns
- B2B and B2C marketing strategies
- Industry-specific content angles

Always output valid JSON arrays.`;

export async function generateTopics(
  brief: ClientBrief,
  count: number = 5,
  contentTypes: ContentType[] = ['blog', 'linkedin', 'twitter', 'video_script']
): Promise<AgentResponse<ContentTopic[]>> {
  try {
    const userPrompt = `Generate ${count} high-impact content topics for the following client:

**Client:** ${brief.clientName}
**Industry:** ${brief.industry}
**Brand Voice:** ${brief.brandVoice}
**Target Audience:** ${brief.targetAudience}
**Keywords to incorporate:** ${brief.keywords.join(', ')}
**Content Goals:** ${brief.contentGoals.join(', ')}

For each topic, provide:
1. A compelling title
2. A unique angle or hook
3. Relevant keywords (3-5)
4. Which content types it's suitable for from this list: ${contentTypes.join(', ')}
   - IMPORTANT: For at least 2-3 topics, include "video_script" in contentTypes if it's in the allowed list
   - Video scripts work best for topics with strong visual potential or emotional narratives
5. Priority level (high/medium/low)

Return ONLY a valid JSON array with this structure:
[
  {
    "id": "topic_1",
    "title": "...",
    "angle": "...",
    "keywords": ["...", "..."],
    "contentTypes": ["blog", "linkedin", "video_script"],
    "priority": "high"
  }
]`;

    const response = await generateWithClaude(SYSTEM_PROMPT, userPrompt, {
      maxTokens: 2048,
      temperature: 0.8,
    });

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Failed to parse topics JSON from response");
    }

    const topics: ContentTopic[] = JSON.parse(jsonMatch[0]);
    
    return {
      success: true,
      data: topics,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to generate topics",
    };
  }
}
