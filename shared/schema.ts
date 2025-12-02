import { pgTable, text, serial, integer, timestamp, boolean, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// KPI Metrics
export const kpis = pgTable("kpis", {
  id: serial("id").primaryKey(),
  mrr: decimal("mrr", { precision: 12, scale: 2 }).notNull(),
  mrrChange: decimal("mrr_change", { precision: 5, scale: 2 }).notNull(),
  profitToday: decimal("profit_today", { precision: 12, scale: 2 }).notNull(),
  aiOutputToday: integer("ai_output_today").notNull(),
  activePods: integer("active_pods").notNull(),
  totalPods: integer("total_pods").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertKpiSchema = createInsertSchema(kpis).omit({ id: true, updatedAt: true });
export type InsertKpi = z.infer<typeof insertKpiSchema>;
export type Kpi = typeof kpis.$inferSelect;

// Pods
export const pods = pgTable("pods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  vertical: text("vertical").notNull(),
  mrr: decimal("mrr", { precision: 12, scale: 2 }).notNull(),
  health: integer("health").notNull(),
  margin: integer("margin").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPodSchema = createInsertSchema(pods).omit({ id: true, createdAt: true });
export type InsertPod = z.infer<typeof insertPodSchema>;
export type Pod = typeof pods.$inferSelect;

// Phase Changes
export const phaseChanges = pgTable("phase_changes", {
  id: serial("id").primaryKey(),
  client: text("client").notNull(),
  oldPrice: decimal("old_price", { precision: 12, scale: 2 }).notNull(),
  newPrice: decimal("new_price", { precision: 12, scale: 2 }).notNull(),
  changeDate: timestamp("change_date").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPhaseChangeSchema = createInsertSchema(phaseChanges).omit({ id: true, createdAt: true });
export type InsertPhaseChange = z.infer<typeof insertPhaseChangeSchema>;
export type PhaseChange = typeof phaseChanges.$inferSelect;

// Approval Queue
export const approvalQueue = pgTable("approval_queue", {
  id: serial("id").primaryKey(),
  client: text("client").notNull(),
  type: text("type").notNull(),
  author: text("author").notNull(),
  thumbnail: text("thumbnail").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const insertApprovalQueueSchema = createInsertSchema(approvalQueue).omit({ id: true, createdAt: true, processedAt: true });
export type InsertApprovalQueue = z.infer<typeof insertApprovalQueueSchema>;
export type ApprovalQueue = typeof approvalQueue.$inferSelect;

// Alerts
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull().default("critical"),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// Content Factory - Clients with Full Brand Profile
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  brandVoice: text("brand_voice").notNull(),
  targetAudience: text("target_audience").notNull(),
  keywords: text("keywords").notNull(),
  contentGoals: text("content_goals").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Full brand profile JSON (comprehensive brand identity)
  brandProfile: jsonb("brand_profile").$type<BrandProfileJSON>(),
  // Primary logo reference
  primaryLogoUrl: text("primary_logo_url"),
  websiteUrl: text("website_url"),
  socialHandles: jsonb("social_handles").$type<Record<string, string>>(),
});

// Brand Profile JSON type for the jsonb column
export interface BrandProfileJSON {
  version: string;
  lastUpdated?: string;
  textual: {
    brandName: { primary: string; token?: string; abbreviation?: string; usageNotes?: string };
    tagline: { primary: string; alternatives?: string[]; maxWords?: number };
    brandStory: { short: string; medium?: string; full?: string };
    mission?: string;
    vision?: string;
    values: Array<{ name: string; description: string }>;
    personality: { archetype: string; traits: string[]; avoidTraits?: string[] };
    tone: { description: string; formality: number; energy: number; technicality: number; warmth: number };
    forbiddenWords: string[];
    keywords: string[];
    contentGoals: string[];
    pastSuccesses?: string[];
    examplePhrases: string[];
    callToActions?: string[];
    targetAudience: { demographics: string; psychographics?: string; painPoints?: string[]; goals?: string[] };
  };
  visual: {
    visualStyle: { description: string; aesthetic: string[]; moodKeywords: string[]; patterns?: string[]; motifs?: string[] };
    colorPalette: {
      darkMode: {
        background: { name: string; hex: string; usage: string };
        accent: { name: string; hex: string; usage: string };
        textPrimary: { name: string; hex: string; usage: string };
        textSecondary?: { name: string; hex: string; usage: string };
        success?: { name: string; hex: string; usage: string };
        warning?: { name: string; hex: string; usage: string };
        error?: { name: string; hex: string; usage: string };
      };
      lightMode?: {
        background: { name: string; hex: string; usage: string };
        accent: { name: string; hex: string; usage: string };
        textPrimary: { name: string; hex: string; usage: string };
      };
      additionalColors?: Array<{ name: string; hex: string; usage: string }>;
    };
    typography: {
      fonts: Array<{ family: string; category: string; weights: number[]; usage: string; googleFontsUrl?: string }>;
    };
    iconography: { style: string; cornerStyle?: string; shape?: string; colorApproach: string; sizeBase: number };
    cinematicGuidelines: {
      aspectRatio: string;
      resolution: string;
      duration: { short: number; medium: number; long: number };
      pacing: string;
      motionStyle: string;
      transitionStyle?: string;
      soundtrackStyle?: string;
      colorGrading?: string;
    };
    accessibility: { standard: string; minContrastRatio: number; altTextRequired: boolean };
    usageRules: { dos: string[]; donts: string[] };
  };
  referenceAssets?: {
    logos?: Array<{ id: string; type: string; variant?: string; url: string; isPrimary?: boolean }>;
    icons?: Array<{ id: string; type: string; url: string }>;
    moodBoards?: Array<{ id: string; type: string; url: string }>;
  };
}

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Brand Assets - Visual and cinematic brand guidelines per client
export const brandAssets = pgTable("brand_assets", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().unique(),
  visualStyle: text("visual_style"),
  colorPalette: text("color_palette").array(),
  fonts: text("fonts").array(),
  referenceAssets: jsonb("reference_assets").$type<Record<string, string>>(),
  cinematicGuidelines: text("cinematic_guidelines"),
  forbiddenWords: text("forbidden_words").array(),
  examplePhrases: text("example_phrases").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBrandAssetsSchema = createInsertSchema(brandAssets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBrandAssets = z.infer<typeof insertBrandAssetsSchema>;
export type BrandAssets = typeof brandAssets.$inferSelect;

// Brand Asset Files - Individual uploaded files for brand content
export const brandAssetFiles = pgTable("brand_asset_files", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  category: text("category").notNull(), // textual, visual, assets
  subcategory: text("subcategory"), // logos, icons, mood-board, videos, infographics (for assets category)
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type").notNull(), // txt, docx, png, svg, mp4, zip, json
  mimeType: text("mime_type"),
  fileSize: integer("file_size").notNull(), // bytes
  purpose: text("purpose"), // brand_name, tagline, story, values, color_palette, logo_full, etc.
  metadata: jsonb("metadata").$type<Record<string, unknown>>(), // extracted content, dimensions, duration, etc.
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const insertBrandAssetFileSchema = createInsertSchema(brandAssetFiles).omit({ id: true, uploadedAt: true });
export type InsertBrandAssetFile = z.infer<typeof insertBrandAssetFileSchema>;
export type BrandAssetFile = typeof brandAssetFiles.$inferSelect;

// Enum types for brand asset file categories
export const brandAssetCategoryEnum = z.enum(["textual", "visual", "assets"]);
export const brandAssetSubcategoryEnum = z.enum(["logos", "icons", "mood-board", "videos", "infographics"]);
export const brandAssetPurposeEnum = z.enum([
  // Textual purposes
  "brand_name", "tagline", "brand_story", "values", "personality", "tone", 
  "forbidden_words", "keywords", "content_goals", "past_successes", "example_phrases",
  // Visual purposes
  "visual_style", "color_palette", "fonts", "cinematic_guidelines", 
  "iconography_guidelines", "usage_rules", "accessibility_guidelines",
  // Asset purposes
  "logo_full_color", "logo_monochrome", "logo_inverted", "mood_board",
  "reference_video", "tokenomics_infographic", "icon_set", "icon_individual"
]);

// Content Factory - Runs
export const contentRuns = pgTable("content_runs", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull().unique(),
  clientId: integer("client_id").notNull(),
  status: text("status").notNull().default("pending"),
  totalPieces: integer("total_pieces").notNull().default(0),
  successfulPieces: integer("successful_pieces").notNull().default(0),
  failedPieces: integer("failed_pieces").notNull().default(0),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertContentRunSchema = createInsertSchema(contentRuns).omit({ id: true, startedAt: true });
export type InsertContentRun = z.infer<typeof insertContentRunSchema>;
export type ContentRun = typeof contentRuns.$inferSelect;

// Content Factory - Generated Content
export const generatedContent = pgTable("generated_content", {
  id: serial("id").primaryKey(),
  contentId: text("content_id").notNull().unique(),
  runId: text("run_id").notNull(),
  clientId: integer("client_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"),
  status: text("status").notNull().default("draft"),
  qaScore: integer("qa_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGeneratedContentSchema = createInsertSchema(generatedContent).omit({ id: true, createdAt: true });
export type InsertGeneratedContent = z.infer<typeof insertGeneratedContentSchema>;
export type GeneratedContentRecord = typeof generatedContent.$inferSelect;

// Single Content Generation Request Schema
export const contentTypeEnum = z.enum([
  "blog",
  "linkedin", 
  "twitter",
  "instagram",
  "facebook_ad",
  "video_script",
  "email",
  "ad_copy"
]);

export type ContentType = z.infer<typeof contentTypeEnum>;

export const singleContentRequestSchema = z.object({
  clientId: z.number(),
  contentType: contentTypeEnum,
  topic: z.string().min(1, "Topic is required"),
  brief: z.string().optional(),
  tone: z.string().optional(),
  targetLength: z.enum(["short", "medium", "long"]).optional(),
  keywords: z.array(z.string()).optional(),
  callToAction: z.string().optional(),
  includeImage: z.boolean().optional().default(true),
});

export type SingleContentRequest = z.infer<typeof singleContentRequestSchema>;

export const socialContentTypes = ["twitter", "linkedin", "instagram", "facebook_ad"] as const;
export type SocialContentType = typeof socialContentTypes[number];

// Video Projects - for multi-scene video production
export const videoProjects = pgTable("video_projects", {
  id: serial("id").primaryKey(),
  projectId: text("project_id").notNull().unique(),
  clientId: integer("client_id").notNull(),
  sourceContentId: text("source_content_id"), // links to video_script content
  title: text("title").notNull(),
  description: text("description"),
  totalDuration: integer("total_duration"), // total seconds
  status: text("status").notNull().default("draft"), // draft, generating, ready, exported, failed
  outputUrl: text("output_url"), // final merged video URL
  outputFormat: text("output_format").default("mp4"),
  
  // Quality tier settings
  qualityTier: text("quality_tier").default("production"), // draft, production, cinematic_4k
  targetResolution: text("target_resolution").default("1080p"), // 720p, 1080p, 4k
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }), // Composite quality 0-100
  isQualityApproved: boolean("is_quality_approved"), // User approved quality?
  qualityReviewedAt: timestamp("quality_reviewed_at"),
  
  // Shotstack Studio SDK integration
  timelineDraft: jsonb("timeline_draft"), // Stored timeline JSON for Studio SDK editor
  editorSessionId: text("editor_session_id"), // Session ID for Studio SDK editing
  timelineVersion: integer("timeline_version").default(1), // Version tracking for edits
  lastEditedAt: timestamp("last_edited_at"), // When was timeline last modified in editor
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertVideoProjectSchema = createInsertSchema(videoProjects).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVideoProject = z.infer<typeof insertVideoProjectSchema>;
export type VideoProject = typeof videoProjects.$inferSelect;

// Video Scenes - individual scenes within a project
export const videoScenes = pgTable("video_scenes", {
  id: serial("id").primaryKey(),
  sceneId: text("scene_id").notNull().unique(),
  projectId: text("project_id").notNull(),
  sceneNumber: integer("scene_number").notNull(),
  title: text("title"),
  visualPrompt: text("visual_prompt").notNull(), // prompt for video generation
  voiceoverText: text("voiceover_text"), // text for TTS
  imageUrl: text("image_url"), // reference image URL for scene
  duration: integer("duration").notNull().default(5), // seconds
  startTime: integer("start_time").notNull().default(0), // position on timeline
  status: text("status").notNull().default("pending"), // pending, generating, ready, failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVideoSceneSchema = createInsertSchema(videoScenes).omit({ id: true, createdAt: true });
export type InsertVideoScene = z.infer<typeof insertVideoSceneSchema>;
export type VideoScene = typeof videoScenes.$inferSelect;

// Video Clips - generated video clips for scenes
export const videoClips = pgTable("video_clips", {
  id: serial("id").primaryKey(),
  clipId: text("clip_id").notNull().unique(),
  sceneId: text("scene_id").notNull(),
  projectId: text("project_id").notNull(),
  provider: text("provider").notNull().default("wan"), // wan, runway
  taskId: text("task_id"), // provider task ID for polling
  videoUrl: text("video_url"), // original provider URL (may expire)
  permanentVideoUrl: text("permanent_video_url"), // cached public URL (Shotstack Ingest)
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration"), // actual duration in seconds
  resolution: text("resolution").default("1080p"),
  status: text("status").notNull().default("pending"), // pending, generating, ready, failed, expired
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVideoClipSchema = createInsertSchema(videoClips).omit({ id: true, createdAt: true });
export type InsertVideoClip = z.infer<typeof insertVideoClipSchema>;
export type VideoClip = typeof videoClips.$inferSelect;

// Audio Tracks - generated audio for scenes (voiceover, music)
export const audioTracks = pgTable("audio_tracks", {
  id: serial("id").primaryKey(),
  trackId: text("track_id").notNull().unique(),
  sceneId: text("scene_id"), // null for background music
  projectId: text("project_id").notNull(),
  type: text("type").notNull().default("voiceover"), // voiceover, music, sfx
  provider: text("provider").notNull().default("elevenlabs"), // elevenlabs, etc
  taskId: text("task_id"),
  audioUrl: text("audio_url"),
  duration: integer("duration"), // seconds
  voiceId: text("voice_id"), // for TTS
  text: text("text"), // source text for TTS
  status: text("status").notNull().default("pending"), // pending, generating, ready, failed
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAudioTrackSchema = createInsertSchema(audioTracks).omit({ id: true, createdAt: true });
export type InsertAudioTrack = z.infer<typeof insertAudioTrackSchema>;
export type AudioTrack = typeof audioTracks.$inferSelect;

// AI Provider Settings - for fallback system
export const aiProviders = pgTable("ai_providers", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // 'video', 'image', 'voiceover', 'llm'
  name: text("name").notNull(), // 'runway', 'pika', 'luma', 'gemini', 'elevenlabs', etc.
  displayName: text("display_name").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(false),
  priority: integer("priority").notNull().default(100), // lower = higher priority
  apiKeyConfigured: boolean("api_key_configured").notNull().default(false),
  lastStatus: text("last_status").default("unknown"), // 'working', 'error', 'rate_limited', 'unknown'
  lastChecked: timestamp("last_checked"),
  config: text("config"), // JSON string for provider-specific config
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertAiProviderSchema = createInsertSchema(aiProviders).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiProvider = z.infer<typeof insertAiProviderSchema>;
export type AiProvider = typeof aiProviders.$inferSelect;

// Video Ingredients - for "Ingredients to Video" mode
export const videoIngredients = pgTable("video_ingredients", {
  id: serial("id").primaryKey(),
  ingredientId: text("ingredient_id").notNull().unique(),
  projectId: text("project_id").notNull(),
  clientId: integer("client_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  
  // Generation mode: 'text_to_video' | 'frames_to_video' | 'ingredients_to_video'
  mode: text("mode").notNull().default("ingredients_to_video"),
  
  // Scene definitions (JSON array)
  scenes: text("scenes").notNull().default("[]"), // [{prompt, duration, imageUrl?, transition?}]
  
  // Reference images (JSON array of URLs)
  referenceImages: text("reference_images").default("[]"),
  
  // Voiceover settings
  voiceoverScript: text("voiceover_script"),
  voiceId: text("voice_id"),
  voiceStyle: text("voice_style"), // professional_male, warm_female, etc.
  
  // Music settings
  musicStyle: text("music_style"), // ambient, upbeat, dramatic, corporate
  musicUrl: text("music_url"), // custom music URL
  musicVolume: integer("music_volume").default(30), // 0-100
  
  // Text overlays (JSON array)
  textOverlays: text("text_overlays").default("[]"), // [{text, startTime, duration, position, style}]
  
  // Brand settings
  brandColors: text("brand_colors").default("[]"), // ['#hex1', '#hex2']
  logoUrl: text("logo_url"),
  watermarkPosition: text("watermark_position"), // top-left, top-right, bottom-left, bottom-right
  
  // Output settings
  aspectRatio: text("aspect_ratio").default("16:9"),
  totalDuration: integer("total_duration"), // target duration in seconds
  resolution: text("resolution").default("1080p"),
  
  status: text("status").notNull().default("draft"), // draft, processing, ready, failed
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertVideoIngredientsSchema = createInsertSchema(videoIngredients).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertVideoIngredients = z.infer<typeof insertVideoIngredientsSchema>;
export type VideoIngredients = typeof videoIngredients.$inferSelect;

// Zod schemas for JSON fields
export const sceneIngredientSchema = z.object({
  prompt: z.string(),
  duration: z.number().default(5),
  imageUrl: z.string().optional(),
  transition: z.enum(["fade", "cut", "dissolve", "wipe", "zoom"]).default("fade"),
  order: z.number(),
});

export const textOverlaySchema = z.object({
  text: z.string(),
  startTime: z.number(),
  duration: z.number(),
  position: z.enum(["top", "center", "bottom", "top-left", "top-right", "bottom-left", "bottom-right"]).default("bottom"),
  style: z.enum(["title", "subtitle", "caption", "cta"]).default("subtitle"),
  fontSize: z.number().optional(),
  color: z.string().optional(),
});

export type SceneIngredient = z.infer<typeof sceneIngredientSchema>;
export type TextOverlay = z.infer<typeof textOverlaySchema>;

// Control Center - System Toggles
export const controlEntities = pgTable("control_entities", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull(), // global, pipeline, agent, provider, script
  displayName: text("display_name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // master, video, audio, content, image
  isEnabled: boolean("is_enabled").notNull().default(true),
  dependsOn: text("depends_on"), // JSON array of slugs this depends on
  priority: integer("priority").notNull().default(0), // for ordering
  lastChangedBy: text("last_changed_by"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertControlEntitySchema = createInsertSchema(controlEntities).omit({ id: true, createdAt: true, changedAt: true });
export type InsertControlEntity = z.infer<typeof insertControlEntitySchema>;
export type ControlEntity = typeof controlEntities.$inferSelect;

// Control Center - Audit Log
export const controlEvents = pgTable("control_events", {
  id: serial("id").primaryKey(),
  entitySlug: text("entity_slug").notNull(),
  action: text("action").notNull(), // enabled, disabled, kill, reset
  previousState: boolean("previous_state"),
  newState: boolean("new_state"),
  triggeredBy: text("triggered_by"), // user, system, cascade
  reason: text("reason"),
  metadata: text("metadata"), // JSON additional data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertControlEventSchema = createInsertSchema(controlEvents).omit({ id: true, createdAt: true });
export type InsertControlEvent = z.infer<typeof insertControlEventSchema>;
export type ControlEvent = typeof controlEvents.$inferSelect;

// Agent Metrics - Performance Tracking for ML Anomaly Detection
export const agentMetrics = pgTable("agent_metrics", {
  id: serial("id").primaryKey(),
  agentSlug: text("agent_slug").notNull(), // Reference to control entity
  metricType: text("metric_type").notNull(), // qa_score, api_failure_rate, response_time, cost, throughput
  value: decimal("value", { precision: 12, scale: 4 }).notNull(),
  unit: text("unit"), // seconds, dollars, percent, count
  context: text("context"), // JSON with additional context (clientId, runId, etc.)
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

export const insertAgentMetricSchema = createInsertSchema(agentMetrics).omit({ id: true, recordedAt: true });
export type InsertAgentMetric = z.infer<typeof insertAgentMetricSchema>;
export type AgentMetric = typeof agentMetrics.$inferSelect;

// Healing Alerts - ML-Detected Anomalies with Suggested Actions
export const healingAlerts = pgTable("healing_alerts", {
  id: serial("id").primaryKey(),
  agentSlug: text("agent_slug").notNull(),
  alertType: text("alert_type").notNull(), // anomaly, threshold_breach, trend_decline, prediction
  severity: text("severity").notNull().default("warning"), // info, warning, critical
  title: text("title").notNull(),
  description: text("description").notNull(),
  metricType: text("metric_type"), // Which metric triggered this
  currentValue: decimal("current_value", { precision: 12, scale: 4 }),
  expectedValue: decimal("expected_value", { precision: 12, scale: 4 }),
  anomalyScore: decimal("anomaly_score", { precision: 6, scale: 4 }), // ML confidence score
  suggestedAction: text("suggested_action").notNull(), // retrain, restart, investigate, scale_down, scale_up
  actionDetails: text("action_details"), // JSON with specific action parameters
  status: text("status").notNull().default("active"), // active, acknowledged, resolved, dismissed
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHealingAlertSchema = createInsertSchema(healingAlerts).omit({ id: true, createdAt: true, resolvedAt: true });
export type InsertHealingAlert = z.infer<typeof insertHealingAlertSchema>;
export type HealingAlert = typeof healingAlerts.$inferSelect;

// Anomaly Detection Models - Track ML model performance
export const anomalyModels = pgTable("anomaly_models", {
  id: serial("id").primaryKey(),
  modelName: text("model_name").notNull().unique(),
  modelType: text("model_type").notNull(), // isolation_forest, autoencoder, lstm
  targetMetrics: text("target_metrics").notNull(), // JSON array of metric types this model handles
  hyperparameters: text("hyperparameters"), // JSON model parameters
  trainingDataStart: timestamp("training_data_start"),
  trainingDataEnd: timestamp("training_data_end"),
  trainingSamples: integer("training_samples").default(0),
  accuracy: decimal("accuracy", { precision: 5, scale: 4 }),
  lastTrainedAt: timestamp("last_trained_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAnomalyModelSchema = createInsertSchema(anomalyModels).omit({ id: true, createdAt: true });
export type InsertAnomalyModel = z.infer<typeof insertAnomalyModelSchema>;
export type AnomalyModel = typeof anomalyModels.$inferSelect;

// Pipeline Activity Logs - Real-time tracking of content generation
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull(),
  eventType: text("event_type").notNull(), // run_started, topic_generated, content_started, content_completed, content_failed, run_completed, run_failed
  level: text("level").notNull().default("info"), // info, success, warning, error
  message: text("message").notNull(),
  metadata: text("metadata"), // JSON with additional details
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Provider Health Metrics - Real-time tracking of AI provider status
export const providerMetrics = pgTable("provider_metrics", {
  id: serial("id").primaryKey(),
  providerName: text("provider_name").notNull(), // veo31, runway, elevenlabs, gemini_image, fal_ai, anthropic, openai, dashscope
  serviceType: text("service_type").notNull(), // video, image, audio, text
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  totalRequests: integer("total_requests").notNull().default(0),
  avgLatencyMs: decimal("avg_latency_ms", { precision: 10, scale: 2 }),
  lastSuccessAt: timestamp("last_success_at"),
  lastFailureAt: timestamp("last_failure_at"),
  lastErrorMessage: text("last_error_message"),
  rateLimitHits: integer("rate_limit_hits").notNull().default(0),
  rateLimitResetAt: timestamp("rate_limit_reset_at"),
  isHealthy: boolean("is_healthy").notNull().default(true),
  healthScore: decimal("health_score", { precision: 5, scale: 2 }).notNull().default("100"), // 0-100
  costPerRequest: decimal("cost_per_request", { precision: 10, scale: 6 }),
  totalCost: decimal("total_cost", { precision: 12, scale: 4 }).notNull().default("0"),
  isFreeProvider: boolean("is_free_provider").notNull().default(false),
  priority: integer("priority").notNull().default(50), // Dynamic priority 0-100, higher = preferred
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProviderMetricSchema = createInsertSchema(providerMetrics).omit({ id: true, updatedAt: true });
export type InsertProviderMetric = z.infer<typeof insertProviderMetricSchema>;
export type ProviderMetric = typeof providerMetrics.$inferSelect;

// Provider Request Logs - Detailed tracking of each API call for ML learning
export const providerRequests = pgTable("provider_requests", {
  id: serial("id").primaryKey(),
  providerName: text("provider_name").notNull(),
  serviceType: text("service_type").notNull(),
  requestId: text("request_id").notNull(),
  status: text("status").notNull(), // pending, success, failed, rate_limited, timeout
  latencyMs: integer("latency_ms"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  requestParams: text("request_params"), // JSON with sanitized request params (duration, prompt length, etc.)
  responseMetadata: text("response_metadata"), // JSON with response info
  costIncurred: decimal("cost_incurred", { precision: 10, scale: 6 }),
  projectId: text("project_id"),
  sceneId: text("scene_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProviderRequestSchema = createInsertSchema(providerRequests).omit({ id: true, createdAt: true });
export type InsertProviderRequest = z.infer<typeof insertProviderRequestSchema>;
export type ProviderRequest = typeof providerRequests.$inferSelect;

// Provider Error Patterns - ML-learned patterns for preemptive failure avoidance
export const providerErrorPatterns = pgTable("provider_error_patterns", {
  id: serial("id").primaryKey(),
  providerName: text("provider_name").notNull(),
  patternType: text("pattern_type").notNull(), // duration_constraint, prompt_length, rate_limit, api_version, content_filter
  patternKey: text("pattern_key").notNull(), // e.g., "duration:6" for 6-second duration failures
  errorCode: text("error_code"),
  errorMessagePattern: text("error_message_pattern"),
  occurrenceCount: integer("occurrence_count").notNull().default(1),
  lastOccurrence: timestamp("last_occurrence").defaultNow().notNull(),
  suggestedFix: text("suggested_fix"), // e.g., "Use 5 or 10 second duration for Runway"
  isActive: boolean("is_active").notNull().default(true),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 4 }).notNull().default("0.5"), // How confident we are this pattern applies
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProviderErrorPatternSchema = createInsertSchema(providerErrorPatterns).omit({ id: true, createdAt: true, lastOccurrence: true });
export type InsertProviderErrorPattern = z.infer<typeof insertProviderErrorPatternSchema>;
export type ProviderErrorPattern = typeof providerErrorPatterns.$inferSelect;

// Provider Fallback Chain - Smart routing configuration
export const providerFallbackChains = pgTable("provider_fallback_chains", {
  id: serial("id").primaryKey(),
  serviceType: text("service_type").notNull(), // video, image, audio, text
  chainName: text("chain_name").notNull(), // e.g., "video_default", "video_free_only", "image_fast"
  providerOrder: text("provider_order").notNull(), // JSON array of provider names in priority order
  isDefault: boolean("is_default").notNull().default(false),
  conditions: text("conditions"), // JSON conditions for when to use this chain (e.g., {"freeOnly": true})
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProviderFallbackChainSchema = createInsertSchema(providerFallbackChains).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProviderFallbackChain = z.infer<typeof insertProviderFallbackChainSchema>;
export type ProviderFallbackChain = typeof providerFallbackChains.$inferSelect;

// Healing Actions Log - Track automated self-healing decisions
export const healingActionsLog = pgTable("healing_actions_log", {
  id: serial("id").primaryKey(),
  providerName: text("provider_name").notNull(),
  actionType: text("action_type").notNull(), // priority_adjusted, disabled, rate_limit_cooldown, fallback_triggered, error_pattern_learned
  previousState: text("previous_state"), // JSON with previous state
  newState: text("new_state"), // JSON with new state
  reason: text("reason").notNull(),
  triggeredBy: text("triggered_by").notNull(), // system_auto, ml_prediction, threshold_breach, manual
  metadata: text("metadata"), // JSON with additional context
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHealingActionLogSchema = createInsertSchema(healingActionsLog).omit({ id: true, createdAt: true });
export type InsertHealingActionLog = z.infer<typeof insertHealingActionLogSchema>;
export type HealingActionLog = typeof healingActionsLog.$inferSelect;

// ============================================================================
// QUALITY METRICS & OPTIMIZATION SYSTEM
// ============================================================================

// Quality Tiers - Execution profiles for different quality levels
export const qualityTierEnum = z.enum(["draft", "production", "cinematic_4k"]);
export type QualityTier = z.infer<typeof qualityTierEnum>;

// Content Quality Reviews - User feedback on generated content
export const contentQualityReviews = pgTable("content_quality_reviews", {
  id: serial("id").primaryKey(),
  reviewId: text("review_id").notNull().unique(),
  
  // Content reference
  contentType: text("content_type").notNull(), // video_project, video_scene, video_clip, generated_content
  contentId: text("content_id").notNull(), // projectId, sceneId, clipId, or contentId
  
  // User feedback
  overallRating: integer("overall_rating"), // 1-5 stars
  isAccepted: boolean("is_accepted"), // true = high quality, false = not acceptable
  rejectionReason: text("rejection_reason"), // Why it was rejected
  
  // Quality dimension ratings (1-5)
  visualQuality: integer("visual_quality"),
  audioQuality: integer("audio_quality"),
  brandAlignment: integer("brand_alignment"),
  scriptCoherence: integer("script_coherence"),
  cinematicAppeal: integer("cinematic_appeal"),
  
  // Tags for quick categorization
  qualityTags: text("quality_tags").array(), // ['too_fast', 'low_resolution', 'off_brand', 'excellent_color', etc.]
  
  // Reviewer info
  reviewedBy: text("reviewed_by"), // user identifier
  reviewerNotes: text("reviewer_notes"),
  
  // Provider tracking for ML feedback
  providerUsed: text("provider_used"),
  generationParams: text("generation_params"), // JSON of params used
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContentQualityReviewSchema = createInsertSchema(contentQualityReviews).omit({ id: true, createdAt: true });
export type InsertContentQualityReview = z.infer<typeof insertContentQualityReviewSchema>;
export type ContentQualityReview = typeof contentQualityReviews.$inferSelect;

// Content Quality Metrics - Objective/automated quality measurements
export const contentQualityMetrics = pgTable("content_quality_metrics", {
  id: serial("id").primaryKey(),
  metricId: text("metric_id").notNull().unique(),
  
  // Content reference
  contentType: text("content_type").notNull(),
  contentId: text("content_id").notNull(),
  
  // Video/Image metrics
  resolution: text("resolution"), // 720p, 1080p, 4k
  actualWidth: integer("actual_width"),
  actualHeight: integer("actual_height"),
  bitrate: integer("bitrate"), // kbps
  frameRate: integer("frame_rate"), // fps
  colorDepth: integer("color_depth"), // bits
  
  // Audio metrics
  audioLoudness: decimal("audio_loudness", { precision: 6, scale: 2 }), // LUFS
  audioClarity: decimal("audio_clarity", { precision: 5, scale: 2 }), // 0-100
  audioSync: boolean("audio_sync"), // Is audio synced with video?
  
  // Content analysis (AI-generated scores 0-100)
  coherenceScore: decimal("coherence_score", { precision: 5, scale: 2 }), // Script-to-video alignment
  motionSmoothness: decimal("motion_smoothness", { precision: 5, scale: 2 }), // Movement quality
  artifactScore: decimal("artifact_score", { precision: 5, scale: 2 }), // Lower = more artifacts
  brandComplianceScore: decimal("brand_compliance_score", { precision: 5, scale: 2 }), // Brand guideline adherence
  aestheticScore: decimal("aesthetic_score", { precision: 5, scale: 2 }), // Overall visual appeal
  
  // Composite scores
  overallQualityScore: decimal("overall_quality_score", { precision: 5, scale: 2 }), // Weighted composite 0-100
  qualityTierAchieved: text("quality_tier_achieved"), // draft, production, cinematic_4k
  
  // Provider info
  providerUsed: text("provider_used"),
  modelVersion: text("model_version"),
  generationTime: integer("generation_time"), // seconds
  
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
});

export const insertContentQualityMetricSchema = createInsertSchema(contentQualityMetrics).omit({ id: true, analyzedAt: true });
export type InsertContentQualityMetric = z.infer<typeof insertContentQualityMetricSchema>;
export type ContentQualityMetric = typeof contentQualityMetrics.$inferSelect;

// Provider Quality Scores - Rolling quality aggregates per provider
export const providerQualityScores = pgTable("provider_quality_scores", {
  id: serial("id").primaryKey(),
  providerName: text("provider_name").notNull(),
  serviceType: text("service_type").notNull(),
  
  // Quality metrics (rolling averages)
  avgQualityScore: decimal("avg_quality_score", { precision: 5, scale: 2 }).notNull().default("50"),
  avgUserRating: decimal("avg_user_rating", { precision: 3, scale: 2 }), // 1-5
  acceptanceRate: decimal("acceptance_rate", { precision: 5, scale: 2 }).notNull().default("100"), // % accepted
  
  // Dimension scores (0-100)
  avgVisualQuality: decimal("avg_visual_quality", { precision: 5, scale: 2 }),
  avgBrandAlignment: decimal("avg_brand_alignment", { precision: 5, scale: 2 }),
  avgCoherence: decimal("avg_coherence", { precision: 5, scale: 2 }),
  avgAestheticScore: decimal("avg_aesthetic_score", { precision: 5, scale: 2 }),
  
  // Stats
  totalReviews: integer("total_reviews").notNull().default(0),
  totalAccepted: integer("total_accepted").notNull().default(0),
  totalRejected: integer("total_rejected").notNull().default(0),
  
  // Quality tier success rates
  draftSuccessRate: decimal("draft_success_rate", { precision: 5, scale: 2 }),
  productionSuccessRate: decimal("production_success_rate", { precision: 5, scale: 2 }),
  cinematicSuccessRate: decimal("cinematic_success_rate", { precision: 5, scale: 2 }),
  
  // Combined scoring
  qualityHealthScore: decimal("quality_health_score", { precision: 5, scale: 2 }).notNull().default("50"), // Combined operational + quality
  qualityWeight: decimal("quality_weight", { precision: 3, scale: 2 }).notNull().default("0.5"), // How much quality affects routing (0-1)
  
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProviderQualityScoreSchema = createInsertSchema(providerQualityScores).omit({ id: true, updatedAt: true });
export type InsertProviderQualityScore = z.infer<typeof insertProviderQualityScoreSchema>;
export type ProviderQualityScore = typeof providerQualityScores.$inferSelect;

// Quality Tier Configurations - Settings for each quality tier
export const qualityTierConfigs = pgTable("quality_tier_configs", {
  id: serial("id").primaryKey(),
  tierName: text("tier_name").notNull().unique(), // draft, production, cinematic_4k
  displayName: text("display_name").notNull(),
  description: text("description"),
  
  // Target specifications
  targetResolution: text("target_resolution").notNull().default("1080p"),
  minBitrate: integer("min_bitrate"), // kbps
  minFrameRate: integer("min_frame_rate"), // fps
  
  // Quality thresholds (0-100)
  minQualityScore: integer("min_quality_score").notNull().default(50),
  minCoherenceScore: integer("min_coherence_score"),
  minAestheticScore: integer("min_aesthetic_score"),
  
  // Provider preferences
  preferredProviders: text("preferred_providers").array(), // JSON array of provider names
  excludedProviders: text("excluded_providers").array(),
  qualityWeightOverride: decimal("quality_weight_override", { precision: 3, scale: 2 }), // Override default quality vs operational weight
  
  // Retry settings
  maxRetries: integer("max_retries").notNull().default(3),
  autoUpgradeOnFailure: boolean("auto_upgrade_on_failure").notNull().default(false), // Upgrade tier if lower fails
  
  // Cost settings
  maxCostPerPiece: decimal("max_cost_per_piece", { precision: 10, scale: 4 }),
  prioritizeFree: boolean("prioritize_free").notNull().default(false),
  
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertQualityTierConfigSchema = createInsertSchema(qualityTierConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQualityTierConfig = z.infer<typeof insertQualityTierConfigSchema>;
export type QualityTierConfig = typeof qualityTierConfigs.$inferSelect;

// Quality Feedback Loop - Tracks how quality feedback improves the system
export const qualityFeedbackLoop = pgTable("quality_feedback_loop", {
  id: serial("id").primaryKey(),
  feedbackId: text("feedback_id").notNull().unique(),
  
  // Trigger info
  reviewId: text("review_id").notNull(), // Reference to content_quality_reviews
  providerName: text("provider_name").notNull(),
  serviceType: text("service_type").notNull(),
  
  // Action taken
  actionType: text("action_type").notNull(), // priority_boost, priority_penalty, chain_reorder, tier_adjustment, pattern_learned
  actionDetails: text("action_details"), // JSON with specific changes
  
  // Impact tracking
  previousScore: decimal("previous_score", { precision: 5, scale: 2 }),
  newScore: decimal("new_score", { precision: 5, scale: 2 }),
  impactMagnitude: decimal("impact_magnitude", { precision: 5, scale: 2 }), // How much the action changed things
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertQualityFeedbackLoopSchema = createInsertSchema(qualityFeedbackLoop).omit({ id: true, createdAt: true });
export type InsertQualityFeedbackLoop = z.infer<typeof insertQualityFeedbackLoopSchema>;
export type QualityFeedbackLoop = typeof qualityFeedbackLoop.$inferSelect;

// ============================================================================
// AUTOMATED REMEDIATION SYSTEM
// ============================================================================

// Remediation Rule Types
export const remediationActionEnum = z.enum([
  "restart_provider",
  "rotate_to_fallback", 
  "clear_rate_limit",
  "requeue_failed_content",
  "quarantine_provider",
  "scale_cooldown",
  "notify_admin",
  "run_diagnostic"
]);
export type RemediationAction = z.infer<typeof remediationActionEnum>;

export const remediationTriggerEnum = z.enum([
  "error_rate_threshold",
  "consecutive_failures",
  "rate_limit_detected",
  "latency_spike",
  "health_score_drop",
  "pattern_detected",
  "anomaly_detected",
  "manual_trigger"
]);
export type RemediationTrigger = z.infer<typeof remediationTriggerEnum>;

export const remediationModeEnum = z.enum(["auto", "manual", "semi_auto"]);
export type RemediationMode = z.infer<typeof remediationModeEnum>;

// Remediation Rules - Configurable rules for automated healing
export const remediationRules = pgTable("remediation_rules", {
  id: serial("id").primaryKey(),
  ruleId: text("rule_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  
  // Trigger conditions
  triggerType: text("trigger_type").notNull(), // error_rate_threshold, consecutive_failures, etc.
  triggerConditions: text("trigger_conditions").notNull(), // JSON: { threshold: 0.5, window_minutes: 15 }
  
  // Target
  serviceType: text("service_type"), // video, image, audio, text, or null for all
  providerPattern: text("provider_pattern"), // Regex or specific provider name, or null for all
  
  // Action
  actionType: text("action_type").notNull(), // restart_provider, rotate_to_fallback, etc.
  actionParams: text("action_params"), // JSON with action-specific parameters
  
  // Execution mode
  mode: text("mode").notNull().default("semi_auto"), // auto, manual, semi_auto
  requiresApproval: boolean("requires_approval").notNull().default(false),
  cooldownMinutes: integer("cooldown_minutes").notNull().default(15),
  maxExecutionsPerHour: integer("max_executions_per_hour").default(5),
  
  // Priority and scope
  priority: integer("priority").notNull().default(50), // Higher = more important
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRemediationRuleSchema = createInsertSchema(remediationRules).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRemediationRule = z.infer<typeof insertRemediationRuleSchema>;
export type RemediationRule = typeof remediationRules.$inferSelect;

// Remediation Executions - Track every remediation attempt with MTTD/MTTR
export const remediationExecutions = pgTable("remediation_executions", {
  id: serial("id").primaryKey(),
  executionId: text("execution_id").notNull().unique(),
  ruleId: text("rule_id").notNull(), // Reference to remediation_rules
  
  // Incident info
  incidentId: text("incident_id"), // Links related executions
  providerName: text("provider_name"),
  serviceType: text("service_type"),
  
  // Detection metrics (for MTTD)
  failureDetectedAt: timestamp("failure_detected_at").notNull(),
  alertCreatedAt: timestamp("alert_created_at"),
  
  // Remediation metrics (for MTTR)
  remediationStartedAt: timestamp("remediation_started_at"),
  remediationCompletedAt: timestamp("remediation_completed_at"),
  recoveryConfirmedAt: timestamp("recovery_confirmed_at"),
  
  // Calculated metrics (in seconds)
  mttdSeconds: integer("mttd_seconds"), // Time from failure to detection
  mttrSeconds: integer("mttr_seconds"), // Time from detection to recovery
  
  // Execution details
  triggerDetails: text("trigger_details"), // JSON with what triggered this
  actionTaken: text("action_taken").notNull(),
  actionParams: text("action_params"), // JSON with actual params used
  
  // Results
  status: text("status").notNull().default("pending"), // pending, in_progress, success, failed, rolled_back
  wasSuccessful: boolean("was_successful"),
  errorMessage: text("error_message"),
  rollbackPerformed: boolean("rollback_performed").default(false),
  
  // Impact tracking
  affectedRequests: integer("affected_requests").default(0),
  recoveredRequests: integer("recovered_requests").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRemediationExecutionSchema = createInsertSchema(remediationExecutions).omit({ id: true, createdAt: true });
export type InsertRemediationExecution = z.infer<typeof insertRemediationExecutionSchema>;
export type RemediationExecution = typeof remediationExecutions.$inferSelect;

// Failure Simulations - Controlled failure injection for testing
export const failureSimulations = pgTable("failure_simulations", {
  id: serial("id").primaryKey(),
  simulationId: text("simulation_id").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  
  // Simulation target
  targetProvider: text("target_provider"), // Specific provider or null for system-wide
  targetServiceType: text("target_service_type"),
  
  // Failure type
  failureType: text("failure_type").notNull(), // network_timeout, api_error, rate_limit, data_corruption, provider_outage
  failureParams: text("failure_params"), // JSON: { error_code: 429, error_rate: 0.8, duration_minutes: 10 }
  
  // Simulation control
  status: text("status").notNull().default("pending"), // pending, running, completed, cancelled
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  scheduledDurationMinutes: integer("scheduled_duration_minutes").notNull().default(5),
  
  // Results
  detectionTimeSeconds: integer("detection_time_seconds"), // How long until system detected the failure
  remediationTimeSeconds: integer("remediation_time_seconds"), // How long until system remediated
  totalAffectedRequests: integer("total_affected_requests").default(0),
  correctlyHandledRequests: integer("correctly_handled_requests").default(0),
  falsePositives: integer("false_positives").default(0),
  
  // Evaluation
  passedDetection: boolean("passed_detection"),
  passedRemediation: boolean("passed_remediation"),
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }),
  notes: text("notes"),
  
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFailureSimulationSchema = createInsertSchema(failureSimulations).omit({ id: true, createdAt: true });
export type InsertFailureSimulation = z.infer<typeof insertFailureSimulationSchema>;
export type FailureSimulation = typeof failureSimulations.$inferSelect;

// Healing Metrics - Time-series tracking of MTTD, MTTR, failure rates
export const healingMetrics = pgTable("healing_metrics", {
  id: serial("id").primaryKey(),
  
  // Time bucket
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  granularity: text("granularity").notNull().default("hour"), // hour, day, week
  
  // Scope
  providerName: text("provider_name"), // null = system-wide
  serviceType: text("service_type"), // null = all services
  
  // Core metrics
  totalFailures: integer("total_failures").notNull().default(0),
  totalRecoveries: integer("total_recoveries").notNull().default(0),
  totalRemediations: integer("total_remediations").notNull().default(0),
  successfulRemediations: integer("successful_remediations").notNull().default(0),
  
  // Time metrics (in seconds)
  avgMttdSeconds: decimal("avg_mttd_seconds", { precision: 10, scale: 2 }),
  avgMttrSeconds: decimal("avg_mttr_seconds", { precision: 10, scale: 2 }),
  p50MttdSeconds: decimal("p50_mttd_seconds", { precision: 10, scale: 2 }),
  p50MttrSeconds: decimal("p50_mttr_seconds", { precision: 10, scale: 2 }),
  p95MttdSeconds: decimal("p95_mttd_seconds", { precision: 10, scale: 2 }),
  p95MttrSeconds: decimal("p95_mttr_seconds", { precision: 10, scale: 2 }),
  
  // Rate metrics
  failureRate: decimal("failure_rate", { precision: 5, scale: 4 }), // failures / total requests
  remediationSuccessRate: decimal("remediation_success_rate", { precision: 5, scale: 4 }),
  falsePositiveRate: decimal("false_positive_rate", { precision: 5, scale: 4 }),
  
  // Improvement tracking
  failureRateChange: decimal("failure_rate_change", { precision: 5, scale: 4 }), // vs previous period
  mttdChange: decimal("mttd_change", { precision: 5, scale: 4 }), // vs previous period
  mttrChange: decimal("mttr_change", { precision: 5, scale: 4 }), // vs previous period
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHealingMetricSchema = createInsertSchema(healingMetrics).omit({ id: true, createdAt: true });
export type InsertHealingMetric = z.infer<typeof insertHealingMetricSchema>;
export type HealingMetric = typeof healingMetrics.$inferSelect;

// Runway API Tier Configuration
export const runwayTierConfig = pgTable("runway_tier_config", {
  id: serial("id").primaryKey(),
  tier: integer("tier").notNull().default(1), // 1-5
  
  // Limits per model type
  gen4TurboConcurrency: integer("gen4_turbo_concurrency").notNull().default(1),
  gen4AlephConcurrency: integer("gen4_aleph_concurrency").notNull().default(1),
  gen4ImageConcurrency: integer("gen4_image_concurrency").notNull().default(2),
  gen3TurboConcurrency: integer("gen3_turbo_concurrency").notNull().default(1),
  actTwoConcurrency: integer("act_two_concurrency").notNull().default(1),
  veo3Concurrency: integer("veo3_concurrency").notNull().default(1),
  geminiImageConcurrency: integer("gemini_image_concurrency").notNull().default(2),
  
  // Daily limits
  gen4TurboDailyLimit: integer("gen4_turbo_daily_limit").notNull().default(50),
  gen4AlephDailyLimit: integer("gen4_aleph_daily_limit").notNull().default(50),
  gen4ImageDailyLimit: integer("gen4_image_daily_limit").notNull().default(200),
  gen3TurboDailyLimit: integer("gen3_turbo_daily_limit").notNull().default(50),
  actTwoDailyLimit: integer("act_two_daily_limit").notNull().default(50),
  veo3DailyLimit: integer("veo3_daily_limit").notNull().default(50),
  geminiImageDailyLimit: integer("gemini_image_daily_limit").notNull().default(200),
  
  // Monthly spend limit
  monthlySpendLimit: decimal("monthly_spend_limit", { precision: 10, scale: 2 }).notNull().default("100"),
  
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRunwayTierConfigSchema = createInsertSchema(runwayTierConfig).omit({ id: true, updatedAt: true });
export type InsertRunwayTierConfig = z.infer<typeof insertRunwayTierConfigSchema>;
export type RunwayTierConfig = typeof runwayTierConfig.$inferSelect;

// Runway API Usage Tracking - Rolling window for daily limits
export const runwayApiUsage = pgTable("runway_api_usage", {
  id: serial("id").primaryKey(),
  modelType: text("model_type").notNull(), // gen4_turbo, gen4_aleph, veo3, etc.
  taskId: text("task_id").notNull(),
  status: text("status").notNull(), // pending, running, throttled, completed, failed
  creditsUsed: decimal("credits_used", { precision: 10, scale: 2 }),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
});

export const insertRunwayApiUsageSchema = createInsertSchema(runwayApiUsage).omit({ id: true, startedAt: true });
export type InsertRunwayApiUsage = z.infer<typeof insertRunwayApiUsageSchema>;
export type RunwayApiUsage = typeof runwayApiUsage.$inferSelect;

// Runway Concurrent Tasks - Real-time tracking of active tasks
export const runwayConcurrentTasks = pgTable("runway_concurrent_tasks", {
  id: serial("id").primaryKey(),
  modelType: text("model_type").notNull(),
  taskId: text("task_id").notNull().unique(),
  projectId: text("project_id"),
  sceneId: text("scene_id"),
  status: text("status").notNull().default("pending"), // pending, running, throttled
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastCheckedAt: timestamp("last_checked_at"),
});

// ==========================================
// LEARNING MODEL TABLES - Central Intelligence System
// ==========================================

// Prompt Templates - Stores successful prompt patterns
export const promptTemplates = pgTable("prompt_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // video_scene, blog_intro, social_hook, ad_copy, etc.
  templateType: text("template_type").notNull(), // establishing, extension, transition, cta
  template: text("template").notNull(), // The prompt template with {placeholders}
  variables: text("variables").array(), // List of variables in the template
  brandCompatibility: text("brand_compatibility").array(), // Brand archetypes this works for
  industryFit: text("industry_fit").array(), // Industries this works well for
  avgQualityScore: decimal("avg_quality_score", { precision: 4, scale: 2 }),
  usageCount: integer("usage_count").notNull().default(0),
  successRate: decimal("success_rate", { precision: 5, scale: 4 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPromptTemplateSchema = createInsertSchema(promptTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPromptTemplate = z.infer<typeof insertPromptTemplateSchema>;
export type PromptTemplate = typeof promptTemplates.$inferSelect;

// Generation Runs - Tracks every content generation with full lineage
export const generationRuns = pgTable("generation_runs", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull().unique(),
  clientId: integer("client_id").notNull(),
  contentType: text("content_type").notNull(), // blog, social, video, ad_copy, image
  contentId: text("content_id"), // Reference to the generated content
  route: text("route").notNull(), // quality_max, efficiency_max
  promptTemplateId: integer("prompt_template_id"),
  inputPrompt: text("input_prompt").notNull(),
  finalPrompt: text("final_prompt").notNull(), // After brand injection
  brandElements: jsonb("brand_elements").$type<Record<string, unknown>>(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  outputUrl: text("output_url"),
  qualityScore: decimal("quality_score", { precision: 4, scale: 2 }),
  brandConsistencyScore: decimal("brand_consistency_score", { precision: 4, scale: 2 }),
  processingTimeMs: integer("processing_time_ms"),
  costUsd: decimal("cost_usd", { precision: 10, scale: 4 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertGenerationRunSchema = createInsertSchema(generationRuns).omit({ id: true, createdAt: true });
export type InsertGenerationRun = z.infer<typeof insertGenerationRunSchema>;
export type GenerationRun = typeof generationRuns.$inferSelect;

// Quality Feedback - Captures feedback from QA, users, and automated metrics
export const qualityFeedback = pgTable("quality_feedback", {
  id: serial("id").primaryKey(),
  generationRunId: integer("generation_run_id").notNull(),
  feedbackType: text("feedback_type").notNull(), // qa_review, user_rating, auto_metric
  source: text("source").notNull(), // qa_agent, user_ui, brand_checker, resolution_check
  overallScore: decimal("overall_score", { precision: 4, scale: 2 }),
  brandAlignmentScore: decimal("brand_alignment_score", { precision: 4, scale: 2 }),
  technicalQualityScore: decimal("technical_quality_score", { precision: 4, scale: 2 }),
  creativityScore: decimal("creativity_score", { precision: 4, scale: 2 }),
  feedback: text("feedback"),
  issues: text("issues").array(),
  suggestions: text("suggestions").array(),
  isApproved: boolean("is_approved"),
  reviewedBy: text("reviewed_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertQualityFeedbackSchema = createInsertSchema(qualityFeedback).omit({ id: true, createdAt: true });
export type InsertQualityFeedback = z.infer<typeof insertQualityFeedbackSchema>;
export type QualityFeedback = typeof qualityFeedback.$inferSelect;

// Learning Signals - Derived insights from feedback that drive improvements
export const learningSignals = pgTable("learning_signals", {
  id: serial("id").primaryKey(),
  signalType: text("signal_type").notNull(), // prompt_effectiveness, brand_pattern, failure_pattern, success_pattern
  category: text("category").notNull(), // video, blog, social, etc.
  pattern: text("pattern").notNull(), // The identified pattern or insight
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(),
  sampleSize: integer("sample_size").notNull(),
  clientId: integer("client_id"), // null for global signals
  industryId: text("industry_id"), // null for cross-industry signals
  brandArchetype: text("brand_archetype"), // null for cross-archetype signals
  impact: jsonb("impact").$type<{
    qualityDelta: number;
    costDelta: number;
    speedDelta: number;
  }>(),
  recommendation: text("recommendation"),
  isActionable: boolean("is_actionable").notNull().default(true),
  appliedCount: integer("applied_count").notNull().default(0),
  lastAppliedAt: timestamp("last_applied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export const insertLearningSignalSchema = createInsertSchema(learningSignals).omit({ id: true, createdAt: true });
export type InsertLearningSignal = z.infer<typeof insertLearningSignalSchema>;
export type LearningSignal = typeof learningSignals.$inferSelect;

// Prompt Effectiveness - Tracks how well specific prompts perform per context
export const promptEffectiveness = pgTable("prompt_effectiveness", {
  id: serial("id").primaryKey(),
  promptHash: text("prompt_hash").notNull(), // Hash of the prompt for deduplication
  promptSnippet: text("prompt_snippet").notNull(), // First 500 chars
  category: text("category").notNull(),
  clientId: integer("client_id"),
  industry: text("industry"),
  brandArchetype: text("brand_archetype"),
  totalUses: integer("total_uses").notNull().default(0),
  avgQualityScore: decimal("avg_quality_score", { precision: 4, scale: 2 }),
  avgBrandScore: decimal("avg_brand_score", { precision: 4, scale: 2 }),
  approvalRate: decimal("approval_rate", { precision: 5, scale: 4 }),
  avgProcessingTimeMs: integer("avg_processing_time_ms"),
  avgCostUsd: decimal("avg_cost_usd", { precision: 10, scale: 4 }),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPromptEffectivenessSchema = createInsertSchema(promptEffectiveness).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPromptEffectiveness = z.infer<typeof insertPromptEffectivenessSchema>;
export type PromptEffectiveness = typeof promptEffectiveness.$inferSelect;

// Learning Adjustment type for tracking signal-based route modifications
export interface LearningAdjustmentJSON {
  signalId: number;
  signalType: string;
  adjustmentType: 'route_upgrade' | 'route_downgrade' | 'provider_override' | 'quality_boost';
  originalValue: string;
  adjustedValue: string;
  confidence: number;
}

// Route Decisions - Tracks quality vs efficiency routing decisions with learning attribution
export const routeDecisions = pgTable("route_decisions", {
  id: serial("id").primaryKey(),
  generationRunId: integer("generation_run_id").notNull(),
  clientId: integer("client_id").notNull(),
  contentType: text("content_type").notNull(),
  selectedRoute: text("selected_route").notNull(), // quality_max, efficiency_max, balanced
  routeReason: text("route_reason").notNull(),
  factors: jsonb("factors").$type<{
    clientTier: string;
    budget: string;
    deadline: boolean;
    contentPriority: string;
    previousQuality: number;
  }>(),
  // Learning adjustments applied to this decision (for feedback loop attribution)
  learningAdjustments: jsonb("learning_adjustments").$type<LearningAdjustmentJSON[]>(),
  expectedQuality: decimal("expected_quality", { precision: 4, scale: 2 }),
  expectedCost: decimal("expected_cost", { precision: 10, scale: 4 }),
  expectedTimeMs: integer("expected_time_ms"),
  actualQuality: decimal("actual_quality", { precision: 4, scale: 2 }),
  actualCost: decimal("actual_cost", { precision: 10, scale: 4 }),
  actualTimeMs: integer("actual_time_ms"),
  wasCorrectDecision: boolean("was_correct_decision"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRouteDecisionSchema = createInsertSchema(routeDecisions).omit({ id: true, createdAt: true });
export type InsertRouteDecision = z.infer<typeof insertRouteDecisionSchema>;
export type RouteDecision = typeof routeDecisions.$inferSelect;

// Brand Learning Patterns - Stores learned patterns per brand/client
export const brandLearningPatterns = pgTable("brand_learning_patterns", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  patternType: text("pattern_type").notNull(), // visual_style, tone_success, content_format, color_usage
  patternName: text("pattern_name").notNull(),
  patternData: jsonb("pattern_data").$type<Record<string, unknown>>().notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 4 }).notNull(),
  sampleCount: integer("sample_count").notNull(),
  avgImpact: decimal("avg_impact", { precision: 5, scale: 4 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertBrandLearningPatternSchema = createInsertSchema(brandLearningPatterns).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBrandLearningPattern = z.infer<typeof insertBrandLearningPatternSchema>;
export type BrandLearningPattern = typeof brandLearningPatterns.$inferSelect;

// WordPress Publishing Configurations - Per-client WordPress GraphQL endpoints
export const wordpressConfigs = pgTable("wordpress_configs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().unique(),
  endpointUrl: text("endpoint_url").notNull(), // e.g., https://example.com/graphql
  authType: text("auth_type").notNull().default("basic"), // basic, jwt, application_password
  username: text("username"), // For basic/app password auth
  // API key/password stored as encrypted secret reference (not plaintext)
  credentialSecretKey: text("credential_secret_key"), // References a secret in env/secrets
  jwtToken: text("jwt_token"), // For JWT auth (should also be stored securely)
  siteTitle: text("site_title"), // Cached site title from test connection
  defaultPostStatus: text("default_post_status").notNull().default("publish"), // draft, pending, publish
  defaultAuthorId: integer("default_author_id"), // WordPress user ID for posts
  defaultCategoryIds: jsonb("default_category_ids").$type<number[]>(),
  autoPublishEnabled: boolean("auto_publish_enabled").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at"),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWordpressConfigSchema = createInsertSchema(wordpressConfigs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWordpressConfig = z.infer<typeof insertWordpressConfigSchema>;
export type WordpressConfig = typeof wordpressConfigs.$inferSelect;

// WordPress Published Posts - Track content published to WordPress
export const wordpressPublishedPosts = pgTable("wordpress_published_posts", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  contentId: text("content_id").notNull(), // References generatedContent.contentId
  wordpressPostId: integer("wordpress_post_id").notNull(),
  wordpressPostUrl: text("wordpress_post_url").notNull(),
  wordpressStatus: text("wordpress_status").notNull(), // draft, pending, publish
  title: text("title").notNull(),
  publishedAt: timestamp("published_at"),
  syncStatus: text("sync_status").notNull().default("synced"), // synced, pending_update, failed
  lastError: text("last_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertWordpressPublishedPostSchema = createInsertSchema(wordpressPublishedPosts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWordpressPublishedPost = z.infer<typeof insertWordpressPublishedPostSchema>;
export type WordpressPublishedPost = typeof wordpressPublishedPosts.$inferSelect;

// Request schema for publishing content to WordPress
export const publishToWordpressRequestSchema = z.object({
  contentId: z.string(),
  status: z.enum(["draft", "pending", "publish"]).default("publish"),
  categoryIds: z.array(z.number()).optional(),
  tagIds: z.array(z.number()).optional(),
});

// API Cost Tracking - Track spending per provider per day
export const apiCostTracking = pgTable("api_cost_tracking", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD format for daily tracking
  provider: text("provider").notNull(), // veo3, gemini, runway, openai, etc
  operation: text("operation").notNull(), // video_generation, text_generation, image_generation
  costUsd: decimal("cost_usd", { precision: 10, scale: 4 }).notNull(),
  requestCount: integer("request_count").notNull().default(1),
  clientId: integer("client_id"), // Optional - track per client
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertApiCostTrackingSchema = createInsertSchema(apiCostTracking).omit({ id: true, createdAt: true });
export type InsertApiCostTracking = z.infer<typeof insertApiCostTrackingSchema>;
export type ApiCostTracking = typeof apiCostTracking.$inferSelect;

// Cost Budgets - Daily/monthly spending limits
export const costBudgets = pgTable("cost_budgets", {
  id: serial("id").primaryKey(),
  budgetType: text("budget_type").notNull(), // daily, monthly
  provider: text("provider"), // null = all providers, or specific provider
  limitUsd: decimal("limit_usd", { precision: 10, scale: 2 }).notNull(),
  alertThresholdPercent: integer("alert_threshold_percent").notNull().default(80),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCostBudgetSchema = createInsertSchema(costBudgets).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCostBudget = z.infer<typeof insertCostBudgetSchema>;
export type CostBudget = typeof costBudgets.$inferSelect;
