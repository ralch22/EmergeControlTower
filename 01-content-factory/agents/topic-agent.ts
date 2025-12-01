import { generateWithClaude } from "../integrations/anthropic";
import type { ClientBrief, ContentTopic, ContentType, AgentResponse, EnrichedClientBrief } from "../types";
import { formatTextualBriefForPrompt, buildSystemPromptSuffix } from "../services/brand-brief";

function buildTopicSystemPrompt(brief: EnrichedClientBrief): string {
  const baseSuffix = buildSystemPromptSuffix(brief);
  
  return `You are an expert content strategist for digital agencies. Your role is to generate highly engaging, SEO-optimized content topics that will resonate with target audiences and drive business results.

You understand:
- Content marketing best practices
- SEO keyword research principles
- Social media engagement patterns
- B2B and B2C marketing strategies
- Industry-specific content angles

${baseSuffix}

Generate topics that:
- Address the audience's pain points: ${brief.textual.audiencePainPoints.slice(0, 3).join(', ') || 'key challenges'}
- Align with brand values and mission
- Support content goals: ${brief.textual.contentGoals.join(', ')}
- Use brand-appropriate messaging

Always output valid JSON arrays.`;
}

export async function generateTopics(
  brief: ClientBrief | EnrichedClientBrief,
  count: number = 5,
  contentTypes: ContentType[] = ['blog', 'linkedin', 'twitter', 'video_script']
): Promise<AgentResponse<ContentTopic[]>> {
  try {
    const isEnriched = 'textual' in brief && 'visual' in brief;
    const enrichedBrief = brief as EnrichedClientBrief;
    
    const brandContext = isEnriched 
      ? formatTextualBriefForPrompt(enrichedBrief)
      : `Brand Voice: ${brief.brandVoice}\nTarget Audience: ${brief.targetAudience}\nKeywords: ${brief.keywords.join(', ')}\nContent Goals: ${brief.contentGoals.join(', ')}`;
    
    const systemPrompt = isEnriched 
      ? buildTopicSystemPrompt(enrichedBrief)
      : `You are an expert content strategist. Generate topics for ${brief.clientName} that align with their brand voice and target audience. Always output valid JSON arrays.`;
    
    const painPoints = isEnriched ? enrichedBrief.textual.audiencePainPoints : [];
    const audienceGoals = isEnriched ? enrichedBrief.textual.audienceGoals : [];
    const forbiddenWords = isEnriched ? enrichedBrief.textual.forbiddenWords : [];
    const brandValues = isEnriched ? enrichedBrief.textual.brandValues : [];
    
    const userPrompt = `Generate ${count} high-impact content topics for the following client:

**Client:** ${brief.clientName}
**Industry:** ${brief.industry}

${brandContext}

${painPoints.length ? `**Audience Pain Points to Address:**\n${painPoints.map(p => `- ${p}`).join('\n')}` : ''}

${audienceGoals.length ? `**Audience Goals to Support:**\n${audienceGoals.map(g => `- ${g}`).join('\n')}` : ''}

${brandValues.length ? `**Brand Values to Reflect:**\n${brandValues.map(v => `- ${v.name}: ${v.description}`).join('\n')}` : ''}

${forbiddenWords.length ? `**Topics/Words to AVOID:** ${forbiddenWords.join(', ')}` : ''}

For each topic, provide:
1. A compelling title that speaks to the ${isEnriched ? enrichedBrief.textual.archetype : 'professional'} brand personality
2. A unique angle or hook addressing audience pain points/goals
3. Relevant keywords (3-5) including: ${brief.keywords.slice(0, 5).join(', ')}
4. Which content types it's suitable for from this list: ${contentTypes.join(', ')}
   - IMPORTANT: For at least 2-3 topics, include "video_script" if available
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

    const response = await generateWithClaude(systemPrompt, userPrompt, {
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
