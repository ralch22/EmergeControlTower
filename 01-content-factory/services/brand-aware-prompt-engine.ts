/**
 * Brand-Aware Prompt Engine
 * 
 * Injects brand references, color palettes, style guidelines, and learned patterns
 * into all content generation prompts. Ensures brand consistency across all content types.
 */

import type { EnrichedClientBrief, VisualBrandBrief, TextualBrandBrief } from './brand-brief';

export interface PromptContext {
  contentType: 'video' | 'blog' | 'social' | 'ad_copy' | 'image';
  format?: string;
  targetPlatform?: string;
  topic?: string;
  additionalInstructions?: string;
}

export interface BrandInjection {
  brandContext: string;
  visualGuidelines: string;
  toneGuidelines: string;
  colorPalette: string;
  forbiddenElements: string;
  referenceAnchors: string[];
}

export interface EnhancedPrompt {
  originalPrompt: string;
  brandEnhancedPrompt: string;
  brandInjection: BrandInjection;
  metadata: {
    clientId: string;
    brandArchetype: string;
    injectedElements: string[];
  };
}

/**
 * Content-type specific brand injection strategies
 */
const CONTENT_TYPE_STRATEGIES: Record<string, {
  visualWeight: number;
  toneWeight: number;
  colorWeight: number;
  brandMentionFrequency: 'high' | 'medium' | 'low';
}> = {
  video: {
    visualWeight: 1.0,
    toneWeight: 0.6,
    colorWeight: 0.9,
    brandMentionFrequency: 'medium',
  },
  image: {
    visualWeight: 1.0,
    toneWeight: 0.3,
    colorWeight: 1.0,
    brandMentionFrequency: 'low',
  },
  blog: {
    visualWeight: 0.3,
    toneWeight: 1.0,
    colorWeight: 0.2,
    brandMentionFrequency: 'high',
  },
  social: {
    visualWeight: 0.7,
    toneWeight: 0.9,
    colorWeight: 0.5,
    brandMentionFrequency: 'high',
  },
  ad_copy: {
    visualWeight: 0.5,
    toneWeight: 1.0,
    colorWeight: 0.4,
    brandMentionFrequency: 'high',
  },
};

/**
 * Builds the brand context section for prompts
 */
function buildBrandContext(brief: EnrichedClientBrief): string {
  const t = brief.textual;
  const parts: string[] = [];
  
  parts.push(`Brand: ${t.brandName}`);
  
  if (t.brandToken) {
    parts.push(`Token/Symbol: ${t.brandToken}`);
  }
  
  if (t.tagline) {
    parts.push(`Tagline: "${t.tagline}"`);
  }
  
  parts.push(`Industry: ${brief.industry}`);
  parts.push(`Archetype: ${t.archetype}`);
  
  if (t.brandValues.length > 0) {
    const valueNames = t.brandValues.slice(0, 3).map(v => v.name).join(', ');
    parts.push(`Core Values: ${valueNames}`);
  }
  
  if (brief.websiteUrl) {
    parts.push(`Website: ${brief.websiteUrl}`);
  }
  
  return parts.join('\n');
}

/**
 * Builds visual guidelines section
 */
function buildVisualGuidelines(visual: VisualBrandBrief, weight: number): string {
  if (weight < 0.3) return '';
  
  const parts: string[] = [];
  
  if (visual.visualStyle) {
    parts.push(`Visual Style: ${visual.visualStyle}`);
  }
  
  if (visual.aesthetic.length > 0) {
    parts.push(`Aesthetic: ${visual.aesthetic.join(', ')}`);
  }
  
  if (visual.moodKeywords.length > 0) {
    const moods = weight > 0.7 
      ? visual.moodKeywords.join(', ')
      : visual.moodKeywords.slice(0, 3).join(', ');
    parts.push(`Mood: ${moods}`);
  }
  
  if (weight > 0.7) {
    if (visual.cinematicMotionStyle) {
      parts.push(`Motion Style: ${visual.cinematicMotionStyle}`);
    }
    if (visual.cinematicPacing) {
      parts.push(`Pacing: ${visual.cinematicPacing}`);
    }
    if (visual.cinematicColorGrading) {
      parts.push(`Color Grading: ${visual.cinematicColorGrading}`);
    }
  }
  
  if (visual.iconStyle && weight > 0.5) {
    parts.push(`Icon Style: ${visual.iconStyle}`);
  }
  
  return parts.length > 0 ? `Visual Guidelines:\n${parts.join('\n')}` : '';
}

/**
 * Builds tone guidelines section
 */
function buildToneGuidelines(textual: TextualBrandBrief, weight: number): string {
  if (weight < 0.3) return '';
  
  const parts: string[] = [];
  
  if (textual.toneDescription) {
    parts.push(`Tone: ${textual.toneDescription}`);
  }
  
  if (weight > 0.5) {
    const formality = textual.toneFormality > 7 ? 'formal' : textual.toneFormality > 4 ? 'balanced' : 'casual';
    const energy = textual.toneEnergy > 7 ? 'high-energy' : textual.toneEnergy > 4 ? 'moderate' : 'calm';
    parts.push(`Voice: ${formality}, ${energy}`);
  }
  
  if (textual.personalityTraits.length > 0 && weight > 0.6) {
    parts.push(`Personality: ${textual.personalityTraits.slice(0, 4).join(', ')}`);
  }
  
  if (textual.examplePhrases.length > 0 && weight > 0.8) {
    parts.push(`Example Phrases: "${textual.examplePhrases[0]}"`);
  }
  
  return parts.length > 0 ? `Tone Guidelines:\n${parts.join('\n')}` : '';
}

/**
 * Builds color palette section
 */
function buildColorPalette(visual: VisualBrandBrief, weight: number): string {
  if (weight < 0.3) return '';
  
  const colors: string[] = [];
  
  if (visual.primaryColor) {
    colors.push(`Primary: ${visual.primaryColor.name} (${visual.primaryColor.hex})`);
  }
  
  if (visual.backgroundColor && weight > 0.5) {
    colors.push(`Background: ${visual.backgroundColor.name} (${visual.backgroundColor.hex})`);
  }
  
  if (visual.accentColors.length > 0 && weight > 0.7) {
    const accents = visual.accentColors.slice(0, 2)
      .map(c => `${c.name} (${c.hex})`)
      .join(', ');
    colors.push(`Accents: ${accents}`);
  }
  
  return colors.length > 0 ? `Color Palette: ${colors.join(' | ')}` : '';
}

/**
 * Builds forbidden elements section
 */
function buildForbiddenElements(textual: TextualBrandBrief, visual: VisualBrandBrief): string {
  const forbidden: string[] = [];
  
  if (textual.forbiddenWords.length > 0) {
    forbidden.push(`Avoid words: ${textual.forbiddenWords.slice(0, 5).join(', ')}`);
  }
  
  if (textual.avoidTraits.length > 0) {
    forbidden.push(`Avoid traits: ${textual.avoidTraits.join(', ')}`);
  }
  
  if (visual.usageDonts.length > 0) {
    forbidden.push(`Visual don'ts: ${visual.usageDonts.slice(0, 3).join(', ')}`);
  }
  
  return forbidden.length > 0 ? `AVOID:\n${forbidden.join('\n')}` : '';
}

/**
 * Extracts reference anchors (logos, website, etc.)
 */
function extractReferenceAnchors(brief: EnrichedClientBrief): string[] {
  const anchors: string[] = [];
  
  if (brief.visual.logoUrl) {
    anchors.push(`Logo: ${brief.visual.logoUrl}`);
  }
  
  if (brief.visual.primaryLogoReference) {
    anchors.push(`Primary Logo Reference: ${brief.visual.primaryLogoReference.url}`);
  }
  
  if (brief.websiteUrl) {
    anchors.push(`Website (brand reference): ${brief.websiteUrl}`);
  }
  
  if (brief.visual.referenceAssets.length > 0) {
    brief.visual.referenceAssets.slice(0, 3).forEach(asset => {
      anchors.push(`${asset.type}: ${asset.url}`);
    });
  }
  
  return anchors;
}

/**
 * Main function: Injects brand intelligence into any prompt
 */
export function injectBrandIntelligence(
  originalPrompt: string,
  brandBrief: EnrichedClientBrief,
  context: PromptContext
): EnhancedPrompt {
  const strategy = CONTENT_TYPE_STRATEGIES[context.contentType] || CONTENT_TYPE_STRATEGIES.video;
  
  const brandContext = buildBrandContext(brandBrief);
  const visualGuidelines = buildVisualGuidelines(brandBrief.visual, strategy.visualWeight);
  const toneGuidelines = buildToneGuidelines(brandBrief.textual, strategy.toneWeight);
  const colorPalette = buildColorPalette(brandBrief.visual, strategy.colorWeight);
  const forbiddenElements = buildForbiddenElements(brandBrief.textual, brandBrief.visual);
  const referenceAnchors = extractReferenceAnchors(brandBrief);
  
  const injection: BrandInjection = {
    brandContext,
    visualGuidelines,
    toneGuidelines,
    colorPalette,
    forbiddenElements,
    referenceAnchors,
  };
  
  // Build enhanced prompt based on content type
  let enhancedPrompt = '';
  
  if (context.contentType === 'video' || context.contentType === 'image') {
    // Visual-first structure
    enhancedPrompt = `
${brandContext}

${visualGuidelines}

${colorPalette}

${originalPrompt}

${forbiddenElements}
`.trim();
  } else {
    // Text-first structure
    enhancedPrompt = `
${brandContext}

${toneGuidelines}

${originalPrompt}

${forbiddenElements}
`.trim();
  }
  
  // Track what was injected
  const injectedElements: string[] = [];
  if (brandContext) injectedElements.push('brand_context');
  if (visualGuidelines) injectedElements.push('visual_guidelines');
  if (toneGuidelines) injectedElements.push('tone_guidelines');
  if (colorPalette) injectedElements.push('color_palette');
  if (forbiddenElements) injectedElements.push('forbidden_elements');
  if (referenceAnchors.length > 0) injectedElements.push('reference_anchors');
  
  return {
    originalPrompt,
    brandEnhancedPrompt: enhancedPrompt,
    brandInjection: injection,
    metadata: {
      clientId: brandBrief.clientId,
      brandArchetype: brandBrief.textual.archetype,
      injectedElements,
    },
  };
}

/**
 * Generates a brand-aware video scene prompt
 */
export function createBrandAwareVideoPrompt(
  sceneDescription: string,
  brandBrief: EnrichedClientBrief,
  sceneContext?: {
    sceneNumber: number;
    totalScenes: number;
    previousSceneDescription?: string;
  }
): EnhancedPrompt {
  let contextualPrompt = sceneDescription;
  
  if (sceneContext) {
    if (sceneContext.sceneNumber === 1) {
      contextualPrompt = `Opening scene: ${sceneDescription}`;
    } else if (sceneContext.sceneNumber === sceneContext.totalScenes) {
      contextualPrompt = `Final scene with call-to-action: ${sceneDescription}`;
    }
  }
  
  return injectBrandIntelligence(contextualPrompt, brandBrief, {
    contentType: 'video',
    format: 'scene',
  });
}

/**
 * Generates a brand-aware social media prompt
 */
export function createBrandAwareSocialPrompt(
  contentDescription: string,
  brandBrief: EnrichedClientBrief,
  platform: 'twitter' | 'linkedin' | 'instagram' | 'facebook'
): EnhancedPrompt {
  const platformGuidelines: Record<string, string> = {
    twitter: 'Concise, engaging, under 280 characters. Use hashtags sparingly.',
    linkedin: 'Professional tone, industry insights, thought leadership focus.',
    instagram: 'Visual-first, lifestyle-oriented, use relevant hashtags.',
    facebook: 'Conversational, community-focused, encourage engagement.',
  };
  
  const enhancedDescription = `
${contentDescription}

Platform: ${platform}
${platformGuidelines[platform]}
`.trim();
  
  return injectBrandIntelligence(enhancedDescription, brandBrief, {
    contentType: 'social',
    targetPlatform: platform,
  });
}

/**
 * Generates a brand-aware blog prompt
 */
export function createBrandAwareBlogPrompt(
  topic: string,
  brandBrief: EnrichedClientBrief,
  format: 'article' | 'listicle' | 'how-to' | 'thought-leadership'
): EnhancedPrompt {
  const formatGuidelines: Record<string, string> = {
    article: 'Comprehensive, well-researched, includes data and examples.',
    listicle: 'Numbered points, scannable, actionable takeaways.',
    'how-to': 'Step-by-step instructions, practical guidance, clear outcomes.',
    'thought-leadership': 'Unique perspective, industry insights, forward-thinking.',
  };
  
  const enhancedTopic = `
Topic: ${topic}

Format: ${format}
${formatGuidelines[format]}

Target Audience: ${brandBrief.textual.audienceDemographics}
`.trim();
  
  return injectBrandIntelligence(enhancedTopic, brandBrief, {
    contentType: 'blog',
    format,
    topic,
  });
}

/**
 * Generates a brand-aware ad copy prompt
 */
export function createBrandAwareAdPrompt(
  objective: string,
  brandBrief: EnrichedClientBrief,
  adType: 'headline' | 'body' | 'cta' | 'full'
): EnhancedPrompt {
  let adGuidelines = '';
  
  switch (adType) {
    case 'headline':
      adGuidelines = 'Create an attention-grabbing headline under 10 words.';
      break;
    case 'body':
      adGuidelines = 'Write compelling body copy that highlights value proposition.';
      break;
    case 'cta':
      adGuidelines = 'Create a strong call-to-action that drives immediate response.';
      break;
    case 'full':
      adGuidelines = 'Create complete ad copy with headline, body, and CTA.';
      break;
  }
  
  const enhancedObjective = `
Objective: ${objective}

Ad Type: ${adType}
${adGuidelines}

${brandBrief.textual.callToActions.length > 0 
  ? `Example CTAs: ${brandBrief.textual.callToActions.slice(0, 2).join(', ')}`
  : ''}
`.trim();
  
  return injectBrandIntelligence(enhancedObjective, brandBrief, {
    contentType: 'ad_copy',
    format: adType,
  });
}

/**
 * Creates a compact brand signature for embedding in any prompt
 */
export function createBrandSignature(brandBrief: EnrichedClientBrief): string {
  const t = brandBrief.textual;
  const v = brandBrief.visual;
  
  return `
[Brand: ${t.brandName} | ${t.archetype} | ${v.visualStyle}]
[Colors: ${v.primaryColor?.hex || 'brand'} on ${v.backgroundColor?.hex || 'dark'}]
[Tone: ${t.toneDescription.substring(0, 50)}...]
`.trim();
}

/**
 * Validates if a generated output aligns with brand guidelines
 */
export function validateBrandAlignment(
  output: string,
  brandBrief: EnrichedClientBrief
): { aligned: boolean; issues: string[]; score: number } {
  const issues: string[] = [];
  let score = 100;
  
  const outputLower = output.toLowerCase();
  
  // Check for forbidden words
  for (const word of brandBrief.textual.forbiddenWords) {
    if (outputLower.includes(word.toLowerCase())) {
      issues.push(`Contains forbidden word: "${word}"`);
      score -= 15;
    }
  }
  
  // Check for avoid traits
  for (const trait of brandBrief.textual.avoidTraits) {
    if (outputLower.includes(trait.toLowerCase())) {
      issues.push(`May reflect avoided trait: "${trait}"`);
      score -= 10;
    }
  }
  
  // Check for brand name presence (if appropriate)
  if (!outputLower.includes(brandBrief.textual.brandName.toLowerCase())) {
    issues.push('Brand name not mentioned');
    score -= 5;
  }
  
  return {
    aligned: score >= 70,
    issues,
    score: Math.max(0, score),
  };
}

export default {
  injectBrandIntelligence,
  createBrandAwareVideoPrompt,
  createBrandAwareSocialPrompt,
  createBrandAwareBlogPrompt,
  createBrandAwareAdPrompt,
  createBrandSignature,
  validateBrandAlignment,
};
