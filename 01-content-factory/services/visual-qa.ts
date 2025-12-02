import { generateWithClaude, generateWithClaudeVision } from "../integrations/anthropic";
import type { BrandProfileJSON } from "../../shared/schema";
import type { EnrichedClientBrief } from "./brand-brief";
import type { AgentResponse } from "../types";

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[VisualQA] Failed to fetch image from URL: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.includes("png") ? "image/png" 
      : contentType.includes("gif") ? "image/gif"
      : contentType.includes("webp") ? "image/webp"
      : "image/jpeg";
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    
    return { base64, mimeType };
  } catch (error: any) {
    console.error(`[VisualQA] Error fetching image:`, error.message);
    return null;
  }
}

function normalizeBase64(input: string): { base64: string; mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" } {
  const dataUriMatch = input.match(/^data:image\/(jpeg|png|gif|webp);base64,(.+)$/i);
  if (dataUriMatch) {
    const typeMap: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    };
    return {
      base64: dataUriMatch[2],
      mimeType: typeMap[dataUriMatch[1].toLowerCase()] || "image/jpeg",
    };
  }
  
  const mimeType = input.startsWith("/9j/") ? "image/jpeg" : "image/png";
  return { base64: input, mimeType };
}

export interface VisualQAResult {
  passed: boolean;
  overallScore: number;
  colorCompliance: {
    score: number;
    brandColorsDetected: string[];
    offBrandColorsDetected: string[];
    issues: string[];
  };
  styleCompliance: {
    score: number;
    aestheticMatch: "strong" | "moderate" | "weak" | "none";
    moodMatch: "strong" | "moderate" | "weak" | "none";
    motifsPresent: string[];
    issues: string[];
  };
  cinematicCompliance?: {
    score: number;
    pacingMatch: boolean;
    colorGradingMatch: boolean;
    motionStyleMatch: boolean;
    issues: string[];
  };
  accessibilityNotes: string[];
  suggestions: string[];
  detailedFeedback: string;
}

export interface VisualQARequest {
  assetType: "image" | "video" | "thumbnail";
  assetUrl?: string;
  assetBase64?: string;
  sceneDescription?: string;
  brandProfile: BrandProfileJSON;
  enrichedBrief?: EnrichedClientBrief;
  requireVisualContent?: boolean;
}

function buildBrandColorContext(brandProfile: BrandProfileJSON): string {
  const visual = brandProfile.visual;
  if (!visual?.colorPalette) return "No color palette defined.";

  const colorPalette = visual.colorPalette.darkMode || visual.colorPalette.lightMode;
  if (!colorPalette) return "No color palette defined.";

  const colors: string[] = [];
  if (colorPalette.background?.hex) {
    colors.push(`Background: ${colorPalette.background.name || 'Primary BG'} (${colorPalette.background.hex})`);
  }
  if (colorPalette.accent?.hex) {
    colors.push(`Accent: ${colorPalette.accent.name || 'Brand Accent'} (${colorPalette.accent.hex})`);
  }
  if (colorPalette.textPrimary?.hex) {
    colors.push(`Text: ${colorPalette.textPrimary.name || 'Primary Text'} (${colorPalette.textPrimary.hex})`);
  }
  if (colorPalette.success?.hex) {
    colors.push(`Success: ${colorPalette.success.name || 'Success'} (${colorPalette.success.hex})`);
  }
  if (colorPalette.warning?.hex) {
    colors.push(`Warning: ${colorPalette.warning.name || 'Warning'} (${colorPalette.warning.hex})`);
  }
  if (colorPalette.error?.hex) {
    colors.push(`Error: ${colorPalette.error.name || 'Error'} (${colorPalette.error.hex})`);
  }

  const additionalColors = visual.colorPalette.additionalColors || [];
  for (const color of additionalColors.slice(0, 5)) {
    colors.push(`${color.name}: ${color.hex}`);
  }

  return colors.length > 0 
    ? `Brand Colors:\n${colors.join('\n')}`
    : "No specific colors defined.";
}

function buildVisualStyleContext(brandProfile: BrandProfileJSON): string {
  const visual = brandProfile.visual;
  if (!visual?.visualStyle) return "No visual style defined.";

  const style = visual.visualStyle;
  const parts: string[] = [];

  if (style.description) {
    parts.push(`Style Description: ${style.description}`);
  }
  if (style.aesthetic?.length) {
    parts.push(`Aesthetic Keywords: ${style.aesthetic.join(', ')}`);
  }
  if (style.moodKeywords?.length) {
    parts.push(`Mood Keywords: ${style.moodKeywords.join(', ')}`);
  }
  if (style.motifs?.length) {
    parts.push(`Expected Motifs: ${style.motifs.join(', ')}`);
  }
  if (style.patterns?.length) {
    parts.push(`Expected Patterns: ${style.patterns.join(', ')}`);
  }

  return parts.length > 0 
    ? parts.join('\n')
    : "No visual style guidelines specified.";
}

function buildCinematicContext(brandProfile: BrandProfileJSON): string {
  const cine = brandProfile.visual?.cinematicGuidelines;
  if (!cine) return "";

  const parts: string[] = [];
  if (cine.pacing) parts.push(`Pacing: ${cine.pacing}`);
  if (cine.motionStyle) parts.push(`Motion Style: ${cine.motionStyle}`);
  if (cine.colorGrading) parts.push(`Color Grading: ${cine.colorGrading}`);
  if (cine.transitionStyle) parts.push(`Transitions: ${cine.transitionStyle}`);
  if (cine.soundtrackStyle) parts.push(`Soundtrack: ${cine.soundtrackStyle}`);

  return parts.length > 0 
    ? `Cinematic Guidelines:\n${parts.join('\n')}`
    : "";
}

function buildUsageRulesContext(brandProfile: BrandProfileJSON): string {
  const rules = brandProfile.visual?.usageRules;
  if (!rules) return "";

  const parts: string[] = [];
  if (rules.dos?.length) {
    parts.push(`DO: ${rules.dos.slice(0, 5).join('; ')}`);
  }
  if (rules.donts?.length) {
    parts.push(`DON'T: ${rules.donts.slice(0, 5).join('; ')}`);
  }

  return parts.length > 0 ? parts.join('\n') : "";
}

function buildVisualQASystemPrompt(assetType: string, brandProfile: BrandProfileJSON): string {
  const colorContext = buildBrandColorContext(brandProfile);
  const styleContext = buildVisualStyleContext(brandProfile);
  const cinematicContext = assetType === "video" ? buildCinematicContext(brandProfile) : "";
  const usageRules = buildUsageRulesContext(brandProfile);

  return `You are an expert visual brand compliance analyst. Your job is to analyze ${assetType}s against brand guidelines and provide detailed quality assessments.

**Brand Visual Guidelines:**

${colorContext}

${styleContext}

${cinematicContext ? `\n${cinematicContext}` : ""}

${usageRules ? `\n**Usage Rules:**\n${usageRules}` : ""}

**Scoring Criteria (0-100):**
- 90-100: Excellent brand compliance, ready for publication
- 75-89: Good compliance, minor adjustments recommended
- 60-74: Moderate compliance, needs revision
- Below 60: Poor compliance, requires significant rework

Analyze the visual content thoroughly for:
1. Color palette adherence (are brand colors prominently used?)
2. Visual style match (does it reflect the brand aesthetic and mood?)
3. Motif and pattern usage (are brand motifs/patterns present?)
${assetType === "video" ? "4. Cinematic guidelines (pacing, motion style, color grading)" : ""}
5. Overall brand consistency

Be specific and constructive in your feedback.`;
}

export async function validateVisualAsset(
  request: VisualQARequest
): Promise<AgentResponse<VisualQAResult>> {
  try {
    const { assetType, assetUrl, assetBase64, sceneDescription, brandProfile, requireVisualContent = false } = request;

    if (!assetUrl && !assetBase64 && !sceneDescription) {
      throw new Error("Must provide assetUrl, assetBase64, or sceneDescription for visual QA");
    }

    const systemPrompt = buildVisualQASystemPrompt(assetType, brandProfile);

    let imageData: { base64: string; mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" } | null = null;

    if (assetBase64) {
      imageData = normalizeBase64(assetBase64);
      console.log("[VisualQA] Using provided base64 image data");
    } else if (assetUrl && assetUrl.startsWith("http")) {
      console.log("[VisualQA] Fetching image from URL:", assetUrl);
      imageData = await fetchImageAsBase64(assetUrl);
      if (!imageData) {
        console.warn("[VisualQA] Failed to fetch image from URL, falling back to text analysis");
      }
    }

    const hasVisualContent = !!imageData;

    if (requireVisualContent && !hasVisualContent) {
      return {
        success: false,
        error: "Visual content required but not available. Provide base64 image or valid URL.",
      };
    }

    let contentDescription = "";
    if (sceneDescription) {
      contentDescription = `Scene/Visual Description: ${sceneDescription}`;
    }
    if (assetUrl) {
      contentDescription += `\n\nAsset URL for reference: ${assetUrl}`;
    }

    const userPromptForVision = `Analyze the provided ${assetType} image for brand compliance.

${contentDescription ? `Additional context:\n${contentDescription}\n` : ""}

Carefully examine the actual visual content in the image. Identify:
1. The dominant colors used - compare to the brand color palette
2. The visual style, mood, and aesthetic - does it match brand guidelines?
3. Any visual motifs, patterns, or elements present
4. Overall composition and quality

Provide a comprehensive brand compliance analysis. Output your analysis as JSON:

{
  "passed": true/false (true if overallScore >= 75),
  "overallScore": 0-100,
  "colorCompliance": {
    "score": 0-100,
    "brandColorsDetected": ["#hex1", "#hex2"],
    "offBrandColorsDetected": ["#hex1"],
    "issues": ["Issue description"]
  },
  "styleCompliance": {
    "score": 0-100,
    "aestheticMatch": "strong" | "moderate" | "weak" | "none",
    "moodMatch": "strong" | "moderate" | "weak" | "none",
    "motifsPresent": ["motif1", "motif2"],
    "issues": ["Issue description"]
  },
  ${assetType === "video" ? `"cinematicCompliance": {
    "score": 0-100,
    "pacingMatch": true/false,
    "colorGradingMatch": true/false,
    "motionStyleMatch": true/false,
    "issues": ["Issue description"]
  },` : ""}
  "accessibilityNotes": ["Note about contrast", "Note about readability"],
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "detailedFeedback": "Comprehensive paragraph of feedback"
}`;

    const userPromptForText = `Analyze the following ${assetType} visual prompt/description for brand compliance:

${contentDescription}

Based on the visual prompt and scene description above, evaluate whether the resulting ${assetType} would adhere to the brand guidelines.

WARNING: This is a LIMITED pre-generation analysis based on the prompt/description only. Actual visual content is NOT available. Results should be treated as preliminary estimates only.

Provide a comprehensive brand compliance analysis. Output your analysis as JSON:

{
  "passed": true/false (true if overallScore >= 75),
  "overallScore": 0-100,
  "colorCompliance": {
    "score": 0-100,
    "brandColorsDetected": ["#hex1", "#hex2"],
    "offBrandColorsDetected": ["#hex1"],
    "issues": ["Issue description"]
  },
  "styleCompliance": {
    "score": 0-100,
    "aestheticMatch": "strong" | "moderate" | "weak" | "none",
    "moodMatch": "strong" | "moderate" | "weak" | "none",
    "motifsPresent": ["motif1", "motif2"],
    "issues": ["Issue description"]
  },
  ${assetType === "video" ? `"cinematicCompliance": {
    "score": 0-100,
    "pacingMatch": true/false,
    "colorGradingMatch": true/false,
    "motionStyleMatch": true/false,
    "issues": ["Issue description"]
  },` : ""}
  "accessibilityNotes": ["Note about contrast", "Note about readability"],
  "suggestions": ["Suggestion 1", "Suggestion 2"],
  "detailedFeedback": "Comprehensive paragraph of feedback"
}`;

    let response: string;
    let analysisMode: "vision" | "text" = "text";

    if (hasVisualContent && imageData) {
      console.log("[VisualQA] Analyzing actual image content with vision model");
      analysisMode = "vision";
      response = await generateWithClaudeVision(
        systemPrompt,
        userPromptForVision,
        [{ base64: imageData.base64, mediaType: imageData.mimeType }],
        {
          maxTokens: 2000,
          temperature: 0.3,
        }
      );
    } else {
      console.log("[VisualQA] Analyzing prompt/description only (no image provided)");
      response = await generateWithClaude(
        systemPrompt, 
        userPromptForText, 
        {
          maxTokens: 2000,
          temperature: 0.3,
        }
      );
    }

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Failed to parse visual QA result JSON");
    }

    const qaResult: VisualQAResult = JSON.parse(jsonMatch[0]);
    qaResult.passed = qaResult.overallScore >= 75;

    if (analysisMode === "text") {
      qaResult.detailedFeedback = `[LIMITED ANALYSIS - No visual content available] ${qaResult.detailedFeedback}`;
    }

    return {
      success: true,
      data: qaResult,
    };
  } catch (error: any) {
    console.error("[VisualQA] Validation failed:", error.message);
    return {
      success: false,
      error: error.message || "Failed to validate visual asset",
    };
  }
}

export async function validateVideoProject(
  projectScenes: Array<{
    sceneNumber: number;
    visualPrompt?: string;
    thumbnailUrl?: string;
    thumbnailBase64?: string;
  }>,
  brandProfile: BrandProfileJSON,
  options: { requireVisualContent?: boolean } = {}
): Promise<AgentResponse<{
  overallPassed: boolean;
  overallScore: number;
  sceneResults: Map<number, VisualQAResult>;
  aggregateFeedback: string;
  scenesWithoutVisualContent: number[];
}>> {
  try {
    const { requireVisualContent = true } = options;
    const sceneResults = new Map<number, VisualQAResult>();
    let totalScore = 0;
    let scenesValidated = 0;
    const scenesWithoutVisualContent: number[] = [];
    const failedValidations: string[] = [];

    for (const scene of projectScenes) {
      const hasVisualContent = !!(scene.thumbnailBase64 || scene.thumbnailUrl);
      
      if (!hasVisualContent && requireVisualContent) {
        scenesWithoutVisualContent.push(scene.sceneNumber);
        failedValidations.push(`Scene ${scene.sceneNumber}: No visual content available for validation`);
        continue;
      }

      const result = await validateVisualAsset({
        assetType: "video",
        sceneDescription: scene.visualPrompt,
        assetBase64: scene.thumbnailBase64,
        assetUrl: scene.thumbnailUrl,
        brandProfile,
        requireVisualContent,
      });

      if (!result.success) {
        failedValidations.push(`Scene ${scene.sceneNumber}: ${result.error}`);
        continue;
      }

      if (result.data) {
        sceneResults.set(scene.sceneNumber, result.data);
        totalScore += result.data.overallScore;
        scenesValidated++;
      }
    }

    if (requireVisualContent && scenesWithoutVisualContent.length > 0) {
      return {
        success: false,
        error: `Visual content required but missing for ${scenesWithoutVisualContent.length} scene(s): ${scenesWithoutVisualContent.join(", ")}`,
      };
    }

    const overallScore = scenesValidated > 0 
      ? Math.round(totalScore / scenesValidated) 
      : 0;
    
    const overallPassed = overallScore >= 75 && failedValidations.length === 0;

    const failedScenes = Array.from(sceneResults.entries())
      .filter(([_, result]) => !result.passed)
      .map(([num, result]) => `Scene ${num}: ${result.detailedFeedback?.substring(0, 100)}...`);

    let aggregateFeedback = "";
    if (failedValidations.length > 0) {
      aggregateFeedback += `Validation failures:\n${failedValidations.join('\n')}\n\n`;
    }
    if (failedScenes.length > 0) {
      aggregateFeedback += `${failedScenes.length} scene(s) need attention:\n${failedScenes.join('\n')}`;
    } else if (failedValidations.length === 0) {
      aggregateFeedback = "All scenes pass brand compliance checks.";
    }

    return {
      success: true,
      data: {
        overallPassed,
        overallScore,
        sceneResults,
        aggregateFeedback,
        scenesWithoutVisualContent,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to validate video project",
    };
  }
}

export async function validateImageBatch(
  images: Array<{
    id: string;
    url?: string;
    base64?: string;
    description?: string;
  }>,
  brandProfile: BrandProfileJSON,
  options: { requireVisualContent?: boolean } = {}
): Promise<AgentResponse<{
  overallPassed: boolean;
  passRate: number;
  results: Map<string, VisualQAResult>;
  summary: string;
  imagesWithoutVisualContent: string[];
}>> {
  try {
    const { requireVisualContent = true } = options;
    const results = new Map<string, VisualQAResult>();
    let passedCount = 0;
    const imagesWithoutVisualContent: string[] = [];
    const failedValidations: string[] = [];

    for (const image of images) {
      const hasVisualContent = !!(image.base64 || image.url);
      
      if (!hasVisualContent && requireVisualContent) {
        imagesWithoutVisualContent.push(image.id);
        failedValidations.push(`Image ${image.id}: No visual content available for validation`);
        continue;
      }

      const result = await validateVisualAsset({
        assetType: "image",
        assetUrl: image.url,
        assetBase64: image.base64,
        sceneDescription: image.description,
        brandProfile,
        requireVisualContent,
      });

      if (!result.success) {
        failedValidations.push(`Image ${image.id}: ${result.error}`);
        continue;
      }

      if (result.data) {
        results.set(image.id, result.data);
        if (result.data.passed) passedCount++;
      }
    }

    if (requireVisualContent && imagesWithoutVisualContent.length > 0) {
      return {
        success: false,
        error: `Visual content required but missing for ${imagesWithoutVisualContent.length} image(s): ${imagesWithoutVisualContent.join(", ")}`,
      };
    }

    const validatedCount = results.size;
    const passRate = validatedCount > 0 
      ? Math.round((passedCount / validatedCount) * 100) 
      : 0;
    
    const overallPassed = passRate >= 80 && failedValidations.length === 0;

    let summary = `${passedCount}/${validatedCount} images passed brand compliance (${passRate}% pass rate).`;
    if (failedValidations.length > 0) {
      summary += `\nValidation failures: ${failedValidations.length}`;
    }

    return {
      success: true,
      data: {
        overallPassed,
        passRate,
        results,
        summary,
        imagesWithoutVisualContent,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to validate image batch",
    };
  }
}

export function buildVisualQAGateCriteria(brandProfile: BrandProfileJSON): {
  minimumScore: number;
  requiredColorPresence: string[];
  requiredAestheticMatch: "strong" | "moderate";
  cinematicRequirements?: {
    pacingMustMatch: boolean;
    colorGradingMustMatch: boolean;
  };
} {
  const visual = brandProfile.visual;
  const colorPalette = visual?.colorPalette?.darkMode || visual?.colorPalette?.lightMode;
  
  const requiredColors: string[] = [];
  if (colorPalette?.accent?.hex) requiredColors.push(colorPalette.accent.hex);
  if (colorPalette?.background?.hex) requiredColors.push(colorPalette.background.hex);

  const hasCinematic = !!visual?.cinematicGuidelines;

  return {
    minimumScore: 75,
    requiredColorPresence: requiredColors,
    requiredAestheticMatch: "moderate",
    cinematicRequirements: hasCinematic ? {
      pacingMustMatch: true,
      colorGradingMustMatch: !!visual.cinematicGuidelines?.colorGrading,
    } : undefined,
  };
}

export async function runVisualQAGate(
  assetType: "image" | "video",
  asset: {
    url?: string;
    base64?: string;
    description?: string;
  },
  brandProfile: BrandProfileJSON,
  options: { requireVisualContent?: boolean; allowTextOnlyFallback?: boolean } = {}
): Promise<{
  passed: boolean;
  result: VisualQAResult | null;
  gateFailureReasons: string[];
  analysisType: "vision" | "text" | "failed";
}> {
  const { requireVisualContent = true, allowTextOnlyFallback = false } = options;
  const criteria = buildVisualQAGateCriteria(brandProfile);
  const gateFailureReasons: string[] = [];

  const hasVisualContent = !!(asset.base64 || asset.url);
  
  if (!hasVisualContent && requireVisualContent && !allowTextOnlyFallback) {
    return {
      passed: false,
      result: null,
      gateFailureReasons: ["No visual content provided - cannot validate brand compliance without actual imagery"],
      analysisType: "failed",
    };
  }

  const validationResult = await validateVisualAsset({
    assetType,
    assetUrl: asset.url,
    assetBase64: asset.base64,
    sceneDescription: asset.description,
    brandProfile,
    requireVisualContent: requireVisualContent && !allowTextOnlyFallback,
  });

  if (!validationResult.success || !validationResult.data) {
    return {
      passed: false,
      result: null,
      gateFailureReasons: [validationResult.error || "Visual QA validation failed to complete"],
      analysisType: "failed",
    };
  }

  const result = validationResult.data;
  const analysisType = result.detailedFeedback.startsWith("[LIMITED ANALYSIS") ? "text" : "vision";

  if (analysisType === "text" && !allowTextOnlyFallback) {
    gateFailureReasons.push("Gate requires vision analysis but only text-based analysis was possible");
  }

  if (result.overallScore < criteria.minimumScore) {
    gateFailureReasons.push(`Overall score ${result.overallScore} below minimum ${criteria.minimumScore}`);
  }

  if (result.styleCompliance.aestheticMatch === "weak" || result.styleCompliance.aestheticMatch === "none") {
    if (criteria.requiredAestheticMatch === "moderate") {
      gateFailureReasons.push(`Aesthetic match is ${result.styleCompliance.aestheticMatch}, requires at least moderate`);
    }
  }

  if (assetType === "video" && result.cinematicCompliance && criteria.cinematicRequirements) {
    if (criteria.cinematicRequirements.pacingMustMatch && !result.cinematicCompliance.pacingMatch) {
      gateFailureReasons.push("Video pacing does not match brand guidelines");
    }
    if (criteria.cinematicRequirements.colorGradingMustMatch && !result.cinematicCompliance.colorGradingMatch) {
      gateFailureReasons.push("Video color grading does not match brand guidelines");
    }
  }

  return {
    passed: gateFailureReasons.length === 0,
    result,
    gateFailureReasons,
    analysisType,
  };
}
