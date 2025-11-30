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
  aiProviders
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

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

  // Content Runs
  getContentRuns(): Promise<ContentRun[]>;
  getContentRun(runId: string): Promise<ContentRun | undefined>;
  createContentRun(run: InsertContentRun): Promise<ContentRun>;
  updateContentRun(runId: string, updates: Partial<InsertContentRun>): Promise<ContentRun>;

  // Generated Content
  getGeneratedContent(runId: string): Promise<GeneratedContentRecord[]>;
  getGeneratedContentByClient(clientId: number): Promise<GeneratedContentRecord[]>;
  getAllGeneratedContent(): Promise<GeneratedContentRecord[]>;
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
    const [client] = await db.insert(clients).values(insertClient).returning();
    return client;
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

  // Generated Content
  async getGeneratedContent(runId: string): Promise<GeneratedContentRecord[]> {
    return await db
      .select()
      .from(generatedContent)
      .where(eq(generatedContent.runId, runId))
      .orderBy(desc(generatedContent.createdAt));
  }

  async getGeneratedContentByClient(clientId: number): Promise<GeneratedContentRecord[]> {
    return await db
      .select()
      .from(generatedContent)
      .where(eq(generatedContent.clientId, clientId))
      .orderBy(desc(generatedContent.createdAt));
  }

  async getAllGeneratedContent(): Promise<GeneratedContentRecord[]> {
    return await db
      .select()
      .from(generatedContent)
      .orderBy(desc(generatedContent.createdAt));
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
      // Video Providers - Veo 3.1 Fast is primary (native audio, Ultra tier), Runway as fallback
      { category: 'video', name: 'veo31', displayName: 'Veo 3.1 Fast', isEnabled: true, priority: 1, apiKeyConfigured: hasGeminiKey },
      { category: 'video', name: 'runway', displayName: 'Runway Gen-3', isEnabled: true, priority: 2, apiKeyConfigured: !!process.env.RUNWAY_API_KEY },
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
}

export const storage = new DatabaseStorage();
