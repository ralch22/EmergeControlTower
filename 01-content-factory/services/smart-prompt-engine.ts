import type { 
  BrandProfile, 
  AssetType, 
  AssetGenerationRequest,
  Color,
  TextualComponents,
  VisualComponents 
} from '../types/brand-profile';

// ============================================
// SMART PROMPT ENGINE
// Dynamically builds optimized prompts for each content type
// using structured brand profile data
// ============================================

export interface PromptContext {
  brandProfile: BrandProfile;
  assetType: AssetType;
  options?: AssetGenerationRequest['options'];
}

export interface GeneratedPrompt {
  mainPrompt: string;
  negativePrompt?: string;
  systemPrompt?: string;
  styleModifiers: string[];
  colorHints: string[];
  metadata: {
    assetType: AssetType;
    promptVersion: string;
    generatedAt: string;
  };
}

// ============================================
// CONTEXT SELECTORS
// Pull relevant attributes based on content type
// ============================================

function selectImageContext(visual: VisualComponents): string[] {
  const context: string[] = [];
  
  // Visual style
  context.push(visual.visualStyle.description);
  context.push(...visual.visualStyle.aesthetic);
  context.push(...visual.visualStyle.moodKeywords);
  
  if (visual.visualStyle.patterns) {
    context.push(...visual.visualStyle.patterns);
  }
  if (visual.visualStyle.motifs) {
    context.push(...visual.visualStyle.motifs.map(m => `${m} motif`));
  }
  
  return context;
}

function selectVideoContext(visual: VisualComponents): string[] {
  const context: string[] = [];
  const cine = visual.cinematicGuidelines;
  
  context.push(cine.motionStyle);
  if (cine.transitionStyle) context.push(cine.transitionStyle);
  if (cine.colorGrading) context.push(cine.colorGrading);
  context.push(`${cine.pacing} pacing`);
  
  return context;
}

function selectTextContext(textual: TextualComponents): string[] {
  const context: string[] = [];
  
  context.push(textual.tone.description);
  context.push(...textual.personality.traits);
  context.push(...textual.keywords.slice(0, 5));
  
  return context;
}

function selectAudioContext(visual: VisualComponents, textual: TextualComponents): string[] {
  const context: string[] = [];
  
  if (visual.cinematicGuidelines.soundtrackStyle) {
    context.push(visual.cinematicGuidelines.soundtrackStyle);
  }
  
  // Map tone to audio characteristics
  const tone = textual.tone;
  if (tone.energy > 70) context.push("energetic delivery");
  else if (tone.energy < 30) context.push("calm, measured delivery");
  else context.push("balanced energy");
  
  if (tone.formality > 70) context.push("professional, authoritative voice");
  else if (tone.formality < 30) context.push("conversational, friendly voice");
  else context.push("approachable yet professional voice");
  
  return context;
}

// ============================================
// COLOR HINT BUILDERS
// ============================================

function buildColorHints(visual: VisualComponents, preferDarkMode = true): string[] {
  const hints: string[] = [];
  const theme = preferDarkMode ? visual.colorPalette.darkMode : (visual.colorPalette.lightMode || visual.colorPalette.darkMode);
  
  hints.push(`primary color: ${theme.background.hex} (${theme.background.name})`);
  hints.push(`accent color: ${theme.accent.hex} (${theme.accent.name})`);
  hints.push(`text color: ${theme.textPrimary.hex}`);
  
  if (theme.success) hints.push(`success indicator: ${theme.success.hex}`);
  if (visual.colorPalette.additionalColors) {
    visual.colorPalette.additionalColors.forEach(c => {
      hints.push(`${c.usage}: ${c.hex}`);
    });
  }
  
  return hints;
}

function buildColorString(visual: VisualComponents, preferDarkMode = true): string {
  const theme = preferDarkMode ? visual.colorPalette.darkMode : (visual.colorPalette.lightMode || visual.colorPalette.darkMode);
  
  return `color scheme: ${theme.background.name} background (${theme.background.hex}), ${theme.accent.name} accents (${theme.accent.hex}), ${theme.textPrimary.name} text`;
}

// ============================================
// STYLE MODIFIER BUILDERS
// ============================================

function buildStyleModifiers(profile: BrandProfile, assetType: AssetType): string[] {
  const modifiers: string[] = [];
  const visual = profile.visual;
  const textual = profile.textual;
  
  // Universal modifiers from personality
  textual.personality.traits.forEach(trait => {
    modifiers.push(trait.toLowerCase());
  });
  
  // Visual style modifiers
  modifiers.push(...visual.visualStyle.aesthetic);
  
  // Asset-specific modifiers
  switch (assetType) {
    case 'mood_board':
      modifiers.push('collage layout', 'cohesive visual narrative', 'brand elements showcased');
      break;
    case 'icon_set':
    case 'icon_individual':
      modifiers.push(`${visual.iconography.style} style`);
      if (visual.iconography.shape) modifiers.push(visual.iconography.shape);
      modifiers.push('consistent visual language', 'scalable vector');
      break;
    case 'infographic':
      modifiers.push('data visualization', 'clear hierarchy', 'informative design');
      break;
    case 'promo_video':
      modifiers.push(visual.cinematicGuidelines.motionStyle);
      modifiers.push(`${visual.cinematicGuidelines.pacing} pace`);
      break;
    case 'social_post':
      modifiers.push('scroll-stopping', 'engaging', 'social-media optimized');
      break;
    case 'blog_hero':
      modifiers.push('editorial', 'professional', 'high-quality header');
      break;
    case 'ad_creative':
      modifiers.push('conversion-focused', 'attention-grabbing', 'clear call-to-action');
      break;
    case 'logo_variant':
      modifiers.push('brand-consistent', 'recognizable', 'versatile');
      break;
  }
  
  return Array.from(new Set(modifiers));
}

// ============================================
// NEGATIVE PROMPT BUILDER
// ============================================

function buildNegativePrompt(profile: BrandProfile, assetType: AssetType): string {
  const negatives: string[] = [];
  
  // From forbidden words (for visual connotation)
  profile.textual.forbiddenWords.forEach(word => {
    negatives.push(word.toLowerCase());
  });
  
  // Avoid personality anti-traits
  if (profile.textual.personality.avoidTraits) {
    negatives.push(...profile.textual.personality.avoidTraits);
  }
  
  // Standard quality negatives
  negatives.push('low quality', 'blurry', 'pixelated', 'amateur', 'cluttered');
  negatives.push('watermark', 'text overlay', 'logo watermark');
  
  // Asset-specific negatives
  switch (assetType) {
    case 'icon_set':
    case 'icon_individual':
      negatives.push('photorealistic', 'complex details', 'gradients' + (profile.visual.iconography.style === 'outline' ? '' : ''));
      break;
    case 'promo_video':
      negatives.push('static', 'boring', 'shaky camera');
      break;
    case 'mood_board':
      negatives.push('single image', 'uniform layout', 'lack of variety');
      break;
  }
  
  return Array.from(new Set(negatives)).join(', ');
}

// ============================================
// SYSTEM PROMPT BUILDERS (for text generation)
// ============================================

function buildTextSystemPrompt(profile: BrandProfile): string {
  const textual = profile.textual;
  const tone = textual.tone;
  
  let prompt = `You are a content creator for ${textual.brandName.primary}. `;
  prompt += `Brand personality: ${textual.personality.archetype}. `;
  prompt += `Tone: ${textual.tone.description}. `;
  
  // Tone slider interpretations
  if (tone.formality > 70) prompt += `Use formal, professional language. `;
  else if (tone.formality < 30) prompt += `Use casual, conversational language. `;
  
  if (tone.technicality > 70) prompt += `Include technical details and industry terminology. `;
  else if (tone.technicality < 30) prompt += `Keep explanations simple and accessible. `;
  
  // Keywords to emphasize
  prompt += `Key themes to emphasize: ${textual.keywords.slice(0, 5).join(', ')}. `;
  
  // Forbidden words
  prompt += `NEVER use these words: ${textual.forbiddenWords.join(', ')}. `;
  
  // Example phrasing
  if (textual.examplePhrases.length > 0) {
    prompt += `Example brand phrases for inspiration: "${textual.examplePhrases.slice(0, 3).join('", "')}"`;
  }
  
  return prompt;
}

// ============================================
// MAIN PROMPT GENERATORS BY ASSET TYPE
// ============================================

function generateMoodBoardPrompt(profile: BrandProfile): string {
  const visual = profile.visual;
  const textual = profile.textual;
  
  let prompt = `Create a professional mood board collage (1920x1080) for the brand "${textual.brandName.primary}". `;
  prompt += `Brand essence: ${textual.brandStory.short}. `;
  prompt += `Visual style: ${visual.visualStyle.description}. `;
  prompt += `Include elements representing: ${visual.visualStyle.motifs?.join(', ') || textual.keywords.slice(0, 5).join(', ')}. `;
  prompt += buildColorString(visual);
  prompt += `. Aesthetic: ${visual.visualStyle.aesthetic.join(', ')}. `;
  prompt += `High quality, professional design, cohesive brand narrative.`;
  
  return prompt;
}

function generateIconPrompt(profile: BrandProfile, iconName: string): string {
  const visual = profile.visual;
  const icon = visual.iconography;
  
  let prompt = `Create a brand icon for "${iconName}". `;
  prompt += `Style: ${icon.style} icon with ${icon.cornerStyle || 'rounded'} corners. `;
  if (icon.shape) prompt += `Shape treatment: ${icon.shape}. `;
  prompt += `Color: ${visual.colorPalette.darkMode.accent.hex} accent on transparent background. `;
  prompt += `${icon.sizeBase}x${icon.sizeBase} base size, vector-quality, consistent stroke width. `;
  prompt += `Brand aesthetic: ${visual.visualStyle.aesthetic.slice(0, 3).join(', ')}. `;
  prompt += `Minimal, clean, professional, scalable.`;
  
  return prompt;
}

function generateInfographicPrompt(profile: BrandProfile, data?: Record<string, unknown>): string {
  const visual = profile.visual;
  const textual = profile.textual;
  
  let prompt = `Create a professional infographic (1200x1200) for ${textual.brandName.primary}. `;
  
  if (data && data.type === 'tokenomics') {
    prompt += `Type: Tokenomics diagram showing token distribution and flow. `;
    prompt += `Circular flywheel design with flowing arrows. `;
  } else {
    prompt += `Type: Data visualization infographic. `;
  }
  
  prompt += buildColorString(visual);
  prompt += `. Style: ${visual.visualStyle.aesthetic.join(', ')}. `;
  prompt += `Clear hierarchy, readable text, professional data visualization. `;
  prompt += `Include brand motifs: ${visual.visualStyle.motifs?.join(', ') || 'geometric patterns'}. `;
  
  return prompt;
}

function generatePromoVideoPrompt(profile: BrandProfile, duration: number = 30): string {
  const visual = profile.visual;
  const textual = profile.textual;
  const cine = visual.cinematicGuidelines;
  
  let prompt = `Create a ${duration}-second promotional video for ${textual.brandName.primary}. `;
  prompt += `Brand message: ${textual.tagline.primary}. `;
  prompt += `Visual style: ${cine.motionStyle}. `;
  prompt += `Color scheme: ${buildColorString(visual)}. `;
  prompt += `Pacing: ${cine.pacing}. `;
  if (cine.colorGrading) prompt += `Color grading: ${cine.colorGrading}. `;
  prompt += `Resolution: ${cine.resolution}, ${cine.aspectRatio} aspect ratio. `;
  prompt += `Brand aesthetic: ${visual.visualStyle.aesthetic.join(', ')}. `;
  prompt += `Feature brand motifs: ${visual.visualStyle.motifs?.join(', ') || 'shield, security elements'}. `;
  prompt += `Cinematic quality, professional motion graphics.`;
  
  return prompt;
}

function generateSocialPostPrompt(profile: BrandProfile, platform: string): string {
  const visual = profile.visual;
  const textual = profile.textual;
  
  const platformSpecs: Record<string, { dimensions: string; style: string }> = {
    linkedin: { dimensions: '1200x627', style: 'corporate, professional, business-focused' },
    twitter: { dimensions: '1600x900', style: 'bold, attention-grabbing, simple' },
    instagram: { dimensions: '1080x1080', style: 'vibrant, visually striking, trendy' },
    facebook: { dimensions: '1200x630', style: 'engaging, community-focused' },
  };
  
  const spec = platformSpecs[platform] || platformSpecs.twitter;
  
  let prompt = `Create a ${platform} social media graphic (${spec.dimensions}) for ${textual.brandName.primary}. `;
  prompt += `Platform style: ${spec.style}. `;
  prompt += buildColorString(visual);
  prompt += `. Brand aesthetic: ${visual.visualStyle.aesthetic.join(', ')}. `;
  prompt += `Theme: ${textual.keywords.slice(0, 3).join(', ')}. `;
  prompt += `Professional, scroll-stopping, brand-aligned.`;
  
  return prompt;
}

function generateLogoVariantPrompt(profile: BrandProfile, variant: string): string {
  const visual = profile.visual;
  const textual = profile.textual;
  
  let prompt = `Create a ${variant} version of the ${textual.brandName.primary} logo. `;
  
  switch (variant) {
    case 'monochrome':
      prompt += `Convert to single-color (white on transparent). `;
      prompt += `Maintain brand recognition, clean silhouette. `;
      break;
    case 'inverted':
      prompt += `Invert colors for light backgrounds. `;
      prompt += `Dark logo version maintaining brand identity. `;
      break;
    case 'simplified':
      prompt += `Create a simplified icon version. `;
      prompt += `Minimal, recognizable, works at small sizes. `;
      break;
  }
  
  prompt += `Brand style: ${visual.visualStyle.aesthetic.join(', ')}. `;
  prompt += `Vector quality, scalable, professional.`;
  
  return prompt;
}

// ============================================
// MAIN PROMPT GENERATOR
// ============================================

export function generatePrompt(context: PromptContext): GeneratedPrompt {
  const { brandProfile, assetType, options } = context;
  
  let mainPrompt: string;
  let systemPrompt: string | undefined;
  
  // Generate asset-specific prompt
  switch (assetType) {
    case 'mood_board':
      mainPrompt = generateMoodBoardPrompt(brandProfile);
      break;
    case 'icon_set':
      const iconNames = options?.iconNames || ['lock', 'shield', 'flame', 'arrow', 'chain', 'wallet', 'chart', 'secure', 'yield', 'bridge'];
      mainPrompt = `Generate a set of ${iconNames.length} brand icons: ${iconNames.join(', ')}. ` + generateIconPrompt(brandProfile, iconNames[0]);
      break;
    case 'icon_individual':
      mainPrompt = generateIconPrompt(brandProfile, options?.iconNames?.[0] || 'default');
      break;
    case 'infographic':
      mainPrompt = generateInfographicPrompt(brandProfile, options?.infographicData);
      break;
    case 'promo_video':
      mainPrompt = generatePromoVideoPrompt(brandProfile, options?.videoDuration || 30);
      break;
    case 'social_post':
      mainPrompt = generateSocialPostPrompt(brandProfile, options?.platform || 'linkedin');
      break;
    case 'logo_variant':
      mainPrompt = generateLogoVariantPrompt(brandProfile, options?.variantType || 'monochrome');
      break;
    case 'blog_hero':
      mainPrompt = `Create a blog header image for ${brandProfile.textual.brandName.primary}. ${buildColorString(brandProfile.visual)}. Professional editorial style, ${brandProfile.visual.visualStyle.aesthetic.join(', ')}.`;
      break;
    case 'ad_creative':
      mainPrompt = `Create an advertisement creative for ${brandProfile.textual.brandName.primary}. ${buildColorString(brandProfile.visual)}. Conversion-focused, attention-grabbing, clear CTA area.`;
      break;
    default:
      mainPrompt = `Create brand content for ${brandProfile.textual.brandName.primary}. ${buildColorString(brandProfile.visual)}.`;
  }
  
  // Add custom prompt additions if provided
  if (options?.customPromptAdditions) {
    mainPrompt += ` ${options.customPromptAdditions}`;
  }
  
  // Build components
  const styleModifiers = buildStyleModifiers(brandProfile, assetType);
  const negativePrompt = buildNegativePrompt(brandProfile, assetType);
  const colorHints = buildColorHints(brandProfile.visual);
  
  // Text generation gets a system prompt
  if (['social_post', 'blog_hero', 'ad_creative'].includes(assetType)) {
    systemPrompt = buildTextSystemPrompt(brandProfile);
  }
  
  return {
    mainPrompt,
    negativePrompt,
    systemPrompt,
    styleModifiers,
    colorHints,
    metadata: {
      assetType,
      promptVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
    },
  };
}

// ============================================
// HELPER: Format prompt for specific providers
// ============================================

export function formatPromptForProvider(
  prompt: GeneratedPrompt, 
  provider: 'gemini' | 'fal' | 'dalle' | 'midjourney' | 'runway' | 'anthropic' | 'openrouter'
): string {
  const { mainPrompt, styleModifiers, negativePrompt } = prompt;
  
  switch (provider) {
    case 'midjourney':
      // Midjourney style with parameters
      let mjPrompt = mainPrompt;
      mjPrompt += ` --style ${styleModifiers.slice(0, 5).join(' ')}`;
      if (negativePrompt) mjPrompt += ` --no ${negativePrompt.split(', ').slice(0, 5).join(' ')}`;
      return mjPrompt;
      
    case 'dalle':
    case 'gemini':
    case 'fal':
      // Standard format with style additions
      return `${mainPrompt} Style: ${styleModifiers.join(', ')}. High quality, professional.`;
      
    case 'runway':
      // Video-focused prompt
      return `${mainPrompt} Cinematic quality, smooth motion, professional grade.`;
      
    case 'anthropic':
    case 'openrouter':
      // Text generation - return as-is with system prompt context
      return mainPrompt;
      
    default:
      return mainPrompt;
  }
}

// ============================================
// HELPER: Build script for video generation
// ============================================

export function generateVideoScript(profile: BrandProfile, duration: number = 30): {
  scenes: Array<{ sceneNumber: number; duration: number; visualPrompt: string; voiceoverText: string }>;
  totalDuration: number;
} {
  const textual = profile.textual;
  const visual = profile.visual;
  const sceneDuration = 5;
  const sceneCount = Math.ceil(duration / sceneDuration);
  
  const scenes: Array<{ sceneNumber: number; duration: number; visualPrompt: string; voiceoverText: string }> = [];
  
  // Scene 1: Brand intro with logo
  scenes.push({
    sceneNumber: 1,
    duration: sceneDuration,
    visualPrompt: `${textual.brandName.primary} logo reveal animation, ${buildColorString(visual)}, ${visual.cinematicGuidelines.motionStyle}, dramatic entrance, ${visual.visualStyle.aesthetic.join(', ')}`,
    voiceoverText: `${textual.brandName.primary}. ${textual.tagline.primary}`,
  });
  
  // Scene 2: Problem/opportunity
  if (sceneCount >= 2) {
    scenes.push({
      sceneNumber: 2,
      duration: sceneDuration,
      visualPrompt: `Abstract visualization of ${textual.targetAudience.painPoints?.[0] || 'challenge'}, ${buildColorString(visual)}, ${visual.visualStyle.aesthetic.join(', ')}, dynamic motion`,
      voiceoverText: textual.brandStory.short.split('.')[0] + '.',
    });
  }
  
  // Scene 3: Solution showcase
  if (sceneCount >= 3) {
    const values = textual.values.slice(0, 2).map(v => v.name).join(' and ');
    scenes.push({
      sceneNumber: 3,
      duration: sceneDuration,
      visualPrompt: `Product/service visualization showing ${values}, ${visual.visualStyle.motifs?.join(', ') || 'tech elements'}, ${buildColorString(visual)}, futuristic UI elements`,
      voiceoverText: `With ${values}, we deliver ${textual.keywords[0]} like never before.`,
    });
  }
  
  // Scene 4: Features/benefits
  if (sceneCount >= 4) {
    scenes.push({
      sceneNumber: 4,
      duration: sceneDuration,
      visualPrompt: `Feature showcase animation, ${textual.keywords.slice(0, 3).join(', ')} visualization, ${buildColorString(visual)}, ${visual.visualStyle.aesthetic.join(', ')}, flowing data graphics`,
      voiceoverText: `Experience ${textual.keywords.slice(0, 3).join(', ')}.`,
    });
  }
  
  // Scene 5: Call to action
  if (sceneCount >= 5) {
    scenes.push({
      sceneNumber: 5,
      duration: sceneDuration,
      visualPrompt: `Call to action screen, ${textual.brandName.primary} logo, ${buildColorString(visual)}, ${visual.visualStyle.aesthetic.join(', ')}, clean typography, inspiring finale`,
      voiceoverText: textual.callToActions?.[0] || textual.examplePhrases[0] || `Join ${textual.brandName.primary} today.`,
    });
  }
  
  // Scene 6: Closing
  if (sceneCount >= 6) {
    scenes.push({
      sceneNumber: 6,
      duration: sceneDuration,
      visualPrompt: `Brand logo outro with tagline, ${buildColorString(visual)}, elegant fade, ${visual.visualStyle.aesthetic.join(', ')}, professional closing`,
      voiceoverText: textual.tagline.primary,
    });
  }
  
  return {
    scenes,
    totalDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
  };
}

export default {
  generatePrompt,
  formatPromptForProvider,
  generateVideoScript,
};
