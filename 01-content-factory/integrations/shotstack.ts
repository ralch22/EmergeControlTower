import type { VideoProject, VideoScene, VideoClip, AudioTrack } from '../../shared/schema';

const SHOTSTACK_STAGE_URL = "https://api.shotstack.io/stage";
const SHOTSTACK_V1_URL = "https://api.shotstack.io/v1";

function getApiUrl(): string {
  const useProduction = process.env.SHOTSTACK_USE_PRODUCTION === 'true';
  return useProduction ? SHOTSTACK_V1_URL : SHOTSTACK_STAGE_URL;
}

export interface ShotstackClip {
  asset: {
    type: 'video' | 'audio' | 'image' | 'title' | 'html';
    src?: string;
    text?: string;
    trim?: number;
    volume?: number;
    html?: string;
    css?: string;
    width?: number;
    height?: number;
  };
  start: number;
  length: number;
  effect?: string;
  transition?: {
    in?: string;
    out?: string;
  };
  fit?: 'cover' | 'contain' | 'crop' | 'none';
  position?: 'top' | 'topRight' | 'right' | 'bottomRight' | 'bottom' | 'bottomLeft' | 'left' | 'topLeft' | 'center';
  offset?: {
    x?: number;
    y?: number;
  };
  opacity?: number;
  scale?: number;
}

export interface ShotstackTrack {
  clips: ShotstackClip[];
}

export interface ShotstackTimeline {
  soundtrack?: {
    src: string;
    effect?: string;
    volume?: number;
  };
  tracks: ShotstackTrack[];
  background?: string;
  fonts?: Array<{
    src: string;
  }>;
}

export interface ShotstackEdit {
  timeline: ShotstackTimeline;
  output: {
    format: 'mp4' | 'gif' | 'mp3';
    resolution: 'sd' | 'hd' | '1080' | '4k';
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5' | '4:3';
    fps?: number;
    quality?: 'low' | 'medium' | 'high';
  };
  callback?: string;
}

export interface ShotstackRenderResult {
  success: boolean;
  renderId?: string;
  videoUrl?: string;
  status?: 'queued' | 'fetching' | 'rendering' | 'saving' | 'done' | 'failed';
  error?: string;
  isMock?: boolean;
}

export interface AssembleVideoOptions {
  resolution?: 'sd' | 'hd' | '1080' | '4k';
  aspectRatio?: '16:9' | '9:16' | '1:1';
  fps?: number;
  backgroundMusicVolume?: number;
  voiceoverVolume?: number;
  transitions?: 'fade' | 'cut' | 'dissolve' | 'none';
  backgroundColor?: string;
}

export interface TextOverlay {
  text: string;
  startTime: number;
  duration: number;
  position?: 'top' | 'center' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  style?: 'title' | 'subtitle' | 'caption' | 'cta';
  fontSize?: number;
  color?: string;
}

function generateMockRenderId(): string {
  return `mock-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function getMockVideoUrl(projectId: string): string {
  return `https://cdn.shotstack.io/mock/output/${projectId}/final-video.mp4`;
}

export async function renderVideo(edit: ShotstackEdit): Promise<ShotstackRenderResult> {
  const apiKey = process.env.SHOTSTACK_API_KEY;
  const apiUrl = getApiUrl();
  
  if (!apiKey) {
    console.log("[Shotstack] No API key configured, returning mock success");
    const mockRenderId = generateMockRenderId();
    return {
      success: true,
      renderId: mockRenderId,
      status: 'queued',
      isMock: true,
    };
  }

  try {
    console.log("[Shotstack] Submitting render job...");
    
    const response = await fetch(`${apiUrl}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(edit),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Shotstack] API error:", response.status, errorText);
      return {
        success: false,
        error: `Shotstack API error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();
    const renderId = result.response?.id;
    
    if (renderId) {
      console.log(`[Shotstack] Render job queued: ${renderId}`);
      return {
        success: true,
        renderId,
        status: 'queued',
      };
    }

    return {
      success: false,
      error: "No render ID returned",
    };
  } catch (error: any) {
    console.error("[Shotstack] Render error:", error);
    return {
      success: false,
      error: error.message || "Failed to start render",
    };
  }
}

export async function checkRenderStatus(renderId: string): Promise<ShotstackRenderResult> {
  if (renderId.startsWith('mock-')) {
    console.log("[Shotstack] Mock render - returning mock completed status");
    return {
      success: true,
      videoUrl: getMockVideoUrl(renderId),
      status: 'done',
      renderId,
      isMock: true,
    };
  }

  const apiKey = process.env.SHOTSTACK_API_KEY;
  const apiUrl = getApiUrl();
  
  if (!apiKey) {
    return {
      success: false,
      error: "SHOTSTACK_API_KEY not configured",
    };
  }

  try {
    const response = await fetch(`${apiUrl}/render/${renderId}`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to check status: ${response.status}`,
      };
    }

    const result = await response.json();
    const status = result.response?.status;
    
    if (status === 'done') {
      return {
        success: true,
        videoUrl: result.response?.url,
        status: 'done',
        renderId,
      };
    } else if (status === 'failed') {
      return {
        success: false,
        status: 'failed',
        error: result.response?.error || 'Render failed',
        renderId,
      };
    } else {
      return {
        success: true,
        status: status || 'rendering',
        renderId,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to check render status",
    };
  }
}

export async function waitForRender(
  renderId: string,
  maxWaitSeconds: number = 300,
  pollIntervalSeconds: number = 10
): Promise<ShotstackRenderResult> {
  if (renderId.startsWith('mock-')) {
    console.log("[Shotstack] Mock render - instantly returning completed");
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      success: true,
      videoUrl: getMockVideoUrl(renderId),
      status: 'done',
      renderId,
      isMock: true,
    };
  }

  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  const pollIntervalMs = pollIntervalSeconds * 1000;

  console.log(`[Shotstack] Waiting for render ${renderId}...`);

  while (Date.now() - startTime < maxWaitMs) {
    const status = await checkRenderStatus(renderId);
    
    if (status.status === 'done') {
      console.log(`[Shotstack] Render complete: ${status.videoUrl}`);
      return status;
    }
    
    if (status.status === 'failed') {
      console.error(`[Shotstack] Render failed: ${status.error}`);
      return status;
    }
    
    console.log(`[Shotstack] Render status: ${status.status}...`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return {
    success: false,
    error: `Render timed out after ${maxWaitSeconds} seconds`,
    renderId,
    status: 'rendering',
  };
}

export async function waitForRenderCompletion(
  taskId: string,
  maxWaitSeconds: number = 300,
  pollIntervalSeconds: number = 10
): Promise<ShotstackRenderResult> {
  return waitForRender(taskId, maxWaitSeconds, pollIntervalSeconds);
}

function mapTransition(transition: string | undefined): string | undefined {
  const transitionMap: Record<string, string> = {
    'fade': 'fade',
    'cut': 'none',
    'dissolve': 'fade',
    'wipe': 'wipeRight',
    'zoom': 'zoom',
    'none': 'none',
  };
  return transition ? transitionMap[transition] || 'fade' : undefined;
}

function mapPosition(position: string | undefined): ShotstackClip['position'] {
  const positionMap: Record<string, ShotstackClip['position']> = {
    'top': 'top',
    'center': 'center',
    'bottom': 'bottom',
    'top-left': 'topLeft',
    'top-right': 'topRight',
    'bottom-left': 'bottomLeft',
    'bottom-right': 'bottomRight',
  };
  return position ? positionMap[position] || 'bottom' : 'bottom';
}

export async function assembleFinalVideo(
  project: VideoProject,
  scenes: VideoScene[],
  clips: VideoClip[],
  audioTracks: AudioTrack[],
  options: AssembleVideoOptions = {}
): Promise<ShotstackRenderResult> {
  const {
    resolution = 'hd',
    aspectRatio = '16:9',
    fps = 30,
    backgroundMusicVolume = 0.3,
    voiceoverVolume = 1.0,
    transitions = 'fade',
    backgroundColor = '#000000',
  } = options;

  console.log(`[Shotstack] Assembling final video for project: ${project.projectId}`);
  console.log(`[Shotstack] Scenes: ${scenes.length}, Clips: ${clips.length}, Audio tracks: ${audioTracks.length}`);

  const sortedScenes = [...scenes].sort((a, b) => a.sceneNumber - b.sceneNumber);
  
  const clipsBySceneId = new Map<string, VideoClip>();
  for (const clip of clips) {
    if (clip.status === 'ready' && clip.videoUrl) {
      clipsBySceneId.set(clip.sceneId, clip);
    }
  }

  const voiceoverTracks = audioTracks.filter(t => t.type === 'voiceover' && t.status === 'ready' && t.audioUrl);
  const musicTracks = audioTracks.filter(t => t.type === 'music' && t.status === 'ready' && t.audioUrl);

  const voiceoverBySceneId = new Map<string, AudioTrack>();
  for (const vo of voiceoverTracks) {
    if (vo.sceneId) {
      voiceoverBySceneId.set(vo.sceneId, vo);
    }
  }

  const videoClipsList: ShotstackClip[] = [];
  const voiceoverClipsList: ShotstackClip[] = [];
  let currentTime = 0;

  for (let i = 0; i < sortedScenes.length; i++) {
    const scene = sortedScenes[i];
    const clip = clipsBySceneId.get(scene.sceneId);
    
    if (!clip || !clip.videoUrl) {
      console.warn(`[Shotstack] Scene ${scene.sceneNumber} has no ready clip, skipping`);
      continue;
    }

    const sceneDuration = clip.duration || scene.duration || 5;

    const videoClip: ShotstackClip = {
      asset: {
        type: 'video',
        src: clip.videoUrl,
      },
      start: currentTime,
      length: sceneDuration,
      fit: 'cover',
    };

    if (transitions !== 'none' && i > 0) {
      videoClip.transition = {
        in: mapTransition(transitions),
      };
    }

    videoClipsList.push(videoClip);

    const voiceover = voiceoverBySceneId.get(scene.sceneId);
    if (voiceover && voiceover.audioUrl) {
      const voDuration = voiceover.duration || sceneDuration;
      voiceoverClipsList.push({
        asset: {
          type: 'audio',
          src: voiceover.audioUrl,
          volume: voiceoverVolume,
        },
        start: currentTime,
        length: Math.min(voDuration, sceneDuration),
      });
    }

    currentTime += sceneDuration;
  }

  if (videoClipsList.length === 0) {
    return {
      success: false,
      error: 'No video clips available for assembly. Ensure scenes have generated clips.',
    };
  }

  const tracks: ShotstackTrack[] = [
    { clips: videoClipsList },
  ];

  if (voiceoverClipsList.length > 0) {
    tracks.push({ clips: voiceoverClipsList });
  }

  const timeline: ShotstackTimeline = {
    tracks,
    background: backgroundColor,
  };

  if (musicTracks.length > 0 && musicTracks[0].audioUrl) {
    timeline.soundtrack = {
      src: musicTracks[0].audioUrl,
      effect: 'fadeInFadeOut',
      volume: backgroundMusicVolume,
    };
  }

  const edit: ShotstackEdit = {
    timeline,
    output: {
      format: 'mp4',
      resolution: resolution as 'sd' | 'hd' | '1080' | '4k',
      aspectRatio: aspectRatio as '16:9' | '9:16' | '1:1',
      fps,
      quality: 'high',
    },
  };

  console.log(`[Shotstack] Timeline assembled: ${videoClipsList.length} video clips, ${voiceoverClipsList.length} voiceover clips`);
  console.log(`[Shotstack] Total duration: ${currentTime} seconds`);

  const renderResult = await renderVideo(edit);
  
  if (renderResult.success && renderResult.renderId) {
    console.log(`[Shotstack] Render started: ${renderResult.renderId}`);
  }

  return renderResult;
}

export function createVideoTimeline(
  clips: Array<{
    videoUrl: string;
    startTime: number;
    duration: number;
    transition?: string;
  }>,
  options: {
    audioUrl?: string;
    resolution?: 'sd' | 'hd' | '1080';
    aspectRatio?: '16:9' | '9:16';
  } = {}
): ShotstackEdit {
  const { audioUrl, resolution = 'hd', aspectRatio = '16:9' } = options;

  const videoTracks: ShotstackTrack[] = clips.map(clip => ({
    clips: [{
      asset: {
        type: 'video' as const,
        src: clip.videoUrl,
      },
      start: clip.startTime,
      length: clip.duration,
      fit: 'cover' as const,
      transition: clip.transition ? {
        in: clip.transition,
        out: clip.transition,
      } : undefined,
    }],
  }));

  const timeline: ShotstackTimeline = {
    tracks: videoTracks,
  };

  if (audioUrl) {
    timeline.soundtrack = {
      src: audioUrl,
      effect: 'fadeInFadeOut',
    };
  }

  return {
    timeline,
    output: {
      format: 'mp4',
      resolution,
      aspectRatio,
      fps: 30,
    },
  };
}

export function createMultiSceneVideo(
  scenes: Array<{
    videoUrl: string;
    audioUrl?: string;
    duration: number;
  }>,
  options: {
    resolution?: 'sd' | 'hd' | '1080';
    transitions?: boolean;
  } = {}
): ShotstackEdit {
  const { resolution = 'hd', transitions = true } = options;

  let currentTime = 0;
  const videoClips: ShotstackClip[] = [];
  const audioClips: ShotstackClip[] = [];

  scenes.forEach((scene, index) => {
    videoClips.push({
      asset: {
        type: 'video',
        src: scene.videoUrl,
      },
      start: currentTime,
      length: scene.duration,
      fit: 'cover',
      transition: transitions && index > 0 ? { in: 'fade' } : undefined,
    });

    if (scene.audioUrl) {
      audioClips.push({
        asset: {
          type: 'audio',
          src: scene.audioUrl,
          volume: 1,
        },
        start: currentTime,
        length: scene.duration,
      });
    }

    currentTime += scene.duration;
  });

  const tracks: ShotstackTrack[] = [{ clips: videoClips }];
  
  if (audioClips.length > 0) {
    tracks.push({ clips: audioClips });
  }

  return {
    timeline: { tracks },
    output: {
      format: 'mp4',
      resolution,
      aspectRatio: '16:9',
      fps: 30,
    },
  };
}

export function createTimelineWithOverlays(
  videoClips: Array<{
    videoUrl: string;
    startTime: number;
    duration: number;
    transition?: string;
  }>,
  overlays: TextOverlay[],
  options: {
    audioUrl?: string;
    voiceoverUrl?: string;
    resolution?: 'sd' | 'hd' | '1080';
    aspectRatio?: '16:9' | '9:16';
    voiceoverVolume?: number;
    musicVolume?: number;
  } = {}
): ShotstackEdit {
  const { 
    audioUrl, 
    voiceoverUrl,
    resolution = 'hd', 
    aspectRatio = '16:9',
    voiceoverVolume = 1.0,
    musicVolume = 0.3,
  } = options;

  const videoClipsList: ShotstackClip[] = videoClips.map((clip, index) => ({
    asset: {
      type: 'video' as const,
      src: clip.videoUrl,
    },
    start: clip.startTime,
    length: clip.duration,
    fit: 'cover' as const,
    transition: clip.transition && index > 0 ? {
      in: mapTransition(clip.transition),
    } : undefined,
  }));

  const overlayClips: ShotstackClip[] = overlays.map(overlay => {
    const html = `<div style="font-size: ${overlay.fontSize || 36}px; color: ${overlay.color || '#FFFFFF'}; text-align: center; padding: 20px;">${overlay.text}</div>`;
    
    return {
      asset: {
        type: 'html' as const,
        html,
        width: 1920,
        height: 200,
      },
      start: overlay.startTime,
      length: overlay.duration,
      position: mapPosition(overlay.position),
      opacity: 0.9,
    };
  });

  const tracks: ShotstackTrack[] = [
    { clips: videoClipsList },
  ];

  if (overlayClips.length > 0) {
    tracks.unshift({ clips: overlayClips });
  }

  if (voiceoverUrl) {
    const totalDuration = videoClips.reduce((sum, c) => Math.max(sum, c.startTime + c.duration), 0);
    tracks.push({
      clips: [{
        asset: {
          type: 'audio',
          src: voiceoverUrl,
          volume: voiceoverVolume,
        },
        start: 0,
        length: totalDuration,
      }],
    });
  }

  const timeline: ShotstackTimeline = {
    tracks,
  };

  if (audioUrl) {
    timeline.soundtrack = {
      src: audioUrl,
      effect: 'fadeInFadeOut',
      volume: musicVolume,
    };
  }

  return {
    timeline,
    output: {
      format: 'mp4',
      resolution,
      aspectRatio,
      fps: 30,
    },
  };
}

export function isConfigured(): boolean {
  return !!process.env.SHOTSTACK_API_KEY;
}

export async function testConnection(): Promise<{ 
  success: boolean; 
  message: string;
  status: 'working' | 'error' | 'not_configured' | 'mock';
}> {
  const apiKey = process.env.SHOTSTACK_API_KEY;
  
  if (!apiKey) {
    return {
      success: true,
      message: 'Shotstack running in mock mode (no API key configured)',
      status: 'mock',
    };
  }

  try {
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/render`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });
    
    if (response.ok || response.status === 404) {
      return {
        success: true,
        message: 'Shotstack API connected',
        status: 'working',
      };
    }
    
    if (response.status === 401) {
      return {
        success: false,
        message: 'Invalid Shotstack API key',
        status: 'error',
      };
    }

    return {
      success: false,
      message: `Shotstack API error: ${response.status}`,
      status: 'error',
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Failed to connect to Shotstack',
      status: 'error',
    };
  }
}
