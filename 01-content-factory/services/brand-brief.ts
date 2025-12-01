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
  referenceAssets: Array<{ id: string; type: string; url: string }>;
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
    referenceAssets: [
      ...(bp.referenceAssets?.logos || []),
      ...(bp.referenceAssets?.icons || []),
      ...(bp.referenceAssets?.moodBoards || []),
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
  
  return `${basePrompt}

Brand Visual Guidelines:
${colorContext}
${styleContext}
${motifContext}
${v.logoUrl ? `Brand logo available at: ${v.logoUrl} - reference this style.` : ''}`.trim();
}

export function buildVideoSceneEnrichment(brief: EnrichedClientBrief, sceneDescription: string): string {
  const v = brief.visual;
  
  return `${sceneDescription}

Cinematic Style:
- Aspect Ratio: ${v.cinematicAspectRatio}
- Pacing: ${v.cinematicPacing}
- Motion: ${v.cinematicMotionStyle}
- Colors: ${v.primaryColor.hex} accents on ${v.backgroundColor.hex} backgrounds
- Mood: ${v.moodKeywords.join(', ')}
${v.cinematicColorGrading ? `- Color Grading: ${v.cinematicColorGrading}` : ''}`;
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
