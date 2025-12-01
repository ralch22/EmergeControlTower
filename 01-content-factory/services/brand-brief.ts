import type { BrandProfileJSON } from "../../shared/schema";

export interface TextualBrandBrief {
  brandName: string;
  brandToken?: string;
  tagline: string;
  mission?: string;
  brandStory?: string;
  archetype: string;
  personalityTraits: string[];
  avoidTraits: string[];
  toneDescription: string;
  toneFormality: number;
  toneEnergy: number;
  toneTechnicality: number;
  toneWarmth: number;
  keywords: string[];
  forbiddenWords: string[];
  contentGoals: string[];
  examplePhrases: string[];
  callToActions: string[];
  audienceDemographics: string;
  audiencePsychographics?: string;
  audiencePainPoints: string[];
  audienceGoals: string[];
  brandValues: Array<{ name: string; description: string }>;
}

export interface ReferenceAsset {
  id: string;
  type: 'logo' | 'icon' | 'moodboard' | 'reference_image';
  url: string;
  description?: string;
  isPrimary?: boolean;
}

export interface VisualBrandBrief {
  visualStyle: string;
  aesthetic: string[];
  moodKeywords: string[];
  patterns: string[];
  motifs: string[];
  primaryColor: { name: string; hex: string; usage: string };
  backgroundColor: { name: string; hex: string; usage: string };
  textColor: { name: string; hex: string; usage: string };
  accentColors: Array<{ name: string; hex: string; usage: string }>;
  fonts: Array<{ family: string; usage: string }>;
  iconStyle: string;
  cinematicAspectRatio: string;
  cinematicResolution: string;
  cinematicPacing: string;
  cinematicMotionStyle: string;
  cinematicTransitions?: string;
  cinematicColorGrading?: string;
  usageDos: string[];
  usageDonts: string[];
  logoUrl?: string;
  primaryLogoReference?: ReferenceAsset;
  referenceAssets: ReferenceAsset[];
}

export interface EnrichedClientBrief {
  clientId: string;
  clientName: string;
  industry: string;
  brandVoice: string;
  targetAudience: string;
  keywords: string[];
  contentGoals: string[];
  textual: TextualBrandBrief;
  visual: VisualBrandBrief;
  hasFullProfile: boolean;
}

export function composeBrandBrief(
  client: {
    id: number;
    name: string;
    industry: string;
    brandVoice: string;
    targetAudience: string;
    keywords: string;
    contentGoals: string;
    brandProfile?: BrandProfileJSON | null;
    primaryLogoUrl?: string | null;
  }
): EnrichedClientBrief {
  const bp = client.brandProfile;
  
  const defaultTextual: TextualBrandBrief = {
    brandName: client.name,
    tagline: "",
    archetype: "Professional Expert",
    personalityTraits: ["professional", "knowledgeable", "trustworthy"],
    avoidTraits: [],
    toneDescription: client.brandVoice,
    toneFormality: 7,
    toneEnergy: 5,
    toneTechnicality: 5,
    toneWarmth: 5,
    keywords: client.keywords.split(",").map(k => k.trim()).filter(Boolean),
    forbiddenWords: [],
    contentGoals: client.contentGoals.split(",").map(g => g.trim()).filter(Boolean),
    examplePhrases: [],
    callToActions: [],
    audienceDemographics: client.targetAudience,
    audiencePainPoints: [],
    audienceGoals: [],
    brandValues: [],
  };

  const defaultVisual: VisualBrandBrief = {
    visualStyle: "Professional, modern, clean",
    aesthetic: ["modern", "professional"],
    moodKeywords: ["confident", "trustworthy"],
    patterns: [],
    motifs: [],
    primaryColor: { name: "Brand Blue", hex: "#3B82F6", usage: "Primary accents" },
    backgroundColor: { name: "Dark", hex: "#1a1a2e", usage: "Backgrounds" },
    textColor: { name: "White", hex: "#ffffff", usage: "Primary text" },
    accentColors: [],
    fonts: [{ family: "Inter", usage: "Body and headings" }],
    iconStyle: "outline",
    cinematicAspectRatio: "16:9",
    cinematicResolution: "1080p",
    cinematicPacing: "moderate",
    cinematicMotionStyle: "smooth",
    usageDos: [],
    usageDonts: [],
    logoUrl: client.primaryLogoUrl || undefined,
    primaryLogoReference: client.primaryLogoUrl ? {
      id: 'primary-logo',
      type: 'logo' as const,
      url: client.primaryLogoUrl,
      description: `Primary brand logo for ${client.name}`,
      isPrimary: true,
    } : undefined,
    referenceAssets: [],
  };

  if (!bp) {
    return {
      clientId: String(client.id),
      clientName: client.name,
      industry: client.industry,
      brandVoice: client.brandVoice,
      targetAudience: client.targetAudience,
      keywords: defaultTextual.keywords,
      contentGoals: defaultTextual.contentGoals,
      textual: defaultTextual,
      visual: defaultVisual,
      hasFullProfile: false,
    };
  }

  const t = bp.textual;
  const v = bp.visual;

  if (!t || !v) {
    return {
      clientId: String(client.id),
      clientName: client.name,
      industry: client.industry,
      brandVoice: client.brandVoice,
      targetAudience: client.targetAudience,
      keywords: defaultTextual.keywords,
      contentGoals: defaultTextual.contentGoals,
      textual: defaultTextual,
      visual: defaultVisual,
      hasFullProfile: false,
    };
  }

  const textual: TextualBrandBrief = {
    brandName: t.brandName?.primary || client.name,
    brandToken: t.brandName?.token,
    tagline: t.tagline?.primary || "",
    mission: t.mission,
    brandStory: t.brandStory?.short,
    archetype: t.personality?.archetype || defaultTextual.archetype,
    personalityTraits: t.personality?.traits || defaultTextual.personalityTraits,
    avoidTraits: t.personality?.avoidTraits || [],
    toneDescription: t.tone?.description || client.brandVoice,
    toneFormality: t.tone?.formality ?? defaultTextual.toneFormality,
    toneEnergy: t.tone?.energy ?? defaultTextual.toneEnergy,
    toneTechnicality: t.tone?.technicality ?? defaultTextual.toneTechnicality,
    toneWarmth: t.tone?.warmth ?? defaultTextual.toneWarmth,
    keywords: t.keywords || defaultTextual.keywords,
    forbiddenWords: t.forbiddenWords || [],
    contentGoals: t.contentGoals || defaultTextual.contentGoals,
    examplePhrases: t.examplePhrases || [],
    callToActions: t.callToActions || [],
    audienceDemographics: t.targetAudience?.demographics || client.targetAudience,
    audiencePsychographics: t.targetAudience?.psychographics,
    audiencePainPoints: t.targetAudience?.painPoints || [],
    audienceGoals: t.targetAudience?.goals || [],
    brandValues: t.values || [],
  };

  const defaultColor = { name: "Default", hex: "#3B82F6", usage: "Default" };
  const defaultBgColor = { name: "Dark", hex: "#1a1a2e", usage: "Backgrounds" };
  const defaultTextColor = { name: "White", hex: "#ffffff", usage: "Primary text" };

  const visual: VisualBrandBrief = {
    visualStyle: v.visualStyle?.description || defaultVisual.visualStyle,
    aesthetic: v.visualStyle?.aesthetic || defaultVisual.aesthetic,
    moodKeywords: v.visualStyle?.moodKeywords || defaultVisual.moodKeywords,
    patterns: v.visualStyle?.patterns || [],
    motifs: v.visualStyle?.motifs || [],
    primaryColor: v.colorPalette?.darkMode?.accent || defaultColor,
    backgroundColor: v.colorPalette?.darkMode?.background || defaultBgColor,
    textColor: v.colorPalette?.darkMode?.textPrimary || defaultTextColor,
    accentColors: v.colorPalette?.additionalColors || [],
    fonts: v.typography?.fonts?.map(f => ({ family: f.family, usage: f.usage })) || defaultVisual.fonts,
    iconStyle: v.iconography?.style || defaultVisual.iconStyle,
    cinematicAspectRatio: v.cinematicGuidelines?.aspectRatio || defaultVisual.cinematicAspectRatio,
    cinematicResolution: v.cinematicGuidelines?.resolution || defaultVisual.cinematicResolution,
    cinematicPacing: v.cinematicGuidelines?.pacing || defaultVisual.cinematicPacing,
    cinematicMotionStyle: v.cinematicGuidelines?.motionStyle || defaultVisual.cinematicMotionStyle,
    cinematicTransitions: v.cinematicGuidelines?.transitionStyle,
    cinematicColorGrading: v.cinematicGuidelines?.colorGrading,
    usageDos: v.usageRules?.dos || [],
    usageDonts: v.usageRules?.donts || [],
    logoUrl: client.primaryLogoUrl || bp.referenceAssets?.logos?.find(l => l.isPrimary)?.url,
    primaryLogoReference: client.primaryLogoUrl ? {
      id: 'primary-logo',
      type: 'logo' as const,
      url: client.primaryLogoUrl,
      description: `Primary brand logo for ${client.name}`,
      isPrimary: true,
    } : bp.referenceAssets?.logos?.find(l => l.isPrimary) ? {
      id: bp.referenceAssets.logos.find(l => l.isPrimary)!.id || 'profile-logo',
      type: 'logo' as const,
      url: bp.referenceAssets.logos.find(l => l.isPrimary)!.url,
      description: `Primary brand logo for ${client.name}`,
      isPrimary: true,
    } : undefined,
    referenceAssets: [
      ...(bp.referenceAssets?.logos || []).map(l => ({
        id: l.id || `logo-${Math.random().toString(36).substr(2, 9)}`,
        type: 'logo' as const,
        url: l.url,
        isPrimary: l.isPrimary,
      })),
      ...(bp.referenceAssets?.icons || []).map(i => ({
        id: i.id || `icon-${Math.random().toString(36).substr(2, 9)}`,
        type: 'icon' as const,
        url: i.url,
      })),
      ...(bp.referenceAssets?.moodBoards || []).map(m => ({
        id: m.id || `moodboard-${Math.random().toString(36).substr(2, 9)}`,
        type: 'moodboard' as const,
        url: m.url,
      })),
    ],
  };

  return {
    clientId: String(client.id),
    clientName: client.name,
    industry: client.industry,
    brandVoice: client.brandVoice,
    targetAudience: client.targetAudience,
    keywords: textual.keywords,
    contentGoals: textual.contentGoals,
    textual,
    visual,
    hasFullProfile: true,
  };
}

export function formatTextualBriefForPrompt(brief: EnrichedClientBrief): string {
  const t = brief.textual;
  
  return `
=== BRAND IDENTITY ===
Brand: ${t.brandName}${t.brandToken ? ` (${t.brandToken})` : ''}
Tagline: "${t.tagline}"
${t.mission ? `Mission: ${t.mission}` : ''}
${t.brandStory ? `Story: ${t.brandStory}` : ''}

=== VOICE & PERSONALITY ===
Archetype: ${t.archetype}
Traits: ${t.personalityTraits.join(', ')}
${t.avoidTraits.length ? `Avoid: ${t.avoidTraits.join(', ')}` : ''}
Tone: ${t.toneDescription}
- Formality: ${t.toneFormality}/10 | Energy: ${t.toneEnergy}/10
- Technicality: ${t.toneTechnicality}/10 | Warmth: ${t.toneWarmth}/10

=== TARGET AUDIENCE ===
Demographics: ${t.audienceDemographics}
${t.audiencePsychographics ? `Psychographics: ${t.audiencePsychographics}` : ''}
${t.audiencePainPoints.length ? `Pain Points: ${t.audiencePainPoints.join('; ')}` : ''}
${t.audienceGoals.length ? `Goals: ${t.audienceGoals.join('; ')}` : ''}

=== CONTENT RULES ===
Keywords: ${t.keywords.join(', ')}
Goals: ${t.contentGoals.join('; ')}
${t.examplePhrases.length ? `Example Phrases: "${t.examplePhrases.slice(0, 3).join('", "')}"` : ''}
${t.forbiddenWords.length ? `FORBIDDEN WORDS (never use): ${t.forbiddenWords.join(', ')}` : ''}
${t.callToActions.length ? `Preferred CTAs: ${t.callToActions.join(' | ')}` : ''}

${t.brandValues.length ? `=== BRAND VALUES ===\n${t.brandValues.map(v => `• ${v.name}: ${v.description}`).join('\n')}` : ''}`.trim();
}

export function formatVisualBriefForPrompt(brief: EnrichedClientBrief): string {
  const v = brief.visual;
  
  return `
=== VISUAL IDENTITY ===
Style: ${v.visualStyle}
Aesthetic: ${v.aesthetic.join(', ')}
Mood: ${v.moodKeywords.join(', ')}
${v.patterns.length ? `Patterns: ${v.patterns.join(', ')}` : ''}
${v.motifs.length ? `Motifs: ${v.motifs.join(', ')}` : ''}

=== COLOR PALETTE ===
Primary: ${v.primaryColor.name} (${v.primaryColor.hex}) - ${v.primaryColor.usage}
Background: ${v.backgroundColor.name} (${v.backgroundColor.hex})
Text: ${v.textColor.name} (${v.textColor.hex})
${v.accentColors.length ? `Accents: ${v.accentColors.map(c => `${c.name} ${c.hex}`).join(', ')}` : ''}

=== TYPOGRAPHY ===
${v.fonts.map(f => `${f.family}: ${f.usage}`).join('\n')}

=== ICONOGRAPHY ===
Style: ${v.iconStyle}

=== CINEMATIC GUIDELINES ===
Aspect Ratio: ${v.cinematicAspectRatio}
Resolution: ${v.cinematicResolution}
Pacing: ${v.cinematicPacing}
Motion: ${v.cinematicMotionStyle}
${v.cinematicTransitions ? `Transitions: ${v.cinematicTransitions}` : ''}
${v.cinematicColorGrading ? `Color Grading: ${v.cinematicColorGrading}` : ''}

${v.logoUrl ? `=== LOGO ===\nPrimary Logo: ${v.logoUrl}` : ''}

${v.usageDos.length || v.usageDonts.length ? `=== USAGE RULES ===
${v.usageDos.length ? `DO: ${v.usageDos.join('; ')}` : ''}
${v.usageDonts.length ? `DON'T: ${v.usageDonts.join('; ')}` : ''}` : ''}`.trim();
}

export function formatFullBriefForPrompt(brief: EnrichedClientBrief): string {
  return `${formatTextualBriefForPrompt(brief)}

${formatVisualBriefForPrompt(brief)}`;
}

export function buildSystemPromptSuffix(brief: EnrichedClientBrief): string {
  const t = brief.textual;
  
  return `You are writing for ${t.brandName}. Embody the ${t.archetype} archetype with traits: ${t.personalityTraits.join(', ')}. Use a ${t.toneDescription} tone (formality: ${t.toneFormality}/10, energy: ${t.toneEnergy}/10). Target audience: ${t.audienceDemographics}. Naturally incorporate keywords: ${t.keywords.slice(0, 5).join(', ')}.${t.forbiddenWords.length ? ` NEVER use these words: ${t.forbiddenWords.join(', ')}.` : ''}`;
}

export function getEffectiveCTA(brief: EnrichedClientBrief, overrideCta?: string): string | undefined {
  if (overrideCta) return overrideCta;
  if (brief.textual.callToActions.length > 0) return brief.textual.callToActions[0];
  return undefined;
}

export function buildImagePromptEnrichment(brief: EnrichedClientBrief, basePrompt: string): string {
  const v = brief.visual;
  
  const colorContext = `Use brand colors: ${v.primaryColor.name} (${v.primaryColor.hex}) as accent, ${v.backgroundColor.name} (${v.backgroundColor.hex}) for backgrounds.`;
  const styleContext = `Style: ${v.aesthetic.join(', ')}. Mood: ${v.moodKeywords.join(', ')}.`;
  const motifContext = v.motifs.length ? `Include brand motifs: ${v.motifs.join(', ')}.` : '';
  
  const referenceDirective = v.primaryLogoReference ? `
=== CRITICAL: BRAND REFERENCE IMAGE ===
REFERENCE IMAGE URL: ${v.primaryLogoReference.url}

You MUST analyze this brand logo/reference image and ensure ALL generated visuals:
1. Match the exact color palette visible in the reference
2. Maintain consistent visual style and aesthetic
3. Use similar design elements, shapes, and motifs
4. Preserve the brand's visual DNA - no creative deviations
5. If the reference shows specific iconography (shields, geometric shapes, etc.), incorporate these elements

DO NOT deviate from the reference style. The generated image must look like it belongs to the same brand.
` : '';
  
  return `${basePrompt}

${referenceDirective}
Brand Visual Guidelines:
${colorContext}
${styleContext}
${motifContext}
${v.patterns.length ? `Patterns to incorporate: ${v.patterns.join(', ')}.` : ''}
${v.usageDos.length ? `Design DOs: ${v.usageDos.join('; ')}` : ''}
${v.usageDonts.length ? `Design DON'Ts: ${v.usageDonts.join('; ')}` : ''}`.trim();
}

export function buildReferenceConstrainedImagePrompt(
  brief: EnrichedClientBrief, 
  basePrompt: string,
  options?: {
    strictMode?: boolean;
    includeLogoInImage?: boolean;
    imageType?: 'hero' | 'social' | 'ad' | 'blog' | 'thumbnail';
  }
): { prompt: string; referenceImageUrl?: string } {
  const v = brief.visual;
  const opts = options || {};
  const strictMode = opts.strictMode ?? true;
  
  const referenceImageUrl = v.primaryLogoReference?.url || v.logoUrl;
  
  let referenceBlock = '';
  if (referenceImageUrl) {
    referenceBlock = strictMode ? `
=== MANDATORY BRAND REFERENCE ===
REFERENCE IMAGE: ${referenceImageUrl}

STRICT VISUAL CONSISTENCY REQUIREMENTS:
- Extract the exact hex colors from the reference and use ONLY those colors
- Match the visual style (minimalist, futuristic, organic, etc.) exactly
- Replicate design elements: shapes, iconography, patterns
- Maintain the same level of detail and complexity
- Use consistent lighting style and shadow treatment
- The output must be instantly recognizable as part of this brand

PROHIBITED DEVIATIONS:
- Do NOT introduce new colors not present in the reference
- Do NOT change the visual style or aesthetic
- Do NOT ignore brand motifs or patterns
- Do NOT use conflicting design elements
` : `
=== BRAND REFERENCE ===
Reference Image: ${referenceImageUrl}
Use this reference to guide your visual style, colors, and design approach.
`;
  }
  
  const imageTypeGuidance = opts.imageType ? {
    hero: 'Create a prominent, attention-grabbing hero image suitable for landing pages.',
    social: 'Create a social media optimized image with clear visual hierarchy.',
    ad: 'Create a compelling advertisement visual with strong brand presence.',
    blog: 'Create a blog header image that complements written content.',
    thumbnail: 'Create a compact, recognizable thumbnail image.',
  }[opts.imageType] : '';
  
  const prompt = `${basePrompt}

${referenceBlock}
${imageTypeGuidance ? `\nImage Purpose: ${imageTypeGuidance}\n` : ''}
BRAND COLOR PALETTE:
- Primary Accent: ${v.primaryColor.name} (${v.primaryColor.hex}) - ${v.primaryColor.usage}
- Background: ${v.backgroundColor.name} (${v.backgroundColor.hex}) - ${v.backgroundColor.usage}
- Text/Contrast: ${v.textColor.name} (${v.textColor.hex})
${v.accentColors.length ? `- Additional Accents: ${v.accentColors.map(c => `${c.name} ${c.hex}`).join(', ')}` : ''}

VISUAL STYLE:
- Aesthetic: ${v.aesthetic.join(', ')}
- Mood: ${v.moodKeywords.join(', ')}
${v.patterns.length ? `- Patterns: ${v.patterns.join(', ')}` : ''}
${v.motifs.length ? `- Motifs to include: ${v.motifs.join(', ')}` : ''}

${opts.includeLogoInImage && referenceImageUrl ? `Include the brand logo from the reference in an appropriate position.` : ''}

${v.usageDos.length ? `BRAND DOs: ${v.usageDos.join('; ')}` : ''}
${v.usageDonts.length ? `BRAND DON'Ts: ${v.usageDonts.join('; ')}` : ''}`.trim();
  
  return { prompt, referenceImageUrl };
}

export function buildVideoSceneEnrichment(brief: EnrichedClientBrief, sceneDescription: string): string {
  const v = brief.visual;
  
  const referenceDirective = v.primaryLogoReference ? `
=== BRAND REFERENCE FOR VIDEO ===
Reference Asset: ${v.primaryLogoReference.url}
Ensure video maintains visual consistency with this brand reference.
Extract and match: color palette, visual motifs, design style.
` : '';
  
  return `${sceneDescription}
${referenceDirective}
Cinematic Style:
- Aspect Ratio: ${v.cinematicAspectRatio}
- Resolution: ${v.cinematicResolution}
- Pacing: ${v.cinematicPacing}
- Motion: ${v.cinematicMotionStyle}
- Color Palette: ${v.primaryColor.hex} accents on ${v.backgroundColor.hex} backgrounds
- Mood: ${v.moodKeywords.join(', ')}
${v.cinematicColorGrading ? `- Color Grading: ${v.cinematicColorGrading}` : ''}
${v.cinematicTransitions ? `- Transitions: ${v.cinematicTransitions}` : ''}
${v.motifs.length ? `- Brand Motifs: ${v.motifs.join(', ')}` : ''}
${v.patterns.length ? `- Brand Patterns: ${v.patterns.join(', ')}` : ''}`;
}

export function buildReferenceConstrainedVideoPrompt(
  brief: EnrichedClientBrief,
  sceneDescription: string,
  options?: {
    sceneIndex?: number;
    totalScenes?: number;
    includeLogoOverlay?: boolean;
  }
): { prompt: string; referenceImageUrl?: string } {
  const v = brief.visual;
  const opts = options || {};
  
  const referenceImageUrl = v.primaryLogoReference?.url || v.logoUrl;
  
  let referenceBlock = '';
  if (referenceImageUrl) {
    referenceBlock = `
=== MANDATORY BRAND REFERENCE FOR VIDEO ===
REFERENCE IMAGE: ${referenceImageUrl}

VIDEO VISUAL CONSISTENCY REQUIREMENTS:
- Color palette MUST match the reference exactly (${v.primaryColor.hex}, ${v.backgroundColor.hex})
- Visual style and aesthetic must align with reference
- Include brand motifs and design elements throughout
- Motion graphics should complement the brand style
- Maintain consistent lighting and mood

PROHIBITED:
- Colors not in the brand palette
- Conflicting visual styles
- Generic stock footage aesthetic
`;
  }
  
  const sceneContext = opts.sceneIndex !== undefined && opts.totalScenes !== undefined 
    ? `Scene ${opts.sceneIndex + 1} of ${opts.totalScenes}.` 
    : '';
  
  const prompt = `${sceneDescription}

${sceneContext}
${referenceBlock}
CINEMATIC SPECIFICATIONS:
- Aspect Ratio: ${v.cinematicAspectRatio}
- Resolution: ${v.cinematicResolution}
- Pacing: ${v.cinematicPacing}
- Motion Style: ${v.cinematicMotionStyle}
${v.cinematicColorGrading ? `- Color Grading: ${v.cinematicColorGrading}` : ''}
${v.cinematicTransitions ? `- Transitions: ${v.cinematicTransitions}` : ''}

BRAND VISUAL ELEMENTS:
- Primary Color: ${v.primaryColor.hex} (${v.primaryColor.name})
- Background: ${v.backgroundColor.hex}
- Accent Colors: ${v.accentColors.map(c => c.hex).join(', ') || 'N/A'}
- Mood: ${v.moodKeywords.join(', ')}
${v.motifs.length ? `- Motifs: ${v.motifs.join(', ')}` : ''}
${v.patterns.length ? `- Patterns: ${v.patterns.join(', ')}` : ''}

${opts.includeLogoOverlay ? `Include subtle brand logo watermark in corner.` : ''}

${v.usageDos.length ? `VIDEO DOs: ${v.usageDos.join('; ')}` : ''}
${v.usageDonts.length ? `VIDEO DON'Ts: ${v.usageDonts.join('; ')}` : ''}`.trim();
  
  return { prompt, referenceImageUrl };
}

export function getReferenceAssetUrl(brief: EnrichedClientBrief): string | undefined {
  return brief.visual.primaryLogoReference?.url || brief.visual.logoUrl;
}

export function hasReferenceAsset(brief: EnrichedClientBrief): boolean {
  return !!(brief.visual.primaryLogoReference?.url || brief.visual.logoUrl);
}

export function buildQAValidationCriteria(brief: EnrichedClientBrief): string {
  const t = brief.textual;
  
  const criteria: string[] = [
    `Brand Voice: Must match ${t.archetype} archetype with ${t.personalityTraits.slice(0, 3).join(', ')} traits`,
    `Tone: ${t.toneDescription} (formality ${t.toneFormality}/10)`,
    `Audience Fit: Content should resonate with ${t.audienceDemographics}`,
  ];
  
  if (t.forbiddenWords.length) {
    criteria.push(`Forbidden Words Check: Must NOT contain: ${t.forbiddenWords.join(', ')}`);
  }
  
  if (t.keywords.length) {
    criteria.push(`Keyword Usage: Should naturally include: ${t.keywords.slice(0, 5).join(', ')}`);
  }
  
  if (t.callToActions.length) {
    criteria.push(`CTA Alignment: Should use or align with preferred CTAs: ${t.callToActions.join(' | ')}`);
  }
  
  if (t.avoidTraits.length) {
    criteria.push(`Personality Avoidance: Must NOT sound ${t.avoidTraits.join(', ')}`);
  }
  
  return criteria.map((c, i) => `${i + 1}. ${c}`).join('\n');
}
