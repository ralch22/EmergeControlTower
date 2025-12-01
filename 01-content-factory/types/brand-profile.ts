import { z } from "zod";

// ============================================
// BRAND PROFILE JSON SCHEMA
// Comprehensive brand identity structure for AI content generation
// ============================================

// Color definition with usage context
export const ColorSchema = z.object({
  name: z.string(),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  rgb: z.object({
    r: z.number().min(0).max(255),
    g: z.number().min(0).max(255),
    b: z.number().min(0).max(255),
  }).optional(),
  hsl: z.object({
    h: z.number().min(0).max(360),
    s: z.number().min(0).max(100),
    l: z.number().min(0).max(100),
  }).optional(),
  usage: z.enum(["primary", "accent", "secondary", "background", "text", "border", "success", "warning", "error"]),
  description: z.string().optional(),
});

// Font definition
export const FontSchema = z.object({
  family: z.string(),
  category: z.enum(["primary", "secondary", "accent", "monospace"]),
  weights: z.array(z.number()),
  usage: z.string(),
  googleFontsUrl: z.string().optional(),
  fallback: z.string().optional(),
});

// Theme mode colors
export const ThemeModeSchema = z.object({
  background: ColorSchema,
  backgroundSecondary: ColorSchema.optional(),
  cardBackground: ColorSchema.optional(),
  textPrimary: ColorSchema,
  textSecondary: ColorSchema.optional(),
  textMuted: ColorSchema.optional(),
  border: ColorSchema.optional(),
  accent: ColorSchema,
  accentHover: ColorSchema.optional(),
  success: ColorSchema.optional(),
  warning: ColorSchema.optional(),
  error: ColorSchema.optional(),
});

// Visual style guidelines
export const VisualStyleSchema = z.object({
  description: z.string(),
  aesthetic: z.array(z.string()), // e.g., ["futuristic", "tech", "dark", "high-contrast"]
  moodKeywords: z.array(z.string()), // e.g., ["secure", "innovative", "trustworthy"]
  photographyStyle: z.string().optional(),
  illustrationStyle: z.string().optional(),
  patterns: z.array(z.string()).optional(), // e.g., ["hexagonal", "grid", "flowing lines"]
  motifs: z.array(z.string()).optional(), // e.g., ["shields", "locks", "arrows"]
});

// Iconography rules
export const IconographySchema = z.object({
  style: z.enum(["outline", "solid", "duotone", "gradient"]),
  strokeWidth: z.number().optional(),
  cornerStyle: z.enum(["rounded", "sharp", "mixed"]).optional(),
  shape: z.string().optional(), // e.g., "hexagonal borders"
  colorApproach: z.string(),
  sizeBase: z.number().default(48),
  library: z.string().optional(), // e.g., "Heroicons", "Lucide"
});

// Cinematic/video guidelines
export const CinematicGuidelinesSchema = z.object({
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3"]).default("16:9"),
  resolution: z.enum(["720p", "1080p", "4k"]).default("1080p"),
  duration: z.object({
    short: z.number().default(15),
    medium: z.number().default(30),
    long: z.number().default(60),
  }),
  pacing: z.enum(["slow", "moderate", "fast"]).default("moderate"),
  motionStyle: z.string(), // e.g., "slow-motion staking animations, dramatic lighting"
  transitionStyle: z.string().optional(),
  soundtrackStyle: z.string().optional(), // e.g., "orchestral/tech"
  colorGrading: z.string().optional(),
  textOverlays: z.object({
    font: z.string().optional(),
    position: z.string().optional(),
    animation: z.string().optional(),
  }).optional(),
});

// Accessibility guidelines
export const AccessibilitySchema = z.object({
  standard: z.enum(["WCAG 2.0 AA", "WCAG 2.1 AA", "WCAG 2.1 AAA"]).default("WCAG 2.1 AA"),
  minContrastRatio: z.number().default(4.5),
  altTextRequired: z.boolean().default(true),
  noFlashing: z.boolean().default(true),
  focusIndicators: z.boolean().default(true),
  notes: z.string().optional(),
});

// Voice/personality traits
export const PersonalitySchema = z.object({
  archetype: z.string(), // e.g., "Professional, reliable guardian"
  traits: z.array(z.string()), // e.g., ["trustworthy", "forward-thinking", "innovative"]
  avoidTraits: z.array(z.string()).optional(), // e.g., ["aggressive", "hypey"]
});

// Tone settings with sliders for generation tuning
export const ToneSchema = z.object({
  description: z.string(), // e.g., "Energetic yet reassuring"
  formality: z.number().min(0).max(100).default(70), // 0=casual, 100=formal
  energy: z.number().min(0).max(100).default(60), // 0=calm, 100=energetic
  technicality: z.number().min(0).max(100).default(50), // 0=simple, 100=technical
  warmth: z.number().min(0).max(100).default(60), // 0=neutral, 100=warm
});

// ============================================
// TEXTUAL COMPONENTS
// ============================================
export const TextualComponentsSchema = z.object({
  brandName: z.object({
    primary: z.string(),
    token: z.string().optional(), // e.g., "$SHIELD"
    abbreviation: z.string().optional(),
    usageNotes: z.string().optional(),
  }),
  tagline: z.object({
    primary: z.string(),
    alternatives: z.array(z.string()).optional(),
    maxWords: z.number().default(10),
  }),
  brandStory: z.object({
    short: z.string(), // 50-100 words
    medium: z.string().optional(), // 150-200 words
    full: z.string().optional(), // 300+ words
  }),
  mission: z.string().optional(),
  vision: z.string().optional(),
  values: z.array(z.object({
    name: z.string(),
    description: z.string(),
  })),
  personality: PersonalitySchema,
  tone: ToneSchema,
  forbiddenWords: z.array(z.string()),
  keywords: z.array(z.string()),
  contentGoals: z.array(z.string()),
  pastSuccesses: z.array(z.string()).optional(),
  examplePhrases: z.array(z.string()),
  callToActions: z.array(z.string()).optional(),
  targetAudience: z.object({
    demographics: z.string(),
    psychographics: z.string().optional(),
    painPoints: z.array(z.string()).optional(),
    goals: z.array(z.string()).optional(),
  }),
});

// ============================================
// VISUAL COMPONENTS  
// ============================================
export const VisualComponentsSchema = z.object({
  visualStyle: VisualStyleSchema,
  colorPalette: z.object({
    darkMode: ThemeModeSchema,
    lightMode: ThemeModeSchema.optional(),
    additionalColors: z.array(ColorSchema).optional(),
  }),
  typography: z.object({
    fonts: z.array(FontSchema),
    scale: z.object({
      hero: z.string().optional(),
      heading1: z.string().optional(),
      heading2: z.string().optional(),
      body: z.string().optional(),
      small: z.string().optional(),
    }).optional(),
  }),
  iconography: IconographySchema,
  cinematicGuidelines: CinematicGuidelinesSchema,
  accessibility: AccessibilitySchema,
  usageRules: z.object({
    dos: z.array(z.string()),
    donts: z.array(z.string()),
  }),
  layoutPatterns: z.object({
    spacing: z.string().optional(),
    gridSystem: z.string().optional(),
    containerWidth: z.string().optional(),
  }).optional(),
});

// ============================================
// REFERENCE ASSETS
// ============================================
export const ReferenceAssetSchema = z.object({
  id: z.string(),
  type: z.enum(["logo", "icon", "mood_board", "infographic", "video", "image", "document"]),
  variant: z.string().optional(), // e.g., "full_color", "monochrome", "inverted"
  url: z.string(),
  localPath: z.string().optional(),
  mimeType: z.string().optional(),
  dimensions: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
  description: z.string().optional(),
  isPrimary: z.boolean().default(false),
  tags: z.array(z.string()).optional(),
});

export const ReferenceAssetsSchema = z.object({
  logos: z.array(ReferenceAssetSchema).optional(),
  icons: z.array(ReferenceAssetSchema).optional(),
  moodBoards: z.array(ReferenceAssetSchema).optional(),
  infographics: z.array(ReferenceAssetSchema).optional(),
  videos: z.array(ReferenceAssetSchema).optional(),
  other: z.array(ReferenceAssetSchema).optional(),
});

// ============================================
// COMPLETE BRAND PROFILE
// ============================================
export const BrandProfileSchema = z.object({
  version: z.string().default("1.0.0"),
  lastUpdated: z.string().datetime().optional(),
  clientId: z.number(),
  textual: TextualComponentsSchema,
  visual: VisualComponentsSchema,
  referenceAssets: ReferenceAssetsSchema.optional(),
  metadata: z.object({
    createdBy: z.string().optional(),
    approvedBy: z.string().optional(),
    approvedAt: z.string().datetime().optional(),
    notes: z.string().optional(),
  }).optional(),
});

// ============================================
// TYPES
// ============================================
export type Color = z.infer<typeof ColorSchema>;
export type Font = z.infer<typeof FontSchema>;
export type ThemeMode = z.infer<typeof ThemeModeSchema>;
export type VisualStyle = z.infer<typeof VisualStyleSchema>;
export type Iconography = z.infer<typeof IconographySchema>;
export type CinematicGuidelines = z.infer<typeof CinematicGuidelinesSchema>;
export type Accessibility = z.infer<typeof AccessibilitySchema>;
export type Personality = z.infer<typeof PersonalitySchema>;
export type Tone = z.infer<typeof ToneSchema>;
export type TextualComponents = z.infer<typeof TextualComponentsSchema>;
export type VisualComponents = z.infer<typeof VisualComponentsSchema>;
export type ReferenceAsset = z.infer<typeof ReferenceAssetSchema>;
export type ReferenceAssets = z.infer<typeof ReferenceAssetsSchema>;
export type BrandProfile = z.infer<typeof BrandProfileSchema>;

// ============================================
// ASSET GENERATION REQUEST TYPES
// ============================================
export type AssetType = 
  | "mood_board" 
  | "icon_set" 
  | "icon_individual" 
  | "infographic" 
  | "logo_variant" 
  | "promo_video" 
  | "social_post" 
  | "blog_hero" 
  | "ad_creative"
  | "color_palette_image"
  | "brand_guidelines_pdf";

export interface AssetGenerationRequest {
  clientId: number;
  assetType: AssetType;
  options?: {
    style?: string;
    dimensions?: { width: number; height: number };
    format?: "png" | "svg" | "jpg" | "mp4" | "pdf";
    quantity?: number;
    iconNames?: string[]; // for icon_set
    infographicData?: Record<string, unknown>; // for infographics
    videoDuration?: number; // for promo_video
    variantType?: "monochrome" | "inverted" | "simplified"; // for logo_variant
    platform?: "linkedin" | "twitter" | "instagram" | "facebook"; // for social
    customPromptAdditions?: string;
  };
}

export interface AssetGenerationResult {
  success: boolean;
  assetType: AssetType;
  assets: Array<{
    id: string;
    url?: string;
    localPath?: string;
    base64?: string;
    mimeType: string;
    dimensions?: { width: number; height: number };
    metadata?: Record<string, unknown>;
  }>;
  provider?: string;
  error?: string;
  processingTime?: number;
}
