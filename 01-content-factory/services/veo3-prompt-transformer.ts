/**
 * Veo 3 Prompt Transformer
 * 
 * Converts standalone scene descriptions into continuation-aware extension prompts
 * optimized for Veo 3.1's scene extension feature. Ensures visual consistency
 * by using sequential narrative flow with proper transitions.
 */

import type { EnrichedClientBrief, VisualBrandBrief } from './brand-brief';
import type { ParsedScene } from '../utils/scene-parser';

export interface Veo3Scene {
  sceneNumber: number;
  prompt: string;
  resetRequired: boolean;
  transitionType: TransitionType;
  narrativeContext: string;
  brandElements: string[];
}

export type TransitionType = 
  | 'establishing'  // First scene - establishes visual style
  | 'continue'      // Smooth continuation
  | 'pan'           // Camera pan to new subject
  | 'zoom_in'       // Zoom into detail
  | 'zoom_out'      // Zoom out to reveal
  | 'cut'           // Hard cut (requires reset)
  | 'dissolve'      // Dissolve transition
  | 'time_lapse'    // Time progression
  | 'reveal';       // Dramatic reveal

export interface TransformConfig {
  brandBrief?: EnrichedClientBrief;
  cinematicStyle?: 'documentary' | 'commercial' | 'narrative' | 'dynamic';
  maintainSubject?: boolean;
  colorGrading?: string;
  motionStyle?: 'smooth' | 'dynamic' | 'slow_motion' | 'timelapse';
}

// Transition phrases for different types
const TRANSITION_PHRASES: Record<TransitionType, string[]> = {
  establishing: [
    'Opening on',
    'We begin with',
    'The scene opens on',
    'Starting with a wide view of',
  ],
  continue: [
    'Continuing the motion,',
    'The scene progresses as',
    'Maintaining the same perspective,',
    'The action continues with',
  ],
  pan: [
    'The camera smoothly pans to reveal',
    'Panning across to show',
    'The view shifts to capture',
    'Moving horizontally to reveal',
  ],
  zoom_in: [
    'Slowly zooming in on',
    'The focus narrows to',
    'Moving closer to reveal',
    'Drawing attention to',
  ],
  zoom_out: [
    'Pulling back to reveal',
    'The perspective widens to show',
    'Zooming out to capture',
    'Expanding the view to include',
  ],
  cut: [
    'Cutting to',
    'Transitioning to',
    'Moving to',
    'Now showing',
  ],
  dissolve: [
    'Dissolving into',
    'Fading to reveal',
    'The scene transforms into',
    'Blending into',
  ],
  time_lapse: [
    'Time passes as we see',
    'Accelerating through',
    'As time progresses,',
    'Fast-forwarding to show',
  ],
  reveal: [
    'Dramatically revealing',
    'Unveiling',
    'The scene reveals',
    'Coming into focus:',
  ],
};

// Camera movement keywords to detect in scene descriptions
const CAMERA_KEYWORDS = {
  pan: ['pan', 'sweep', 'across', 'horizontal'],
  zoom_in: ['close-up', 'detail', 'focus on', 'zoom in', 'closer'],
  zoom_out: ['wide shot', 'pull back', 'reveal', 'zoom out', 'wide view'],
  time_lapse: ['time lapse', 'timelapse', 'fast forward', 'time passes'],
};

/**
 * Detects the likely transition type based on scene content
 */
function detectTransitionType(
  scene: ParsedScene,
  previousScene: ParsedScene | null,
  isFirst: boolean
): TransitionType {
  if (isFirst) return 'establishing';
  
  const prompt = scene.visualPrompt.toLowerCase();
  const title = (scene.title || '').toLowerCase();
  
  // Check for explicit camera keywords
  for (const [type, keywords] of Object.entries(CAMERA_KEYWORDS)) {
    if (keywords.some(kw => prompt.includes(kw) || title.includes(kw))) {
      return type as TransitionType;
    }
  }
  
  // CTA scenes often need a cut
  if (title.includes('call to action') || title.includes('cta')) {
    return 'reveal';
  }
  
  // Check for scene changes that suggest a cut
  if (previousScene) {
    const prevPrompt = previousScene.visualPrompt.toLowerCase();
    const hasLocationChange = 
      (prompt.includes('office') && prevPrompt.includes('outdoor')) ||
      (prompt.includes('indoor') && prevPrompt.includes('outdoor')) ||
      (prompt.includes('night') && prevPrompt.includes('day'));
    
    if (hasLocationChange) return 'dissolve';
  }
  
  // Default to continue for smooth transitions
  return 'continue';
}

/**
 * Extracts brand-relevant visual elements to embed in prompts
 */
function extractBrandElements(brandBrief?: EnrichedClientBrief): string[] {
  if (!brandBrief?.visual) return [];
  
  const elements: string[] = [];
  const v = brandBrief.visual;
  
  // Add color grading from brand
  if (v.cinematicColorGrading) {
    elements.push(`${v.cinematicColorGrading} color grading`);
  }
  
  // Add visual style
  if (v.visualStyle) {
    elements.push(v.visualStyle);
  }
  
  // Add mood keywords (limit to avoid prompt bloat)
  if (v.moodKeywords?.length > 0) {
    elements.push(v.moodKeywords.slice(0, 3).join(', ') + ' mood');
  }
  
  // Add motion style
  if (v.cinematicMotionStyle) {
    elements.push(`${v.cinematicMotionStyle} camera movement`);
  }
  
  return elements;
}

/**
 * Builds the establishing shot prompt for the first scene
 */
function buildEstablishingPrompt(
  scene: ParsedScene,
  brandBrief?: EnrichedClientBrief,
  config?: TransformConfig
): string {
  const parts: string[] = [];
  
  // Opening phrase
  parts.push(pickRandom(TRANSITION_PHRASES.establishing));
  
  // Core visual description
  parts.push(scene.visualPrompt);
  
  // Brand style embedding
  const brandElements = extractBrandElements(brandBrief);
  if (brandElements.length > 0) {
    parts.push(`Style: ${brandElements.join(', ')}.`);
  }
  
  // Cinematic style
  if (config?.cinematicStyle) {
    const styleDescriptions: Record<string, string> = {
      documentary: 'Shot in documentary style with natural lighting and authentic framing',
      commercial: 'Polished commercial quality with perfect lighting and product focus',
      narrative: 'Cinematic narrative style with dramatic composition and depth',
      dynamic: 'Dynamic and energetic with bold movements and modern aesthetics',
    };
    parts.push(styleDescriptions[config.cinematicStyle] || '');
  }
  
  // Color grading
  if (config?.colorGrading) {
    parts.push(`Color grading: ${config.colorGrading}.`);
  } else if (brandBrief?.visual.cinematicColorGrading) {
    parts.push(`Color grading: ${brandBrief.visual.cinematicColorGrading}.`);
  }
  
  return parts.filter(Boolean).join('. ');
}

/**
 * Builds a continuation prompt that extends from the previous scene
 */
function buildExtensionPrompt(
  scene: ParsedScene,
  previousScene: ParsedScene,
  transitionType: TransitionType,
  brandBrief?: EnrichedClientBrief
): string {
  const parts: string[] = [];
  
  // Transition phrase
  parts.push(pickRandom(TRANSITION_PHRASES[transitionType]));
  
  // What changes in this scene (delta from previous)
  const deltaDescription = extractSceneDelta(scene, previousScene);
  parts.push(deltaDescription);
  
  // Maintain brand consistency cues (lighter than establishing)
  if (brandBrief?.visual.moodKeywords?.length) {
    const mood = brandBrief.visual.moodKeywords[0];
    parts.push(`Maintaining ${mood} atmosphere`);
  }
  
  return parts.filter(Boolean).join('. ') + '.';
}

/**
 * Extracts what changes between scenes (delta description)
 */
function extractSceneDelta(scene: ParsedScene, previousScene: ParsedScene): string {
  const current = scene.visualPrompt;
  const previous = previousScene.visualPrompt;
  
  // Simple extraction - in a more sophisticated version, this could use NLP
  // to identify the key differences between scenes
  
  // If the prompts are very different, use the new one directly
  if (!hasCommonElements(current, previous)) {
    return current;
  }
  
  // Otherwise, try to describe what's new
  const currentWords = new Set(current.toLowerCase().split(/\s+/));
  const previousWords = new Set(previous.toLowerCase().split(/\s+/));
  
  // Find unique words in current scene
  const newElements: string[] = [];
  currentWords.forEach(word => {
    if (!previousWords.has(word) && word.length > 3) {
      newElements.push(word);
    }
  });
  
  if (newElements.length > 2) {
    // Use the original description but frame it as continuation
    return current;
  }
  
  return current;
}

/**
 * Checks if two prompts share common visual elements
 */
function hasCommonElements(a: string, b: string): boolean {
  const aWords = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 4));
  const bWords = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 4));
  
  let commonCount = 0;
  aWords.forEach(word => {
    if (bWords.has(word)) commonCount++;
  });
  
  return commonCount >= 2;
}

/**
 * Picks a random element from an array
 */
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Main transformer function - converts parsed scenes to Veo 3 extension prompts
 */
export function transformToVeo3Prompts(
  scenes: ParsedScene[],
  config?: TransformConfig
): Veo3Scene[] {
  if (!scenes.length) return [];
  
  const brandBrief = config?.brandBrief;
  const result: Veo3Scene[] = [];
  
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const previousScene = i > 0 ? scenes[i - 1] : null;
    const isFirst = i === 0;
    
    const transitionType = detectTransitionType(scene, previousScene, isFirst);
    const requiresReset = transitionType === 'cut' || isFirst;
    
    let prompt: string;
    if (isFirst) {
      prompt = buildEstablishingPrompt(scene, brandBrief, config);
    } else {
      prompt = buildExtensionPrompt(scene, previousScene!, transitionType, brandBrief);
    }
    
    // Extract narrative context from voiceover
    const narrativeContext = scene.voiceoverText
      ? `Voiceover context: "${scene.voiceoverText.substring(0, 100)}..."`
      : '';
    
    result.push({
      sceneNumber: scene.sceneNumber,
      prompt,
      resetRequired: requiresReset,
      transitionType,
      narrativeContext,
      brandElements: extractBrandElements(brandBrief),
    });
  }
  
  return result;
}

/**
 * Transforms a single scene for quick single-scene generation
 */
export function transformSingleScene(
  visualDescription: string,
  brandBrief?: EnrichedClientBrief,
  config?: TransformConfig
): string {
  const mockScene: ParsedScene = {
    sceneNumber: 1,
    visualPrompt: visualDescription,
    voiceoverText: '',
    duration: 8,
    startTime: 0,
  };
  
  return buildEstablishingPrompt(mockScene, brandBrief, config);
}

/**
 * Builds brand-consistent continuation hints for the AI to maintain
 */
export function buildBrandContinuityHints(brandBrief: EnrichedClientBrief): string[] {
  const hints: string[] = [];
  const v = brandBrief.visual;
  
  if (v.primaryColor) {
    hints.push(`Maintain ${v.primaryColor.name} (${v.primaryColor.hex}) as accent color`);
  }
  
  if (v.cinematicMotionStyle) {
    hints.push(`Keep ${v.cinematicMotionStyle} camera movement throughout`);
  }
  
  if (v.visualStyle) {
    hints.push(`Consistent ${v.visualStyle} visual style`);
  }
  
  if (brandBrief.textual?.archetype) {
    hints.push(`Reflect ${brandBrief.textual.archetype} brand archetype`);
  }
  
  return hints;
}

/**
 * Creates a style anchor prompt for the first scene based on brand
 */
export function createBrandStyleAnchor(brandBrief: EnrichedClientBrief): string {
  const v = brandBrief.visual;
  const t = brandBrief.textual;
  
  const parts: string[] = [
    `Brand: ${t.brandName}`,
    `Visual Style: ${v.visualStyle}`,
    `Mood: ${v.moodKeywords.join(', ')}`,
    `Color Palette: ${v.primaryColor?.name || 'brand colors'}, ${v.backgroundColor?.name || 'dark background'}`,
    `Motion: ${v.cinematicMotionStyle || 'smooth'}`,
    `Pacing: ${v.cinematicPacing || 'moderate'}`,
  ];
  
  if (v.cinematicColorGrading) {
    parts.push(`Color Grading: ${v.cinematicColorGrading}`);
  }
  
  return parts.join('. ') + '.';
}

export default {
  transformToVeo3Prompts,
  transformSingleScene,
  buildBrandContinuityHints,
  createBrandStyleAnchor,
  detectTransitionType,
};
