import { generateWithClaude } from "../integrations/anthropic";
import type { GeneratedContent, QAResult, AgentResponse, EnrichedClientBrief, ClientBrief } from "../types";
import { buildQAValidationCriteria, formatTextualBriefForPrompt } from "../services/brand-brief";

function buildQASystemPrompt(brief?: EnrichedClientBrief): string {
  const brandCriteria = brief ? buildQAValidationCriteria(brief) : '';
  
  return `You are a senior content quality assurance specialist. You review content for:

**Quality Standards:**
- Grammar, spelling, and punctuation
- Brand voice consistency
- Factual accuracy and claims
- SEO optimization
- Engagement potential
- Platform compliance
- Legal/compliance issues

${brief ? `**Brand Compliance Criteria:**
${brandCriteria}` : ''}

**Scoring Criteria (0-100):**
- 90-100: Publish-ready, exceptional quality, fully brand-aligned
- 75-89: Good quality, minor improvements possible
- 60-74: Needs revision, some brand/quality issues
- Below 60: Major revision required, significant issues

Be thorough but constructive. Provide actionable feedback.
${brief?.textual.forbiddenWords.length ? `\nCRITICAL: Flag any use of forbidden words: ${brief.textual.forbiddenWords.join(', ')}` : ''}`;
}

export async function reviewContent(
  content: GeneratedContent,
  brief?: ClientBrief | EnrichedClientBrief
): Promise<AgentResponse<QAResult>> {
  try {
    const isEnriched = brief && 'textual' in brief && 'visual' in brief;
    const enrichedBrief = brief as EnrichedClientBrief | undefined;
    
    const systemPrompt = isEnriched 
      ? buildQASystemPrompt(enrichedBrief)
      : buildQASystemPrompt();
    
    const brandContext = isEnriched 
      ? formatTextualBriefForPrompt(enrichedBrief!)
      : '';
    
    const forbiddenWords = isEnriched ? enrichedBrief!.textual.forbiddenWords : [];
    const preferredCtas = isEnriched ? enrichedBrief!.textual.callToActions : [];
    const brandKeywords = isEnriched ? enrichedBrief!.textual.keywords : [];
    
    const userPrompt = `Review the following ${content.type} content:

**Title:** ${content.title}

**Content:**
${content.content}

**Metadata:**
${JSON.stringify(content.metadata, null, 2)}

${brandContext ? `\n**Brand Guidelines to Check Against:**\n${brandContext}` : ''}

Analyze the content and provide:
1. Overall quality score (0-100)
2. Pass/Fail determination (pass = score >= 75)
3. List of issues found (if any)
4. Specific improvement suggestions

**Specific Checks to Perform:**
${forbiddenWords.length ? `- Forbidden Words Check: Scan for any of these words: ${forbiddenWords.join(', ')}` : '- Basic grammar and spelling check'}
${preferredCtas.length ? `- CTA Alignment: Does it use or align with preferred CTAs: ${preferredCtas.join(' | ')}?` : '- CTA effectiveness check'}
${brandKeywords.length ? `- Keyword Usage: Are these naturally included: ${brandKeywords.slice(0, 5).join(', ')}?` : '- Keyword relevance check'}
${isEnriched ? `- Voice Match: Does it match ${enrichedBrief!.textual.archetype} archetype with ${enrichedBrief!.textual.personalityTraits.slice(0, 3).join(', ')} traits?` : '- Brand voice consistency check'}
${isEnriched ? `- Tone Match: Is the tone ${enrichedBrief!.textual.toneDescription}?` : '- Tone appropriateness check'}
${isEnriched ? `- Audience Fit: Will it resonate with ${enrichedBrief!.textual.audienceDemographics}?` : '- Audience relevance check'}

Output as JSON:
{
  "passed": true/false,
  "score": 0-100,
  "issues": ["Issue 1", "Issue 2"],
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "brandComplianceNotes": {
    "forbiddenWordsFound": [],
    "ctaAligned": true/false,
    "keywordsUsed": [],
    "voiceMatch": "strong/moderate/weak",
    "toneMatch": "strong/moderate/weak"
  }
}`;

    const response = await generateWithClaude(systemPrompt, userPrompt, {
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
  contents: GeneratedContent[],
  brief?: ClientBrief | EnrichedClientBrief
): Promise<AgentResponse<Map<string, QAResult>>> {
  try {
    const results = await Promise.all(
      contents.map(async (content) => {
        const result = await reviewContent(content, brief);
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
