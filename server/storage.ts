import { 
  type Kpi, 
  type InsertKpi, 
  type Pod, 
  type InsertPod,
  type PhaseChange,
  type InsertPhaseChange,
  type ApprovalQueue,
  type InsertApprovalQueue,
  type Alert,
  type InsertAlert,
  type Client,
  type InsertClient,
  type ContentRun,
  type InsertContentRun,
  type GeneratedContentRecord,
  type InsertGeneratedContent,
  type VideoProject,
  type InsertVideoProject,
  type VideoScene,
  type InsertVideoScene,
  type VideoClip,
  type InsertVideoClip,
  type AudioTrack,
  type InsertAudioTrack,
  type AiProvider,
  type InsertAiProvider,
  type VideoIngredients,
  type InsertVideoIngredients,
  type ControlEntity,
  type InsertControlEntity,
  type ControlEvent,
  type InsertControlEvent,
  type AgentMetric,
  type InsertAgentMetric,
  type HealingAlert,
  type InsertHealingAlert,
  type AnomalyModel,
  type InsertAnomalyModel,
  type ActivityLog,
  type InsertActivityLog,
  type BrandAssets,
  type InsertBrandAssets,
  type BrandAssetFile,
  type InsertBrandAssetFile,
  type ContentQualityReview,
  type InsertContentQualityReview,
  type ContentQualityMetric,
  type InsertContentQualityMetric,
  type ProviderQualityScore,
  type InsertProviderQualityScore,
  type QualityTierConfig,
  type InsertQualityTierConfig,
  type QualityFeedbackLoop,
  type InsertQualityFeedbackLoop,
  kpis,
  pods,
  phaseChanges,
  approvalQueue,
  alerts,
  clients,
  contentRuns,
  generatedContent,
  videoProjects,
  videoScenes,
  videoClips,
  audioTracks,
  aiProviders,
  videoIngredients,
  controlEntities,
  controlEvents,
  agentMetrics,
  healingAlerts,
  anomalyModels,
  activityLogs,
  brandAssets,
  brandAssetFiles,
  contentQualityReviews,
  contentQualityMetrics,
  providerQualityScores,
  qualityTierConfigs,
  qualityFeedbackLoop
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, gte, lte, inArray } from "drizzle-orm";

export interface IStorage {
  // KPIs
  getLatestKpi(): Promise<Kpi | undefined>;
  updateKpi(kpi: InsertKpi): Promise<Kpi>;
  incrementAiOutput(count: number): Promise<Kpi>;
  
  // Pods
  getActivePods(): Promise<Pod[]>;
  getPod(id: number): Promise<Pod | undefined>;
  createPod(pod: InsertPod): Promise<Pod>;
  updatePod(id: number, pod: Partial<InsertPod>): Promise<Pod>;
  
  // Phase Changes
  getUpcomingPhaseChanges(): Promise<PhaseChange[]>;
  createPhaseChange(phaseChange: InsertPhaseChange): Promise<PhaseChange>;
  
  // Approval Queue
  getPendingApprovals(): Promise<ApprovalQueue[]>;
  getApprovalsByStatus(status?: string): Promise<ApprovalQueue[]>;
  getApprovalItem(id: number): Promise<ApprovalQueue | undefined>;
  createApprovalItem(item: InsertApprovalQueue): Promise<ApprovalQueue>;
  updateApprovalStatus(id: number, status: string): Promise<ApprovalQueue>;
  
  // Alerts
  getActiveAlerts(): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  resolveAlert(id: number): Promise<Alert>;

  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: number, updates: Partial<InsertClient>): Promise<Client>;
  updateClientBrandProfile(id: number, brandProfile: any, logoUrl?: string): Promise<Client>;
  getClientWithBrandProfile(id: number): Promise<Client | undefined>;
  deleteClient(id: number): Promise<void>;

  // Content Runs
  getContentRuns(): Promise<ContentRun[]>;
  getContentRun(runId: string): Promise<ContentRun | undefined>;
  createContentRun(run: InsertContentRun): Promise<ContentRun>;
  updateContentRun(runId: string, updates: Partial<InsertContentRun>): Promise<ContentRun>;
  clearContentRuns(): Promise<{ deletedCount: number }>;

  // Generated Content
  getGeneratedContent(runId: string): Promise<GeneratedContentRecord[]>;
  getGeneratedContentByClient(clientId: number, limit?: number, offset?: number): Promise<GeneratedContentRecord[]>;
  getAllGeneratedContent(limit?: number, offset?: number): Promise<GeneratedContentRecord[]>;
  getGeneratedContentCount(clientId?: number): Promise<number>;
  updateGeneratedContentStatus(contentId: string, status: string): Promise<GeneratedContentRecord>;
  createGeneratedContent(content: InsertGeneratedContent): Promise<GeneratedContentRecord>;

  // Video Projects
  getVideoProjects(): Promise<VideoProject[]>;
  getAllVideoProjects(): Promise<VideoProject[]>;
  getVideoProject(projectId: string): Promise<VideoProject | undefined>;
  createVideoProject(project: InsertVideoProject): Promise<VideoProject>;
  updateVideoProject(projectId: string, updates: Partial<InsertVideoProject>): Promise<VideoProject>;

  // Video Scenes
  createVideoScene(scene: InsertVideoScene): Promise<VideoScene>;
  getVideoScenes(projectId: string): Promise<VideoScene[]>;
  updateVideoScene(sceneId: string, updates: Partial<InsertVideoScene>): Promise<VideoScene>;

  // Video Clips
  createVideoClip(clip: InsertVideoClip): Promise<VideoClip>;
  getVideoClips(projectId: string): Promise<VideoClip[]>;
  getVideoClipsByScene(sceneId: string): Promise<VideoClip[]>;
  updateVideoClip(clipId: string, updates: Partial<InsertVideoClip>): Promise<VideoClip>;

  // Audio Tracks
  createAudioTrack(track: InsertAudioTrack): Promise<AudioTrack>;
  getAudioTracks(projectId: string): Promise<AudioTrack[]>;
  updateAudioTrack(trackId: string, updates: Partial<InsertAudioTrack>): Promise<AudioTrack>;

  // Full Project
  getFullVideoProject(projectId: string): Promise<{
    project: VideoProject;
    scenes: VideoScene[];
    clips: VideoClip[];
    audioTracks: AudioTrack[];
  } | null>;

  // AI Providers
  getAiProviders(): Promise<AiProvider[]>;
  getAiProvidersByCategory(category: string): Promise<AiProvider[]>;
  getEnabledProviders(category: string): Promise<AiProvider[]>;
  getAiProvider(id: number): Promise<AiProvider | undefined>;
  createAiProvider(provider: InsertAiProvider): Promise<AiProvider>;
  updateAiProvider(id: number, updates: Partial<InsertAiProvider>): Promise<AiProvider>;
  initializeDefaultProviders(): Promise<void>;

  // Video Ingredients
  getVideoIngredients(projectId: string): Promise<VideoIngredients | undefined>;
  getVideoIngredientsByClient(clientId: number): Promise<VideoIngredients[]>;
  getAllVideoIngredients(): Promise<VideoIngredients[]>;
  createVideoIngredients(ingredients: InsertVideoIngredients): Promise<VideoIngredients>;
  updateVideoIngredients(ingredientId: string, updates: Partial<InsertVideoIngredients>): Promise<VideoIngredients>;
  deleteVideoIngredients(ingredientId: string): Promise<void>;

  // Clear/Delete All Operations
  clearAllGeneratedContent(): Promise<{ deletedCount: number }>;
  clearAllVideoProjects(): Promise<{ deletedCount: number }>;
  clearAllApprovalQueue(): Promise<{ deletedCount: number }>;

  // Control Center
  getControlEntities(): Promise<ControlEntity[]>;
  getControlEntity(slug: string): Promise<ControlEntity | undefined>;
  getControlEntitiesByCategory(category: string): Promise<ControlEntity[]>;
  createControlEntity(entity: InsertControlEntity): Promise<ControlEntity>;
  updateControlEntity(slug: string, updates: Partial<InsertControlEntity>): Promise<ControlEntity>;
  toggleControlEntity(slug: string, isEnabled: boolean, triggeredBy?: string): Promise<ControlEntity>;
  getControlEvents(limit?: number): Promise<ControlEvent[]>;
  createControlEvent(event: InsertControlEvent): Promise<ControlEvent>;
  initializeDefaultControlEntities(): Promise<void>;
  killAllServices(triggeredBy?: string): Promise<void>;
  resetAllServices(triggeredBy?: string): Promise<void>;

  // Agent Metrics
  recordAgentMetric(metric: InsertAgentMetric): Promise<AgentMetric>;
  recordAgentMetrics(metrics: InsertAgentMetric[]): Promise<AgentMetric[]>;
  getAgentMetrics(agentSlug: string, options?: { metricType?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<AgentMetric[]>;
  getLatestAgentMetrics(agentSlug: string): Promise<AgentMetric[]>;
  getMetricsForAnomalyDetection(metricTypes: string[], hours?: number): Promise<AgentMetric[]>;

  // Healing Alerts
  createHealingAlert(alert: InsertHealingAlert): Promise<HealingAlert>;
  getHealingAlerts(options?: { status?: string; agentSlug?: string; limit?: number }): Promise<HealingAlert[]>;
  getActiveHealingAlerts(): Promise<HealingAlert[]>;
  acknowledgeHealingAlert(id: number, acknowledgedBy: string): Promise<HealingAlert>;
  resolveHealingAlert(id: number, resolvedBy: string): Promise<HealingAlert>;
  dismissHealingAlert(id: number, dismissedBy: string): Promise<HealingAlert>;

  // Anomaly Models
  getAnomalyModels(): Promise<AnomalyModel[]>;
  getActiveAnomalyModel(metricType: string): Promise<AnomalyModel | undefined>;
  updateAnomalyModel(id: number, updates: Partial<InsertAnomalyModel>): Promise<AnomalyModel>;
  createAnomalyModel(model: InsertAnomalyModel): Promise<AnomalyModel>;

  // Activity Logs
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getActivityLogs(options?: { runId?: string; limit?: number }): Promise<ActivityLog[]>;
  getRecentActivityLogs(limit?: number): Promise<ActivityLog[]>;
  clearActivityLogs(runId?: string): Promise<{ deletedCount: number }>;

  // Brand Assets
  getBrandAssets(clientId: number): Promise<BrandAssets | undefined>;
  getAllBrandAssets(): Promise<BrandAssets[]>;
  createBrandAssets(assets: InsertBrandAssets): Promise<BrandAssets>;
  updateBrandAssets(clientId: number, updates: Partial<InsertBrandAssets>): Promise<BrandAssets>;
  deleteBrandAssets(clientId: number): Promise<void>;

  // Brand Asset Files
  getBrandAssetFiles(clientId: number): Promise<BrandAssetFile[]>;
  getBrandAssetFilesByCategory(clientId: number, category: string): Promise<BrandAssetFile[]>;
  getBrandAssetFilesByPurpose(clientId: number, purpose: string): Promise<BrandAssetFile | undefined>;
  getBrandAssetFile(id: number): Promise<BrandAssetFile | undefined>;
  createBrandAssetFile(file: InsertBrandAssetFile): Promise<BrandAssetFile>;
  updateBrandAssetFile(id: number, updates: Partial<InsertBrandAssetFile>): Promise<BrandAssetFile>;
  deleteBrandAssetFile(id: number): Promise<void>;
  deleteBrandAssetFilesByClient(clientId: number): Promise<{ deletedCount: number }>;

  // Quality Reviews
  createQualityReview(review: InsertContentQualityReview): Promise<ContentQualityReview>;
  getQualityReview(reviewId: string): Promise<ContentQualityReview | undefined>;
  getQualityReviewsForContent(contentType: string, contentId: string): Promise<ContentQualityReview[]>;
  getQualityReviewsByProvider(providerName: string, limit?: number): Promise<ContentQualityReview[]>;
  getRecentQualityReviews(limit?: number): Promise<ContentQualityReview[]>;

  // Quality Metrics
  createQualityMetric(metric: InsertContentQualityMetric): Promise<ContentQualityMetric>;
  getQualityMetric(metricId: string): Promise<ContentQualityMetric | undefined>;
  getQualityMetricsForContent(contentType: string, contentId: string): Promise<ContentQualityMetric[]>;
  getQualityMetricsByProvider(providerName: string, limit?: number): Promise<ContentQualityMetric[]>;

  // Provider Quality Scores
  getProviderQualityScore(providerName: string, serviceType: string): Promise<ProviderQualityScore | undefined>;
  getAllProviderQualityScores(): Promise<ProviderQualityScore[]>;
  createProviderQualityScore(score: InsertProviderQualityScore): Promise<ProviderQualityScore>;
  updateProviderQualityScore(providerName: string, serviceType: string, updates: Partial<InsertProviderQualityScore>): Promise<ProviderQualityScore>;
  initializeProviderQualityScores(): Promise<void>;

  // Quality Tier Configs
  getQualityTierConfig(tierName: string): Promise<QualityTierConfig | undefined>;
  getAllQualityTierConfigs(): Promise<QualityTierConfig[]>;
  createQualityTierConfig(config: InsertQualityTierConfig): Promise<QualityTierConfig>;
  updateQualityTierConfig(tierName: string, updates: Partial<InsertQualityTierConfig>): Promise<QualityTierConfig>;
  initializeDefaultQualityTiers(): Promise<void>;

  // Quality Feedback Loop
  createQualityFeedback(feedback: InsertQualityFeedbackLoop): Promise<QualityFeedbackLoop>;
  getRecentQualityFeedback(limit?: number): Promise<QualityFeedbackLoop[]>;
  getQualityFeedbackByProvider(providerName: string, limit?: number): Promise<QualityFeedbackLoop[]>;
}

export class DatabaseStorage implements IStorage {
  // KPIs
  async getLatestKpi(): Promise<Kpi | undefined> {
    const [kpi] = await db.select().from(kpis).orderBy(desc(kpis.updatedAt)).limit(1);
    return kpi || undefined;
  }

  async updateKpi(insertKpi: InsertKpi): Promise<Kpi> {
    const [kpi] = await db.insert(kpis).values(insertKpi).returning();
    return kpi;
  }

  // Pods
  async getActivePods(): Promise<Pod[]> {
    return await db.select().from(pods).where(eq(pods.isActive, true));
  }

  async getPod(id: number): Promise<Pod | undefined> {
    const [pod] = await db.select().from(pods).where(eq(pods.id, id));
    return pod || undefined;
  }

  async createPod(insertPod: InsertPod): Promise<Pod> {
    const [pod] = await db.insert(pods).values(insertPod).returning();
    return pod;
  }

  async updatePod(id: number, updateData: Partial<InsertPod>): Promise<Pod> {
    const [pod] = await db.update(pods).set(updateData).where(eq(pods.id, id)).returning();
    return pod;
  }

  // Phase Changes
  async getUpcomingPhaseChanges(): Promise<PhaseChange[]> {
    const now = new Date();
    return await db
      .select()
      .from(phaseChanges)
      .where(and(eq(phaseChanges.isCompleted, false)))
      .orderBy(phaseChanges.changeDate);
  }

  async createPhaseChange(insertPhaseChange: InsertPhaseChange): Promise<PhaseChange> {
    const [phaseChange] = await db.insert(phaseChanges).values(insertPhaseChange).returning();
    return phaseChange;
  }

  // Approval Queue
  async getPendingApprovals(): Promise<ApprovalQueue[]> {
    return await db
      .select()
      .from(approvalQueue)
      .where(eq(approvalQueue.status, "pending"))
      .orderBy(desc(approvalQueue.createdAt));
  }

  async getApprovalsByStatus(status?: string): Promise<ApprovalQueue[]> {
    if (status && status !== "all") {
      return await db
        .select()
        .from(approvalQueue)
        .where(eq(approvalQueue.status, status))
        .orderBy(desc(approvalQueue.createdAt));
    }
    return await db
      .select()
      .from(approvalQueue)
      .orderBy(desc(approvalQueue.createdAt));
  }

  async getApprovalItem(id: number): Promise<ApprovalQueue | undefined> {
    const [item] = await db.select().from(approvalQueue).where(eq(approvalQueue.id, id));
    return item || undefined;
  }

  async createApprovalItem(insertItem: InsertApprovalQueue): Promise<ApprovalQueue> {
    const [item] = await db.insert(approvalQueue).values(insertItem).returning();
    return item;
  }

  async updateApprovalStatus(id: number, status: string): Promise<ApprovalQueue> {
    const [item] = await db
      .update(approvalQueue)
      .set({ status, processedAt: new Date() })
      .where(eq(approvalQueue.id, id))
      .returning();
    return item;
  }

  // Alerts
  async getActiveAlerts(): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.isResolved, false))
      .orderBy(desc(alerts.createdAt));
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const [alert] = await db.insert(alerts).values(insertAlert).returning();
    return alert;
  }

  async resolveAlert(id: number): Promise<Alert> {
    const [alert] = await db
      .update(alerts)
      .set({ isResolved: true })
      .where(eq(alerts.id, id))
      .returning();
    return alert;
  }

  async incrementAiOutput(count: number): Promise<Kpi> {
    const latestKpi = await this.getLatestKpi();
    if (!latestKpi) {
      throw new Error("No KPI record found");
    }
    
    const [kpi] = await db
      .update(kpis)
      .set({ 
        aiOutputToday: latestKpi.aiOutputToday + count,
        updatedAt: new Date()
      })
      .where(eq(kpis.id, latestKpi.id))
      .returning();
    return kpi;
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.isActive, true));
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(insertClient as any).returning();
    return client;
  }

  async updateClient(id: number, updates: Partial<InsertClient>): Promise<Client> {
    const [client] = await db
      .update(clients)
      .set(updates as any)
      .where(eq(clients.id, id))
      .returning();
    return client;
  }

  async updateClientBrandProfile(id: number, brandProfile: any, logoUrl?: string): Promise<Client> {
    const updateData: any = { brandProfile };
    if (logoUrl) {
      updateData.primaryLogoUrl = logoUrl;
    }
    const [client] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();
    return client;
  }

  async getClientWithBrandProfile(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async deleteClient(id: number): Promise<void> {
    await db.update(clients).set({ isActive: false }).where(eq(clients.id, id));
  }

  // Content Runs
  async getContentRuns(): Promise<ContentRun[]> {
    return await db.select().from(contentRuns).orderBy(desc(contentRuns.startedAt));
  }

  async getContentRun(runId: string): Promise<ContentRun | undefined> {
    const [run] = await db.select().from(contentRuns).where(eq(contentRuns.runId, runId));
    return run || undefined;
  }

  async createContentRun(insertRun: InsertContentRun): Promise<ContentRun> {
    const [run] = await db.insert(contentRuns).values(insertRun).returning();
    return run;
  }

  async updateContentRun(runId: string, updates: Partial<InsertContentRun>): Promise<ContentRun> {
    const [run] = await db
      .update(contentRuns)
      .set(updates)
      .where(eq(contentRuns.runId, runId))
      .returning();
    return run;
  }

  async clearContentRuns(): Promise<{ deletedCount: number }> {
    const result = await db.delete(contentRuns);
    return { deletedCount: result.rowCount || 0 };
  }

  // Generated Content
  async getGeneratedContent(runId: string): Promise<GeneratedContentRecord[]> {
    return await db
      .select()
      .from(generatedContent)
      .where(eq(generatedContent.runId, runId))
      .orderBy(desc(generatedContent.createdAt));
  }

  async getGeneratedContentByClient(clientId: number, limit = 50, offset = 0): Promise<GeneratedContentRecord[]> {
    return await db
      .select()
      .from(generatedContent)
      .where(eq(generatedContent.clientId, clientId))
      .orderBy(desc(generatedContent.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getAllGeneratedContent(limit = 50, offset = 0): Promise<GeneratedContentRecord[]> {
    return await db
      .select()
      .from(generatedContent)
      .orderBy(desc(generatedContent.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getGeneratedContentCount(clientId?: number): Promise<number> {
    let query = db
      .select({ count: sql<number>`count(*)::int` })
      .from(generatedContent);
    
    if (clientId !== undefined) {
      query = query.where(eq(generatedContent.clientId, clientId)) as typeof query;
    }
    
    const result = await query;
    return result[0]?.count || 0;
  }

  async updateGeneratedContentStatus(contentId: string, status: string): Promise<GeneratedContentRecord> {
    const [content] = await db
      .update(generatedContent)
      .set({ status })
      .where(eq(generatedContent.contentId, contentId))
      .returning();
    return content;
  }

  async updateGeneratedContentMetadata(contentId: string, metadata: string): Promise<GeneratedContentRecord> {
    const [content] = await db
      .update(generatedContent)
      .set({ metadata })
      .where(eq(generatedContent.contentId, contentId))
      .returning();
    return content;
  }

  async createGeneratedContent(insertContent: InsertGeneratedContent): Promise<GeneratedContentRecord> {
    const [content] = await db.insert(generatedContent).values(insertContent).returning();
    return content;
  }

  // Video Projects
  async createVideoProject(project: InsertVideoProject): Promise<VideoProject> {
    const [result] = await db.insert(videoProjects).values(project).returning();
    return result;
  }

  async getVideoProject(projectId: string): Promise<VideoProject | undefined> {
    const [project] = await db
      .select()
      .from(videoProjects)
      .where(eq(videoProjects.projectId, projectId));
    return project;
  }

  async getVideoProjectsByClient(clientId: number): Promise<VideoProject[]> {
    return await db
      .select()
      .from(videoProjects)
      .where(eq(videoProjects.clientId, clientId))
      .orderBy(desc(videoProjects.createdAt));
  }

  async getAllVideoProjects(): Promise<VideoProject[]> {
    return await db
      .select()
      .from(videoProjects)
      .orderBy(desc(videoProjects.createdAt));
  }

  async updateVideoProject(projectId: string, updates: Partial<InsertVideoProject>): Promise<VideoProject> {
    const [project] = await db
      .update(videoProjects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(videoProjects.projectId, projectId))
      .returning();
    return project;
  }

  // Video Scenes
  async createVideoScene(scene: InsertVideoScene): Promise<VideoScene> {
    const [result] = await db.insert(videoScenes).values(scene).returning();
    return result;
  }

  async getVideoScenes(projectId: string): Promise<VideoScene[]> {
    return await db
      .select()
      .from(videoScenes)
      .where(eq(videoScenes.projectId, projectId))
      .orderBy(videoScenes.sceneNumber);
  }

  async updateVideoScene(sceneId: string, updates: Partial<InsertVideoScene>): Promise<VideoScene> {
    const [scene] = await db
      .update(videoScenes)
      .set(updates)
      .where(eq(videoScenes.sceneId, sceneId))
      .returning();
    return scene;
  }

  // Video Clips
  async createVideoClip(clip: InsertVideoClip): Promise<VideoClip> {
    const [result] = await db.insert(videoClips).values(clip).returning();
    return result;
  }

  async getVideoClips(projectId: string): Promise<VideoClip[]> {
    return await db
      .select()
      .from(videoClips)
      .where(eq(videoClips.projectId, projectId))
      .orderBy(videoClips.createdAt);
  }

  async getVideoClipsByScene(sceneId: string): Promise<VideoClip[]> {
    return await db
      .select()
      .from(videoClips)
      .where(eq(videoClips.sceneId, sceneId));
  }

  async updateVideoClip(clipId: string, updates: Partial<InsertVideoClip>): Promise<VideoClip> {
    const [clip] = await db
      .update(videoClips)
      .set(updates)
      .where(eq(videoClips.clipId, clipId))
      .returning();
    return clip;
  }

  // Audio Tracks
  async createAudioTrack(track: InsertAudioTrack): Promise<AudioTrack> {
    const [result] = await db.insert(audioTracks).values(track).returning();
    return result;
  }

  async getAudioTracks(projectId: string): Promise<AudioTrack[]> {
    return await db
      .select()
      .from(audioTracks)
      .where(eq(audioTracks.projectId, projectId))
      .orderBy(audioTracks.createdAt);
  }

  async updateAudioTrack(trackId: string, updates: Partial<InsertAudioTrack>): Promise<AudioTrack> {
    const [track] = await db
      .update(audioTracks)
      .set(updates)
      .where(eq(audioTracks.trackId, trackId))
      .returning();
    return track;
  }

  // Get full project with all related data
  async getFullVideoProject(projectId: string): Promise<{
    project: VideoProject;
    scenes: VideoScene[];
    clips: VideoClip[];
    audioTracks: AudioTrack[];
  } | null> {
    const project = await this.getVideoProject(projectId);
    if (!project) return null;

    const [scenes, clips, audio] = await Promise.all([
      this.getVideoScenes(projectId),
      this.getVideoClips(projectId),
      this.getAudioTracks(projectId),
    ]);

    return {
      project,
      scenes,
      clips,
      audioTracks: audio,
    };
  }

  // AI Providers
  async getAiProviders(): Promise<AiProvider[]> {
    return await db.select().from(aiProviders).orderBy(aiProviders.category, aiProviders.priority);
  }

  async getAiProvidersByCategory(category: string): Promise<AiProvider[]> {
    return await db
      .select()
      .from(aiProviders)
      .where(eq(aiProviders.category, category))
      .orderBy(aiProviders.priority);
  }

  async getEnabledProviders(category: string): Promise<AiProvider[]> {
    return await db
      .select()
      .from(aiProviders)
      .where(and(eq(aiProviders.category, category), eq(aiProviders.isEnabled, true)))
      .orderBy(aiProviders.priority);
  }

  async getAiProvider(id: number): Promise<AiProvider | undefined> {
    const [provider] = await db.select().from(aiProviders).where(eq(aiProviders.id, id));
    return provider || undefined;
  }

  async createAiProvider(provider: InsertAiProvider): Promise<AiProvider> {
    const [result] = await db.insert(aiProviders).values(provider).returning();
    return result;
  }

  async updateAiProvider(id: number, updates: Partial<InsertAiProvider>): Promise<AiProvider> {
    const [provider] = await db
      .update(aiProviders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(aiProviders.id, id))
      .returning();
    return provider;
  }

  async initializeDefaultProviders(): Promise<void> {
    const existing = await this.getAiProviders();
    if (existing.length > 0) return;

    const hasGeminiKey = !!(process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY);
    
    const defaultProviders: InsertAiProvider[] = [
      // Video Providers - Veo 3.1 Fast is primary (native audio, Ultra tier), Runway Gen-4 as fallback
      { category: 'video', name: 'veo31', displayName: 'Veo 3.1 Fast', isEnabled: true, priority: 1, apiKeyConfigured: hasGeminiKey },
      { category: 'video', name: 'runway', displayName: 'Runway Gen-4 Turbo', isEnabled: true, priority: 2, apiKeyConfigured: !!process.env.RUNWAY_API_KEY },
      { category: 'video', name: 'veo2', displayName: 'Veo 2.0', isEnabled: false, priority: 3, apiKeyConfigured: hasGeminiKey },
      { category: 'video', name: 'pika', displayName: 'Pika Labs', isEnabled: false, priority: 4, apiKeyConfigured: false },
      { category: 'video', name: 'luma', displayName: 'Luma Dream Machine', isEnabled: false, priority: 5, apiKeyConfigured: false },
      { category: 'video', name: 'kling', displayName: 'Kling AI', isEnabled: false, priority: 6, apiKeyConfigured: false },
      { category: 'video', name: 'hailuo', displayName: 'Hailuo AI', isEnabled: false, priority: 7, apiKeyConfigured: false },
      
      // Image Providers - Nano Banana Pro is the advanced option
      { category: 'image', name: 'nano_banana_pro', displayName: 'Nano Banana Pro', isEnabled: true, priority: 1, apiKeyConfigured: hasGeminiKey },
      { category: 'image', name: 'gemini', displayName: 'Gemini 2.5 Flash', isEnabled: true, priority: 2, apiKeyConfigured: hasGeminiKey },
      { category: 'image', name: 'dalle', displayName: 'DALL-E 3', isEnabled: false, priority: 3, apiKeyConfigured: false },
      { category: 'image', name: 'replicate', displayName: 'Replicate SDXL', isEnabled: false, priority: 4, apiKeyConfigured: false },
      
      // Voiceover Providers
      { category: 'voiceover', name: 'elevenlabs', displayName: 'ElevenLabs', isEnabled: true, priority: 1, apiKeyConfigured: !!process.env.ELEVENLABS_API_KEY },
      { category: 'voiceover', name: 'openai_tts', displayName: 'OpenAI TTS', isEnabled: false, priority: 2, apiKeyConfigured: false },
      
      // LLM Providers
      { category: 'llm', name: 'claude', displayName: 'Claude Sonnet 4', isEnabled: true, priority: 1, apiKeyConfigured: !!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY },
      { category: 'llm', name: 'gemini_llm', displayName: 'Gemini 2.5 Flash', isEnabled: false, priority: 2, apiKeyConfigured: hasGeminiKey },
    ];

    for (const provider of defaultProviders) {
      await this.createAiProvider(provider);
    }
  }

  // Video Projects (fixing interface requirement)
  async getVideoProjects(): Promise<VideoProject[]> {
    return this.getAllVideoProjects();
  }

  // Video Ingredients
  async getVideoIngredients(projectId: string): Promise<VideoIngredients | undefined> {
    const [result] = await db
      .select()
      .from(videoIngredients)
      .where(eq(videoIngredients.projectId, projectId));
    return result || undefined;
  }

  async getVideoIngredientsByClient(clientId: number): Promise<VideoIngredients[]> {
    return await db
      .select()
      .from(videoIngredients)
      .where(eq(videoIngredients.clientId, clientId))
      .orderBy(desc(videoIngredients.createdAt));
  }

  async getAllVideoIngredients(): Promise<VideoIngredients[]> {
    return await db
      .select()
      .from(videoIngredients)
      .orderBy(desc(videoIngredients.createdAt));
  }

  async createVideoIngredients(ingredients: InsertVideoIngredients): Promise<VideoIngredients> {
    const [result] = await db
      .insert(videoIngredients)
      .values(ingredients)
      .returning();
    return result;
  }

  async updateVideoIngredients(ingredientId: string, updates: Partial<InsertVideoIngredients>): Promise<VideoIngredients> {
    const [result] = await db
      .update(videoIngredients)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(videoIngredients.ingredientId, ingredientId))
      .returning();
    return result;
  }

  async deleteVideoIngredients(ingredientId: string): Promise<void> {
    await db
      .delete(videoIngredients)
      .where(eq(videoIngredients.ingredientId, ingredientId));
  }

  // Clear All Operations
  async clearAllGeneratedContent(): Promise<{ deletedCount: number }> {
    const result = await db.delete(generatedContent);
    return { deletedCount: result.rowCount || 0 };
  }

  async clearAllVideoProjects(): Promise<{ deletedCount: number }> {
    // Delete in order due to foreign key constraints
    await db.delete(audioTracks);
    await db.delete(videoClips);
    await db.delete(videoScenes);
    await db.delete(videoIngredients);
    const result = await db.delete(videoProjects);
    return { deletedCount: result.rowCount || 0 };
  }

  async clearAllApprovalQueue(): Promise<{ deletedCount: number }> {
    const result = await db.delete(approvalQueue);
    return { deletedCount: result.rowCount || 0 };
  }

  // Control Center
  async getControlEntities(): Promise<ControlEntity[]> {
    return await db
      .select()
      .from(controlEntities)
      .orderBy(controlEntities.category, controlEntities.priority);
  }

  async getControlEntity(slug: string): Promise<ControlEntity | undefined> {
    const [entity] = await db
      .select()
      .from(controlEntities)
      .where(eq(controlEntities.slug, slug));
    return entity || undefined;
  }

  async getControlEntitiesByCategory(category: string): Promise<ControlEntity[]> {
    return await db
      .select()
      .from(controlEntities)
      .where(eq(controlEntities.category, category))
      .orderBy(controlEntities.priority);
  }

  async createControlEntity(entity: InsertControlEntity): Promise<ControlEntity> {
    const [result] = await db.insert(controlEntities).values(entity).returning();
    return result;
  }

  async updateControlEntity(slug: string, updates: Partial<InsertControlEntity>): Promise<ControlEntity> {
    const [entity] = await db
      .update(controlEntities)
      .set({ ...updates, changedAt: new Date() })
      .where(eq(controlEntities.slug, slug))
      .returning();
    return entity;
  }

  async toggleControlEntity(slug: string, isEnabled: boolean, triggeredBy?: string): Promise<ControlEntity> {
    const existingEntity = await this.getControlEntity(slug);
    const previousState = existingEntity?.isEnabled;

    const [entity] = await db
      .update(controlEntities)
      .set({ 
        isEnabled, 
        lastChangedBy: triggeredBy || 'system',
        changedAt: new Date() 
      })
      .where(eq(controlEntities.slug, slug))
      .returning();

    await this.createControlEvent({
      entitySlug: slug,
      action: isEnabled ? 'enabled' : 'disabled',
      previousState,
      newState: isEnabled,
      triggeredBy: triggeredBy || 'system',
    });

    return entity;
  }

  async getControlEvents(limit?: number): Promise<ControlEvent[]> {
    const query = db
      .select()
      .from(controlEvents)
      .orderBy(desc(controlEvents.createdAt));
    
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async createControlEvent(event: InsertControlEvent): Promise<ControlEvent> {
    const [result] = await db.insert(controlEvents).values(event).returning();
    return result;
  }

  async initializeDefaultControlEntities(): Promise<void> {
    const existing = await this.getControlEntities();
    if (existing.length > 0) return;

    const defaultEntities: InsertControlEntity[] = [
      { slug: 'master-kill-switch', type: 'global', displayName: 'Master Kill Switch', description: 'Global emergency stop for all services', category: 'MASTER', isEnabled: true, priority: 0 },
      
      { slug: 'video-pipeline', type: 'pipeline', displayName: 'Video Pipeline', description: 'Main video generation pipeline', category: 'VIDEO', isEnabled: true, priority: 1 },
      { slug: 'veo31-provider', type: 'provider', displayName: 'Veo 3.1 Provider', description: 'Google Veo 3.1 video generation', category: 'VIDEO', isEnabled: true, priority: 2, dependsOn: JSON.stringify(['video-pipeline']) },
      { slug: 'runway-provider', type: 'provider', displayName: 'Runway Provider', description: 'Runway video generation', category: 'VIDEO', isEnabled: true, priority: 3, dependsOn: JSON.stringify(['video-pipeline']) },
      { slug: 'alibaba-wan-provider', type: 'provider', displayName: 'Alibaba WAN Provider', description: 'Alibaba WAN video generation', category: 'VIDEO', isEnabled: true, priority: 4, dependsOn: JSON.stringify(['video-pipeline']) },
      
      { slug: 'audio-pipeline', type: 'pipeline', displayName: 'Audio Pipeline', description: 'Main audio generation pipeline', category: 'AUDIO', isEnabled: true, priority: 1 },
      { slug: 'elevenlabs-provider', type: 'provider', displayName: 'ElevenLabs Provider', description: 'ElevenLabs voice synthesis', category: 'AUDIO', isEnabled: true, priority: 2, dependsOn: JSON.stringify(['audio-pipeline']) },
      
      { slug: 'content-pipeline', type: 'pipeline', displayName: 'Content Pipeline', description: 'Main content generation pipeline', category: 'CONTENT', isEnabled: true, priority: 1 },
      { slug: 'topic-agent', type: 'agent', displayName: 'Topic Agent', description: 'Topic research and selection', category: 'CONTENT', isEnabled: true, priority: 2, dependsOn: JSON.stringify(['content-pipeline']) },
      { slug: 'blog-agent', type: 'agent', displayName: 'Blog Agent', description: 'Blog post generation', category: 'CONTENT', isEnabled: true, priority: 3, dependsOn: JSON.stringify(['content-pipeline']) },
      { slug: 'social-agent', type: 'agent', displayName: 'Social Agent', description: 'Social media content generation', category: 'CONTENT', isEnabled: true, priority: 4, dependsOn: JSON.stringify(['content-pipeline']) },
      { slug: 'adcopy-agent', type: 'agent', displayName: 'AdCopy Agent', description: 'Advertisement copy generation', category: 'CONTENT', isEnabled: true, priority: 5, dependsOn: JSON.stringify(['content-pipeline']) },
      { slug: 'qa-agent', type: 'agent', displayName: 'QA Agent', description: 'Quality assurance and review', category: 'CONTENT', isEnabled: true, priority: 6, dependsOn: JSON.stringify(['content-pipeline']) },
      
      { slug: 'image-pipeline', type: 'pipeline', displayName: 'Image Pipeline', description: 'Main image generation pipeline', category: 'IMAGE', isEnabled: true, priority: 1 },
      { slug: 'gemini-image-provider', type: 'provider', displayName: 'Gemini Image Provider', description: 'Google Gemini image generation', category: 'IMAGE', isEnabled: true, priority: 2, dependsOn: JSON.stringify(['image-pipeline']) },
      { slug: 'alibaba-image-provider', type: 'provider', displayName: 'Alibaba Image Provider', description: 'Alibaba image generation', category: 'IMAGE', isEnabled: true, priority: 3, dependsOn: JSON.stringify(['image-pipeline']) },
    ];

    for (const entity of defaultEntities) {
      await this.createControlEntity(entity);
    }
  }

  async killAllServices(triggeredBy?: string): Promise<void> {
    await db
      .update(controlEntities)
      .set({ 
        isEnabled: false, 
        lastChangedBy: triggeredBy || 'system',
        changedAt: new Date() 
      });

    await this.createControlEvent({
      entitySlug: 'master-kill-switch',
      action: 'kill',
      previousState: true,
      newState: false,
      triggeredBy: triggeredBy || 'system',
      reason: 'Kill all services command executed',
    });
  }

  async resetAllServices(triggeredBy?: string): Promise<void> {
    await db
      .update(controlEntities)
      .set({ 
        isEnabled: true, 
        lastChangedBy: triggeredBy || 'system',
        changedAt: new Date() 
      });

    await this.createControlEvent({
      entitySlug: 'master-kill-switch',
      action: 'reset',
      previousState: false,
      newState: true,
      triggeredBy: triggeredBy || 'system',
      reason: 'Reset all services command executed',
    });
  }

  // Agent Metrics
  async recordAgentMetric(metric: InsertAgentMetric): Promise<AgentMetric> {
    const [result] = await db.insert(agentMetrics).values(metric).returning();
    return result;
  }

  async recordAgentMetrics(metrics: InsertAgentMetric[]): Promise<AgentMetric[]> {
    if (metrics.length === 0) return [];
    const results = await db.insert(agentMetrics).values(metrics).returning();
    return results;
  }

  async getAgentMetrics(
    agentSlug: string, 
    options?: { metricType?: string; startDate?: Date; endDate?: Date; limit?: number }
  ): Promise<AgentMetric[]> {
    const conditions = [eq(agentMetrics.agentSlug, agentSlug)];
    
    if (options?.metricType) {
      conditions.push(eq(agentMetrics.metricType, options.metricType));
    }
    if (options?.startDate) {
      conditions.push(gte(agentMetrics.recordedAt, options.startDate));
    }
    if (options?.endDate) {
      conditions.push(lte(agentMetrics.recordedAt, options.endDate));
    }

    const query = db
      .select()
      .from(agentMetrics)
      .where(and(...conditions))
      .orderBy(desc(agentMetrics.recordedAt));

    if (options?.limit) {
      return await query.limit(options.limit);
    }
    return await query;
  }

  async getLatestAgentMetrics(agentSlug: string): Promise<AgentMetric[]> {
    const result = await db
      .select()
      .from(agentMetrics)
      .where(eq(agentMetrics.agentSlug, agentSlug))
      .orderBy(desc(agentMetrics.recordedAt));
    
    const latestByType = new Map<string, AgentMetric>();
    for (const metric of result) {
      if (!latestByType.has(metric.metricType)) {
        latestByType.set(metric.metricType, metric);
      }
    }
    return Array.from(latestByType.values());
  }

  async getMetricsForAnomalyDetection(metricTypes: string[], hours: number = 24): Promise<AgentMetric[]> {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    return await db
      .select()
      .from(agentMetrics)
      .where(
        and(
          inArray(agentMetrics.metricType, metricTypes),
          gte(agentMetrics.recordedAt, startDate)
        )
      )
      .orderBy(agentMetrics.agentSlug, agentMetrics.metricType, desc(agentMetrics.recordedAt));
  }

  // Healing Alerts
  async createHealingAlert(alert: InsertHealingAlert): Promise<HealingAlert> {
    const [result] = await db.insert(healingAlerts).values(alert).returning();
    return result;
  }

  async getHealingAlerts(options?: { status?: string; agentSlug?: string; limit?: number }): Promise<HealingAlert[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    
    if (options?.status) {
      conditions.push(eq(healingAlerts.status, options.status));
    }
    if (options?.agentSlug) {
      conditions.push(eq(healingAlerts.agentSlug, options.agentSlug));
    }

    const query = conditions.length > 0 
      ? db.select().from(healingAlerts).where(and(...conditions)).orderBy(desc(healingAlerts.createdAt))
      : db.select().from(healingAlerts).orderBy(desc(healingAlerts.createdAt));

    if (options?.limit) {
      return await query.limit(options.limit);
    }
    return await query;
  }

  async getActiveHealingAlerts(): Promise<HealingAlert[]> {
    return await db
      .select()
      .from(healingAlerts)
      .where(eq(healingAlerts.status, 'active'))
      .orderBy(desc(healingAlerts.createdAt));
  }

  async acknowledgeHealingAlert(id: number, acknowledgedBy: string): Promise<HealingAlert> {
    const [result] = await db
      .update(healingAlerts)
      .set({ 
        status: 'acknowledged',
        resolvedBy: acknowledgedBy
      })
      .where(eq(healingAlerts.id, id))
      .returning();
    return result;
  }

  async resolveHealingAlert(id: number, resolvedBy: string): Promise<HealingAlert> {
    const [result] = await db
      .update(healingAlerts)
      .set({ 
        status: 'resolved',
        resolvedBy,
        resolvedAt: new Date()
      })
      .where(eq(healingAlerts.id, id))
      .returning();
    return result;
  }

  async dismissHealingAlert(id: number, dismissedBy: string): Promise<HealingAlert> {
    const [result] = await db
      .update(healingAlerts)
      .set({ 
        status: 'dismissed',
        resolvedBy: dismissedBy,
        resolvedAt: new Date()
      })
      .where(eq(healingAlerts.id, id))
      .returning();
    return result;
  }

  // Anomaly Models
  async getAnomalyModels(): Promise<AnomalyModel[]> {
    return await db
      .select()
      .from(anomalyModels)
      .orderBy(anomalyModels.modelName);
  }

  async getActiveAnomalyModel(metricType: string): Promise<AnomalyModel | undefined> {
    const results = await db
      .select()
      .from(anomalyModels)
      .where(eq(anomalyModels.isActive, true));
    
    for (const model of results) {
      try {
        const targetMetrics = JSON.parse(model.targetMetrics) as string[];
        if (targetMetrics.includes(metricType)) {
          return model;
        }
      } catch {
        continue;
      }
    }
    return undefined;
  }

  async updateAnomalyModel(id: number, updates: Partial<InsertAnomalyModel>): Promise<AnomalyModel> {
    const [result] = await db
      .update(anomalyModels)
      .set(updates)
      .where(eq(anomalyModels.id, id))
      .returning();
    return result;
  }

  async createAnomalyModel(model: InsertAnomalyModel): Promise<AnomalyModel> {
    const [result] = await db.insert(anomalyModels).values(model).returning();
    return result;
  }

  // Activity Logs
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [result] = await db.insert(activityLogs).values(log).returning();
    return result;
  }

  async getActivityLogs(options?: { runId?: string; limit?: number }): Promise<ActivityLog[]> {
    const { runId, limit = 100 } = options || {};
    
    if (runId) {
      return await db
        .select()
        .from(activityLogs)
        .where(eq(activityLogs.runId, runId))
        .orderBy(desc(activityLogs.createdAt))
        .limit(limit);
    }
    
    return await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async getRecentActivityLogs(limit: number = 50): Promise<ActivityLog[]> {
    return await db
      .select()
      .from(activityLogs)
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async clearActivityLogs(runId?: string): Promise<{ deletedCount: number }> {
    if (runId) {
      const result = await db.delete(activityLogs).where(eq(activityLogs.runId, runId));
      return { deletedCount: result.rowCount || 0 };
    }
    const result = await db.delete(activityLogs);
    return { deletedCount: result.rowCount || 0 };
  }

  // Brand Assets
  async getBrandAssets(clientId: number): Promise<BrandAssets | undefined> {
    const [result] = await db
      .select()
      .from(brandAssets)
      .where(eq(brandAssets.clientId, clientId));
    return result || undefined;
  }

  async getAllBrandAssets(): Promise<BrandAssets[]> {
    return await db
      .select()
      .from(brandAssets)
      .orderBy(desc(brandAssets.createdAt));
  }

  async createBrandAssets(assets: InsertBrandAssets): Promise<BrandAssets> {
    const [result] = await db.insert(brandAssets).values(assets).returning();
    return result;
  }

  async updateBrandAssets(clientId: number, updates: Partial<InsertBrandAssets>): Promise<BrandAssets> {
    const [result] = await db
      .update(brandAssets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(brandAssets.clientId, clientId))
      .returning();
    return result;
  }

  async deleteBrandAssets(clientId: number): Promise<void> {
    await db.delete(brandAssets).where(eq(brandAssets.clientId, clientId));
  }

  // Brand Asset Files
  async getBrandAssetFiles(clientId: number): Promise<BrandAssetFile[]> {
    return await db
      .select()
      .from(brandAssetFiles)
      .where(eq(brandAssetFiles.clientId, clientId))
      .orderBy(brandAssetFiles.category, brandAssetFiles.uploadedAt);
  }

  async getBrandAssetFilesByCategory(clientId: number, category: string): Promise<BrandAssetFile[]> {
    return await db
      .select()
      .from(brandAssetFiles)
      .where(and(
        eq(brandAssetFiles.clientId, clientId),
        eq(brandAssetFiles.category, category)
      ))
      .orderBy(brandAssetFiles.uploadedAt);
  }

  async getBrandAssetFilesByPurpose(clientId: number, purpose: string): Promise<BrandAssetFile | undefined> {
    const [result] = await db
      .select()
      .from(brandAssetFiles)
      .where(and(
        eq(brandAssetFiles.clientId, clientId),
        eq(brandAssetFiles.purpose, purpose)
      ));
    return result || undefined;
  }

  async getBrandAssetFile(id: number): Promise<BrandAssetFile | undefined> {
    const [result] = await db
      .select()
      .from(brandAssetFiles)
      .where(eq(brandAssetFiles.id, id));
    return result || undefined;
  }

  async createBrandAssetFile(file: InsertBrandAssetFile): Promise<BrandAssetFile> {
    const [result] = await db.insert(brandAssetFiles).values(file).returning();
    return result;
  }

  async updateBrandAssetFile(id: number, updates: Partial<InsertBrandAssetFile>): Promise<BrandAssetFile> {
    const [result] = await db
      .update(brandAssetFiles)
      .set(updates)
      .where(eq(brandAssetFiles.id, id))
      .returning();
    return result;
  }

  async deleteBrandAssetFile(id: number): Promise<void> {
    await db.delete(brandAssetFiles).where(eq(brandAssetFiles.id, id));
  }

  async deleteBrandAssetFilesByClient(clientId: number): Promise<{ deletedCount: number }> {
    const result = await db.delete(brandAssetFiles).where(eq(brandAssetFiles.clientId, clientId));
    return { deletedCount: result.rowCount || 0 };
  }

  // Quality Reviews
  async createQualityReview(review: InsertContentQualityReview): Promise<ContentQualityReview> {
    const [result] = await db.insert(contentQualityReviews).values(review).returning();
    return result;
  }

  async getQualityReview(reviewId: string): Promise<ContentQualityReview | undefined> {
    const [result] = await db
      .select()
      .from(contentQualityReviews)
      .where(eq(contentQualityReviews.reviewId, reviewId));
    return result || undefined;
  }

  async getQualityReviewsForContent(contentType: string, contentId: string): Promise<ContentQualityReview[]> {
    return await db
      .select()
      .from(contentQualityReviews)
      .where(and(
        eq(contentQualityReviews.contentType, contentType),
        eq(contentQualityReviews.contentId, contentId)
      ))
      .orderBy(desc(contentQualityReviews.createdAt));
  }

  async getQualityReviewsByProvider(providerName: string, limit: number = 50): Promise<ContentQualityReview[]> {
    return await db
      .select()
      .from(contentQualityReviews)
      .where(eq(contentQualityReviews.providerUsed, providerName))
      .orderBy(desc(contentQualityReviews.createdAt))
      .limit(limit);
  }

  async getRecentQualityReviews(limit: number = 50): Promise<ContentQualityReview[]> {
    return await db
      .select()
      .from(contentQualityReviews)
      .orderBy(desc(contentQualityReviews.createdAt))
      .limit(limit);
  }

  // Quality Metrics
  async createQualityMetric(metric: InsertContentQualityMetric): Promise<ContentQualityMetric> {
    const [result] = await db.insert(contentQualityMetrics).values(metric).returning();
    return result;
  }

  async getQualityMetric(metricId: string): Promise<ContentQualityMetric | undefined> {
    const [result] = await db
      .select()
      .from(contentQualityMetrics)
      .where(eq(contentQualityMetrics.metricId, metricId));
    return result || undefined;
  }

  async getQualityMetricsForContent(contentType: string, contentId: string): Promise<ContentQualityMetric[]> {
    return await db
      .select()
      .from(contentQualityMetrics)
      .where(and(
        eq(contentQualityMetrics.contentType, contentType),
        eq(contentQualityMetrics.contentId, contentId)
      ))
      .orderBy(desc(contentQualityMetrics.analyzedAt));
  }

  async getQualityMetricsByProvider(providerName: string, limit: number = 50): Promise<ContentQualityMetric[]> {
    return await db
      .select()
      .from(contentQualityMetrics)
      .where(eq(contentQualityMetrics.providerUsed, providerName))
      .orderBy(desc(contentQualityMetrics.analyzedAt))
      .limit(limit);
  }

  // Provider Quality Scores
  async getProviderQualityScore(providerName: string, serviceType: string): Promise<ProviderQualityScore | undefined> {
    const [result] = await db
      .select()
      .from(providerQualityScores)
      .where(and(
        eq(providerQualityScores.providerName, providerName),
        eq(providerQualityScores.serviceType, serviceType)
      ));
    return result || undefined;
  }

  async getAllProviderQualityScores(): Promise<ProviderQualityScore[]> {
    return await db
      .select()
      .from(providerQualityScores)
      .orderBy(desc(providerQualityScores.avgQualityScore));
  }

  async createProviderQualityScore(score: InsertProviderQualityScore): Promise<ProviderQualityScore> {
    const [result] = await db.insert(providerQualityScores).values(score).returning();
    return result;
  }

  async updateProviderQualityScore(providerName: string, serviceType: string, updates: Partial<InsertProviderQualityScore>): Promise<ProviderQualityScore> {
    const [result] = await db
      .update(providerQualityScores)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(
        eq(providerQualityScores.providerName, providerName),
        eq(providerQualityScores.serviceType, serviceType)
      ))
      .returning();
    return result;
  }

  async initializeProviderQualityScores(): Promise<void> {
    const providers = [
      { providerName: 'veo31', serviceType: 'video' },
      { providerName: 'runway', serviceType: 'video' },
      { providerName: 'gemini_image', serviceType: 'image' },
      { providerName: 'adobe_firefly', serviceType: 'image' },
      { providerName: 'fal_ai', serviceType: 'image' },
      { providerName: 'dashscope', serviceType: 'image' },
      { providerName: 'elevenlabs', serviceType: 'audio' },
      { providerName: 'openai_tts', serviceType: 'audio' },
      { providerName: 'anthropic', serviceType: 'text' },
      { providerName: 'gemini_text', serviceType: 'text' },
      { providerName: 'openrouter_deepseek_r1', serviceType: 'text' },
      { providerName: 'openrouter_llama4_maverick', serviceType: 'text' },
      { providerName: 'openrouter_mistral_small', serviceType: 'text' },
    ];

    for (const provider of providers) {
      const existing = await this.getProviderQualityScore(provider.providerName, provider.serviceType);
      if (!existing) {
        await this.createProviderQualityScore({
          providerName: provider.providerName,
          serviceType: provider.serviceType,
          avgQualityScore: "50",
          acceptanceRate: "100",
          qualityHealthScore: "50",
          qualityWeight: "0.5",
        });
      }
    }
  }

  // Quality Tier Configs
  async getQualityTierConfig(tierName: string): Promise<QualityTierConfig | undefined> {
    const [result] = await db
      .select()
      .from(qualityTierConfigs)
      .where(eq(qualityTierConfigs.tierName, tierName));
    return result || undefined;
  }

  async getAllQualityTierConfigs(): Promise<QualityTierConfig[]> {
    return await db
      .select()
      .from(qualityTierConfigs)
      .orderBy(qualityTierConfigs.minQualityScore);
  }

  async createQualityTierConfig(config: InsertQualityTierConfig): Promise<QualityTierConfig> {
    const [result] = await db.insert(qualityTierConfigs).values(config).returning();
    return result;
  }

  async updateQualityTierConfig(tierName: string, updates: Partial<InsertQualityTierConfig>): Promise<QualityTierConfig> {
    const [result] = await db
      .update(qualityTierConfigs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(qualityTierConfigs.tierName, tierName))
      .returning();
    return result;
  }

  async initializeDefaultQualityTiers(): Promise<void> {
    const tiers: InsertQualityTierConfig[] = [
      {
        tierName: 'draft',
        displayName: 'Draft (Fast)',
        description: 'Quick preview quality. Prioritizes speed and cost over visual quality. Good for rapid iteration.',
        targetResolution: '720p',
        minBitrate: 2000,
        minFrameRate: 24,
        minQualityScore: 30,
        minCoherenceScore: 40,
        minAestheticScore: 30,
        maxRetries: 2,
        prioritizeFree: true,
        qualityWeightOverride: "0.3",
        isActive: true,
      },
      {
        tierName: 'production',
        displayName: 'Production (Balanced)',
        description: 'Production-ready quality. Balanced between quality, speed, and cost. Suitable for most content.',
        targetResolution: '1080p',
        minBitrate: 5000,
        minFrameRate: 30,
        minQualityScore: 60,
        minCoherenceScore: 65,
        minAestheticScore: 55,
        maxRetries: 3,
        prioritizeFree: false,
        qualityWeightOverride: "0.5",
        isActive: true,
      },
      {
        tierName: 'cinematic_4k',
        displayName: 'Cinematic 4K (Premium)',
        description: 'Maximum quality for flagship content. Prioritizes visual excellence over speed and cost.',
        targetResolution: '4k',
        minBitrate: 15000,
        minFrameRate: 30,
        minQualityScore: 80,
        minCoherenceScore: 80,
        minAestheticScore: 75,
        maxRetries: 5,
        autoUpgradeOnFailure: true,
        prioritizeFree: false,
        qualityWeightOverride: "0.7",
        isActive: true,
      },
    ];

    for (const tier of tiers) {
      const existing = await this.getQualityTierConfig(tier.tierName);
      if (!existing) {
        await this.createQualityTierConfig(tier);
      }
    }
  }

  // Quality Feedback Loop
  async createQualityFeedback(feedback: InsertQualityFeedbackLoop): Promise<QualityFeedbackLoop> {
    const [result] = await db.insert(qualityFeedbackLoop).values(feedback).returning();
    return result;
  }

  async getRecentQualityFeedback(limit: number = 50): Promise<QualityFeedbackLoop[]> {
    return await db
      .select()
      .from(qualityFeedbackLoop)
      .orderBy(desc(qualityFeedbackLoop.createdAt))
      .limit(limit);
  }

  async getQualityFeedbackByProvider(providerName: string, limit: number = 50): Promise<QualityFeedbackLoop[]> {
    return await db
      .select()
      .from(qualityFeedbackLoop)
      .where(eq(qualityFeedbackLoop.providerName, providerName))
      .orderBy(desc(qualityFeedbackLoop.createdAt))
      .limit(limit);
  }
}

export const storage = new DatabaseStorage();
