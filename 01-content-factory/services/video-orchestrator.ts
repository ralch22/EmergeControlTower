import { randomBytes } from 'crypto';
import { generateTextWithFallback } from './text-generation';
import type { BrandProfileJSON } from '../../shared/schema';

function generateId(): string {
  return randomBytes(8).toString('hex');
}
import { healthMonitor } from './provider-health-monitor';
import type { QualityTier } from '../../shared/schema';
import type { IStorage } from '../../server/storage';

// Helper to build brand visual context for video prompts
function buildBrandVisualContext(brandProfile: BrandProfileJSON | null): string {
  if (!brandProfile?.visual) return '';
  
  const visual = brandProfile.visual;
  const parts: string[] = [];
  
  // Color palette - check darkMode first, fallback to lightMode
  const colorPalette = visual.colorPalette?.darkMode || visual.colorPalette?.lightMode;
  if (colorPalette) {
    const colorList: string[] = [];
    if (colorPalette.background?.hex) colorList.push(`background: ${colorPalette.background.hex}`);
    if (colorPalette.accent?.hex) colorList.push(`accent: ${colorPalette.accent.hex}`);
    if (colorPalette.textPrimary?.hex) colorList.push(`text: ${colorPalette.textPrimary.hex}`);
    if (colorList.length > 0) {
      parts.push(`Brand Colors: ${colorList.join(', ')}`);
    }
  }
  
  // Visual style
  if (visual.visualStyle) {
    if (visual.visualStyle.aesthetic?.length) {
      parts.push(`Visual Aesthetic: ${visual.visualStyle.aesthetic.join(', ')}`);
    }
    if (visual.visualStyle.moodKeywords?.length) {
      parts.push(`Mood: ${visual.visualStyle.moodKeywords.join(', ')}`);
    }
    if (visual.visualStyle.motifs?.length) {
      parts.push(`Visual Motifs: ${visual.visualStyle.motifs.join(', ')}`);
    }
    if (visual.visualStyle.patterns?.length) {
      parts.push(`Patterns: ${visual.visualStyle.patterns.join(', ')}`);
    }
  }
  
  // Cinematic guidelines
  if (visual.cinematicGuidelines) {
    const cine = visual.cinematicGuidelines;
    if (cine.motionStyle) parts.push(`Motion Style: ${cine.motionStyle}`);
    if (cine.colorGrading) parts.push(`Color Grading: ${cine.colorGrading}`);
    if (cine.pacing) parts.push(`Pacing: ${cine.pacing}`);
    if (cine.transitionStyle) parts.push(`Transitions: ${cine.transitionStyle}`);
  }
  
  return parts.length > 0 ? `\n\n**Brand Visual Guidelines:**\n${parts.join('\n')}` : '';
}

export interface FullVideoRequest {
  topic: string;
  clientId?: number;
  clientName?: string;
  brandVoice?: string;
  brandProfile?: BrandProfileJSON | null;
  targetAudience?: string;
  duration?: number;
  format?: 'short' | 'medium' | 'long';
  style?: 'talking_head' | 'b_roll' | 'animated' | 'mixed';
  aspectRatio?: '16:9' | '9:16' | '1:1';
  voiceStyle?: 'professional_male' | 'professional_female' | 'friendly_male' | 'friendly_female';
  enableAutoRetry?: boolean;
  maxRetries?: number;
  qualityTier?: QualityTier;
  targetResolution?: '720p' | '1080p' | '4k';
  isPremiumClient?: boolean;
}

export interface VideoOrchestratorResult {
  success: boolean;
  projectId?: string;
  status?: 'generating' | 'completed' | 'failed';
  message?: string;
  error?: string;
  stages?: {
    script?: { status: string; provider?: string };
    scenes?: { status: string; count?: number };
    clips?: { status: string; completed?: number; total?: number };
    voiceover?: { status: string; completed?: number; total?: number };
    assembly?: { status: string; videoUrl?: string };
  };
}

const VIDEO_SCRIPT_SYSTEM_PROMPT = `You are a video content strategist and scriptwriter. You create engaging video scripts optimized for social media and professional content.

You understand pacing, hooks, visual storytelling, and platform-specific formats. Create scripts that are easy to produce and highly engaging.

IMPORTANT: Output ONLY valid JSON, no markdown formatting or explanation.`;

export async function generateVideoScriptFromTopic(
  topic: string,
  options: Partial<FullVideoRequest> = {}
): Promise<{ success: boolean; script?: any; error?: string; provider?: string }> {
  const {
    clientName = 'Client',
    brandVoice = 'professional and engaging',
    brandProfile = null,
    targetAudience = 'business professionals',
    duration = 60,
    format = 'short',
    style = 'mixed',
  } = options;

  // Build brand visual context from profile
  const brandVisualContext = buildBrandVisualContext(brandProfile);

  const userPrompt = `Create a video script for ${clientName}.

**Topic:** ${topic}
**Target Audience:** ${targetAudience}
**Brand Voice:** ${brandVoice}
${brandVisualContext}

**Video Requirements:**
- Duration: ${duration} seconds
- Format: ${format} (${format === 'short' ? '15-60s' : format === 'medium' ? '1-3 min' : '3-10 min'})
- Style: ${style}

Create a complete video script. IMPORTANT: All visual descriptions MUST incorporate the brand visual guidelines above (colors, motifs, aesthetic, mood). Output ONLY valid JSON with this exact structure:
{
  "hook": "Opening line that hooks viewers (first 3 seconds)",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": 5,
      "visualDescription": "Detailed description incorporating brand colors, motifs, and aesthetic",
      "voiceover": "What is said during this scene",
      "textOverlay": "Optional text shown on screen"
    }
  ],
  "callToAction": "Final CTA",
  "duration": ${duration},
  "voiceoverText": "Complete voiceover script for entire video"
}`;

  console.log(`[VideoOrchestrator] Generating script for topic: ${topic}`);
  
  const result = await generateTextWithFallback(userPrompt, {
    systemPrompt: VIDEO_SCRIPT_SYSTEM_PROMPT,
    maxTokens: 4000,
    temperature: 0.7,
    fallbackChain: 'default',
  });

  if (!result.success || !result.content) {
    return { success: false, error: result.error || 'Failed to generate script' };
  }

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'Failed to parse video script JSON from response' };
    }
    
    const script = JSON.parse(jsonMatch[0]);
    console.log(`[VideoOrchestrator] Script generated with ${script.scenes?.length || 0} scenes using ${result.provider}`);
    
    return { success: true, script, provider: result.provider };
  } catch (error: any) {
    return { success: false, error: `JSON parse error: ${error.message}` };
  }
}

export async function createVideoProjectFromScript(
  script: any,
  options: Partial<FullVideoRequest>,
  storage: IStorage
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  try {
    const projectId = `proj_${generateId()}`;
    const title = options.topic || script.hook?.substring(0, 50) || 'Video Project';
    
    // Determine quality tier based on options or client requirements
    const qualityTier = options.qualityTier || 
      healthMonitor.getRecommendedTier({
        targetResolution: options.targetResolution,
        isPremiumClient: options.isPremiumClient,
        budget: options.isPremiumClient ? 'high' : 'medium',
      });

    const targetResolution = options.targetResolution || 
      (qualityTier === 'cinematic_4k' ? '4k' : '1080p');
    
    // Build brand visual suffix to append to visual prompts
    const brandProfile = options.brandProfile;
    let brandVisualSuffix = '';
    if (brandProfile?.visual) {
      const parts: string[] = [];
      // Check darkMode first, fallback to lightMode for colors
      const colorPalette = brandProfile.visual.colorPalette?.darkMode || brandProfile.visual.colorPalette?.lightMode;
      if (colorPalette?.accent?.hex) {
        parts.push(`Use accent color ${colorPalette.accent.hex}`);
      }
      if (colorPalette?.background?.hex) {
        parts.push(`Background tone: ${colorPalette.background.hex}`);
      }
      if (brandProfile.visual.visualStyle?.aesthetic?.length) {
        parts.push(`Style: ${brandProfile.visual.visualStyle.aesthetic.join(', ')}`);
      }
      if (brandProfile.visual.visualStyle?.motifs?.length) {
        parts.push(`Include motifs: ${brandProfile.visual.visualStyle.motifs.join(', ')}`);
      }
      if (brandProfile.visual.cinematicGuidelines?.colorGrading) {
        parts.push(`Color grading: ${brandProfile.visual.cinematicGuidelines.colorGrading}`);
      }
      if (parts.length > 0) {
        brandVisualSuffix = ` BRAND REQUIREMENTS: ${parts.join('. ')}.`;
      }
    }
    
    const metadata = {
      autoGenerated: true,
      topic: options.topic,
      clientId: options.clientId,
      clientName: options.clientName,
      brandVoice: options.brandVoice,
      brandProfileId: brandProfile ? 'cached' : undefined,
      aspectRatio: options.aspectRatio || '16:9',
      enableAutoRetry: options.enableAutoRetry !== false,
      maxRetries: options.maxRetries || 3,
      qualityTier,
      targetResolution,
      isPremiumClient: options.isPremiumClient || false,
    };
    
    await storage.createVideoProject({
      projectId,
      clientId: options.clientId || 1,
      title,
      description: JSON.stringify(metadata),
      status: 'draft',
      totalDuration: script.duration || options.duration || 60,
      qualityTier,
      targetResolution,
    });
    
    for (const scene of script.scenes || []) {
      const sceneId = `scene_${projectId}_${scene.sceneNumber}`;
      
      // Build visual prompt with brand guidelines - always include brand context
      let enhancedVisualPrompt: string;
      if (scene.visualDescription) {
        // Append brand requirements to existing description
        enhancedVisualPrompt = scene.visualDescription + brandVisualSuffix;
      } else if (brandVisualSuffix) {
        // No description but have brand context - create minimal prompt with brand requirements
        enhancedVisualPrompt = `Scene ${scene.sceneNumber} visual.${brandVisualSuffix}`;
      } else {
        // No description and no brand context - use fallback
        enhancedVisualPrompt = `Scene ${scene.sceneNumber} visual. Professional, modern style.`;
      }
      
      await storage.createVideoScene({
        sceneId,
        projectId,
        sceneNumber: scene.sceneNumber,
        title: `Scene ${scene.sceneNumber}`,
        duration: scene.duration || 5,
        visualPrompt: enhancedVisualPrompt,
        voiceoverText: scene.voiceover,
        status: 'pending',
      });
      
      const clipId = `clip_${sceneId}`;
      await storage.createVideoClip({
        projectId,
        clipId,
        sceneId,
        provider: undefined,
        status: 'pending',
        duration: scene.duration || 5,
      });
      
      if (scene.voiceover) {
        const trackId = `audio_${sceneId}`;
        await storage.createAudioTrack({
          trackId,
          sceneId,
          projectId,
          type: 'voiceover',
          provider: undefined,
          status: 'pending',
          duration: scene.duration || 5,
        });
      }
    }
    
    console.log(`[VideoOrchestrator] Created project ${projectId} with ${script.scenes?.length || 0} scenes`);
    return { success: true, projectId };
    
  } catch (error: any) {
    console.error(`[VideoOrchestrator] Failed to create project:`, error);
    return { success: false, error: error.message };
  }
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context?: { providerName?: string; sceneId?: string }
): Promise<{ success: boolean; result?: T; attempts: number; error?: string }> {
  const { maxRetries, baseDelayMs, maxDelayMs, backoffMultiplier } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  };

  let lastError = '';
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[Retry] Attempt ${attempt}/${maxRetries}${context?.sceneId ? ` for ${context.sceneId}` : ''}`);
      
      const result = await operation();
      
      return { success: true, result, attempts: attempt };
      
    } catch (error: any) {
      lastError = error.message || 'Unknown error';
      console.log(`[Retry] Attempt ${attempt} failed: ${lastError}`);
      
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(backoffMultiplier, attempt - 1), maxDelayMs);
        console.log(`[Retry] Waiting ${delay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  return { success: false, attempts: maxRetries, error: lastError };
}

export async function generateFullVideoFromTopic(
  request: FullVideoRequest,
  storage: IStorage
): Promise<VideoOrchestratorResult> {
  const stages: VideoOrchestratorResult['stages'] = {};
  
  try {
    console.log(`[VideoOrchestrator] Starting full video generation for topic: ${request.topic}`);
    
    stages.script = { status: 'generating' };
    const scriptResult = await generateVideoScriptFromTopic(request.topic, request);
    
    if (!scriptResult.success || !scriptResult.script) {
      stages.script = { status: 'failed' };
      return {
        success: false,
        status: 'failed',
        error: scriptResult.error || 'Script generation failed',
        stages,
      };
    }
    
    stages.script = { status: 'completed', provider: scriptResult.provider };
    console.log(`[VideoOrchestrator] Script generated successfully`);
    
    stages.scenes = { status: 'creating' };
    const projectResult = await createVideoProjectFromScript(scriptResult.script, request, storage);
    
    if (!projectResult.success || !projectResult.projectId) {
      stages.scenes = { status: 'failed' };
      return {
        success: false,
        status: 'failed',
        error: projectResult.error || 'Failed to create video project',
        stages,
      };
    }
    
    stages.scenes = { status: 'created', count: scriptResult.script.scenes?.length || 0 };
    
    await storage.updateVideoProject(projectResult.projectId, { status: 'generating' });
    
    await storage.createActivityLog({
      runId: `video_full_${projectResult.projectId}`,
      eventType: 'full_video_generation_started',
      level: 'info',
      message: `Full video generation started for topic: ${request.topic}`,
      metadata: JSON.stringify({
        projectId: projectResult.projectId,
        topic: request.topic,
        sceneCount: scriptResult.script.scenes?.length || 0,
        enableAutoRetry: request.enableAutoRetry !== false,
      }),
    });
    
    stages.clips = { status: 'pending', completed: 0, total: scriptResult.script.scenes?.length || 0 };
    stages.voiceover = { status: 'pending', completed: 0, total: scriptResult.script.scenes?.length || 0 };
    stages.assembly = { status: 'pending' };
    
    return {
      success: true,
      projectId: projectResult.projectId,
      status: 'generating',
      message: `Video project created and generation started. Project ID: ${projectResult.projectId}`,
      stages,
    };
    
  } catch (error: any) {
    console.error(`[VideoOrchestrator] Full video generation failed:`, error);
    return {
      success: false,
      status: 'failed',
      error: error.message || 'Unknown error during video generation',
      stages,
    };
  }
}

export async function retryFailedScenes(
  projectId: string,
  storage: IStorage,
  options: { maxRetries?: number; rotateProviders?: boolean } = {}
): Promise<{ success: boolean; retriedScenes: number; stillFailed: number; error?: string }> {
  const { maxRetries = 3, rotateProviders = true } = options;
  
  try {
    const fullProject = await storage.getFullVideoProject(projectId);
    if (!fullProject) {
      return { success: false, retriedScenes: 0, stillFailed: 0, error: 'Project not found' };
    }
    
    const failedScenes = fullProject.scenes.filter(s => s.status === 'failed');
    const failedClips = fullProject.clips.filter(c => c.status === 'failed');
    const failedAudio = fullProject.audioTracks.filter(a => a.status === 'failed');
    
    if (failedScenes.length === 0 && failedClips.length === 0 && failedAudio.length === 0) {
      return { success: true, retriedScenes: 0, stillFailed: 0 };
    }
    
    console.log(`[VideoOrchestrator] Retrying ${failedScenes.length} failed scenes, ${failedClips.length} failed clips, ${failedAudio.length} failed audio`);
    
    for (const scene of failedScenes) {
      await storage.updateVideoScene(scene.sceneId, { status: 'pending' });
    }
    
    for (const clip of failedClips) {
      const updates: any = { status: 'pending', errorMessage: null };
      
      if (rotateProviders && clip.provider) {
        const providers = await healthMonitor.getSmartProviderOrder('video');
        const currentIdx = providers.findIndex(p => p === clip.provider);
        if (currentIdx >= 0 && currentIdx < providers.length - 1) {
          console.log(`[VideoOrchestrator] Rotating provider for clip ${clip.clipId}: ${clip.provider} → next in chain`);
        }
      }
      
      await storage.updateVideoClip(clip.clipId, updates);
    }
    
    for (const audio of failedAudio) {
      await storage.updateAudioTrack(audio.trackId, { status: 'pending', errorMessage: null });
    }
    
    await storage.updateVideoProject(projectId, { status: 'generating' });
    
    await storage.createActivityLog({
      runId: `video_retry_${projectId}`,
      eventType: 'auto_retry_triggered',
      level: 'info',
      message: `Auto-retry triggered for ${failedScenes.length} scenes`,
      metadata: JSON.stringify({
        projectId,
        failedScenes: failedScenes.length,
        failedClips: failedClips.length,
        failedAudio: failedAudio.length,
        maxRetries,
        rotateProviders,
      }),
    });
    
    return {
      success: true,
      retriedScenes: failedScenes.length,
      stillFailed: 0,
    };
    
  } catch (error: any) {
    console.error(`[VideoOrchestrator] Retry failed:`, error);
    return { success: false, retriedScenes: 0, stillFailed: 0, error: error.message };
  }
}

export async function checkAndAutoRetry(
  projectId: string,
  storage: IStorage
): Promise<boolean> {
  try {
    const fullProject = await storage.getFullVideoProject(projectId);
    if (!fullProject) return false;
    
    let metadata: any = {};
    try {
      metadata = fullProject.project.description ? JSON.parse(fullProject.project.description) : {};
    } catch {
      metadata = {};
    }
    
    if (!metadata.enableAutoRetry) return false;
    
    const maxRetries = metadata.maxRetries || 3;
    const currentRetries = metadata.retryCount || 0;
    
    if (currentRetries >= maxRetries) {
      console.log(`[VideoOrchestrator] Max retries (${maxRetries}) reached for project ${projectId}`);
      return false;
    }
    
    const failedScenes = fullProject.scenes.filter(s => s.status === 'failed');
    const failedClips = fullProject.clips.filter(c => c.status === 'failed');
    
    if (failedScenes.length === 0 && failedClips.length === 0) {
      return false;
    }
    
    console.log(`[VideoOrchestrator] Auto-retry ${currentRetries + 1}/${maxRetries} for project ${projectId}`);
    
    await storage.updateVideoProject(projectId, {
      description: JSON.stringify({
        ...metadata,
        retryCount: currentRetries + 1,
        lastRetryAt: new Date().toISOString(),
      }),
    });
    
    await retryFailedScenes(projectId, storage, { rotateProviders: true });
    
    return true;
    
  } catch (error: any) {
    console.error(`[VideoOrchestrator] Auto-retry check failed:`, error);
    return false;
  }
}
