export interface BrandVoiceConfig {
  tone: string;
  forbiddenWords?: string[];
  targetAudience: string;
  keywords?: string[];
  contentGoals?: string[];
  pastWinners?: string[];
  examples?: string[];
  
  // Visual and cinematic brand guidelines
  visualStyle?: string;
  colorPalette?: string[];
  fonts?: string[];
  referenceAssets?: Record<string, string>;
  cinematicGuidelines?: string;
}

export interface ClientBrief {
  clientId: string;
  clientName: string;
  industry: string;
  brandVoice: string;
  targetAudience: string;
  keywords: string[];
  contentGoals: string[];
  
  // Extended brand assets
  brandVoiceConfig?: BrandVoiceConfig;
}

export type { 
  EnrichedClientBrief,
  TextualBrandBrief,
  VisualBrandBrief,
  ReferenceAsset,
} from "../services/brand-brief";

export { 
  composeBrandBrief,
  formatTextualBriefForPrompt,
  formatVisualBriefForPrompt,
  formatFullBriefForPrompt,
  buildSystemPromptSuffix,
  buildImagePromptEnrichment,
  buildReferenceConstrainedImagePrompt,
  buildVideoSceneEnrichment,
  buildReferenceConstrainedVideoPrompt,
  buildQAValidationCriteria,
  getEffectiveCTA,
  getReferenceAssetUrl,
  hasReferenceAsset,
} from "../services/brand-brief";

export interface ContentTopic {
  id: string;
  title: string;
  angle: string;
  keywords: string[];
  contentTypes: ContentType[];
  priority: 'high' | 'medium' | 'low';
}

export type ContentType = 'blog' | 'linkedin' | 'twitter' | 'instagram' | 'facebook_ad' | 'google_ad' | 'video_script';

export interface GeneratedContent {
  id: string;
  topicId: string;
  clientId: string;
  type: ContentType;
  title: string;
  content: string;
  metadata: ContentMetadata;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'published';
  createdAt: Date;
}

export interface ContentMetadata {
  wordCount?: number;
  characterCount?: number;
  hashtags?: string[];
  callToAction?: string;
  mediaUrls?: string[];
  voiceoverUrl?: string;
  videoUrl?: string;
  videoTaskId?: string;
  imageDataUrl?: string;
  sceneThumbnails?: Record<number, string>;
}

export interface ContentRunConfig {
  clientId: string;
  clientBrief: ClientBrief;
  topicCount: number;
  contentTypes: ContentType[];
  runType: 'single' | 'daily' | 'weekly';
}

export interface ContentRunResult {
  runId: string;
  clientId: string;
  startedAt: Date;
  completedAt?: Date;
  totalPieces: number;
  successfulPieces: number;
  failedPieces: number;
  contents: GeneratedContent[];
}

export interface AgentResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  tokenUsage?: number;
}

export interface QAResult {
  passed: boolean;
  score: number;
  issues: string[];
  suggestions: string[];
  brandComplianceNotes?: {
    forbiddenWordsFound?: string[];
    ctaAligned?: boolean;
    keywordsUsed?: string[];
    voiceMatch?: 'strong' | 'moderate' | 'weak';
    toneMatch?: 'strong' | 'moderate' | 'weak';
  };
}
