import { pgTable, text, serial, integer, timestamp, boolean, decimal } from "drizzle-orm/pg-core";
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

// Content Factory - Clients
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
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

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
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration"), // actual duration in seconds
  resolution: text("resolution").default("1080p"),
  status: text("status").notNull().default("pending"), // pending, generating, ready, failed
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
