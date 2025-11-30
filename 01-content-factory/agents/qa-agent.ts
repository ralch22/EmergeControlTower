import { generateWithClaude } from "../integrations/anthropic";
import type { GeneratedContent, QAResult, AgentResponse } from "../types";

const SYSTEM_PROMPT = `You are a senior content quality assurance specialist. You review content for:

**Quality Standards:**
- Grammar, spelling, and punctuation
- Brand voice consistency
- Factual accuracy and claims
- SEO optimization
- Engagement potential
- Platform compliance
- Legal/compliance issues

**Scoring Criteria (0-100):**
- 90-100: Publish-ready, exceptional quality
- 75-89: Good quality, minor improvements possible
- 60-74: Needs revision, some issues
- Below 60: Major revision required

Be thorough but constructive. Provide actionable feedback.`;

export async function reviewContent(
  content: GeneratedContent
): Promise<AgentResponse<QAResult>> {
  try {
    const userPrompt = `Review the following ${content.type} content:

**Title:** ${content.title}

**Content:**
${content.content}

**Metadata:**
${JSON.stringify(content.metadata, null, 2)}

Analyze the content and provide:
1. Overall quality score (0-100)
2. Pass/Fail determination (pass = score >= 75)
3. List of issues found (if any)
4. Specific improvement suggestions

Output as JSON:
{
  "passed": true/false,
  "score": 0-100,
  "issues": ["Issue 1", "Issue 2"],
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}`;

    const response = await generateWithClaude(SYSTEM_PROMPT, userPrompt, {
      maxTokens: 1500,
      temperature: 0.3,
    });

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse QA result JSON");
    }

    const qaResult: QAResult = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      data: qaResult,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to review content",
    };
  }
}

export async function batchReviewContent(
  contents: GeneratedContent[]
): Promise<AgentResponse<Map<string, QAResult>>> {
  try {
    const results = await Promise.all(
      contents.map(async (content) => {
        const result = await reviewContent(content);
        return { contentId: content.id, result };
      })
    );

    const resultMap = new Map<string, QAResult>();
    
    for (const { contentId, result } of results) {
      if (result.success && result.data) {
        resultMap.set(contentId, result.data);
      }
    }

    return {
      success: resultMap.size > 0,
      data: resultMap,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to batch review content",
    };
  }
}

export function calculateOverallScore(results: QAResult[]): {
  averageScore: number;
  passRate: number;
  totalPassed: number;
  totalFailed: number;
} {
  const totalPassed = results.filter(r => r.passed).length;
  const totalFailed = results.length - totalPassed;
  const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const passRate = (totalPassed / results.length) * 100;

  return {
    averageScore: Math.round(averageScore * 10) / 10,
    passRate: Math.round(passRate * 10) / 10,
    totalPassed,
    totalFailed,
  };
}
