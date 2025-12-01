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

export interface IngestUploadResult {
  success: boolean;
  sourceId?: string;
  sourceUrl?: string;
  error?: string;
}

const SHOTSTACK_INGEST_STAGE_URL = "https://api.shotstack.io/ingest/stage";
const SHOTSTACK_INGEST_V1_URL = "https://api.shotstack.io/ingest/v1";

function getIngestApiUrl(): string {
  const useProduction = process.env.SHOTSTACK_USE_PRODUCTION === 'true';
  return useProduction ? SHOTSTACK_INGEST_V1_URL : SHOTSTACK_INGEST_STAGE_URL;
}

export async function uploadAudioToShotstack(audioBuffer: Buffer, filename: string = 'audio.mp3'): Promise<IngestUploadResult> {
  const apiKey = process.env.SHOTSTACK_API_KEY;
  const ingestUrl = getIngestApiUrl();
  
  if (!apiKey) {
    console.log("[Shotstack Ingest] No API key configured, cannot upload audio");
    return {
      success: false,
      error: "SHOTSTACK_API_KEY not configured",
    };
  }

  try {
    console.log(`[Shotstack Ingest] Requesting signed upload URL for ${filename}...`);
    
    const uploadResponse = await fetch(`${ingestUrl}/upload`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'x-api-key': apiKey,
      },
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("[Shotstack Ingest] Upload URL request failed:", uploadResponse.status, errorText);
      return {
        success: false,
        error: `Failed to get upload URL: ${uploadResponse.status} - ${errorText}`,
      };
    }

    const uploadData = await uploadResponse.json();
    const signedUrl = uploadData.data?.attributes?.url;
    const sourceId = uploadData.data?.id;

    if (!signedUrl || !sourceId) {
      return {
        success: false,
        error: "No signed URL or source ID returned",
      };
    }

    console.log(`[Shotstack Ingest] Uploading audio buffer (${audioBuffer.length} bytes) to signed URL...`);
    
    const putResponse = await fetch(signedUrl, {
      method: 'PUT',
      body: audioBuffer,
    });

    if (!putResponse.ok) {
      const errorText = await putResponse.text();
      console.error("[Shotstack Ingest] Audio upload failed:", putResponse.status, errorText);
      return {
        success: false,
        error: `Failed to upload audio: ${putResponse.status}`,
      };
    }

    console.log(`[Shotstack Ingest] Upload complete, polling for status (sourceId: ${sourceId})...`);
    
    const sourceUrl = await pollIngestStatus(sourceId);
    
    if (sourceUrl) {
      console.log(`[Shotstack Ingest] Audio hosted at: ${sourceUrl}`);
      return {
        success: true,
        sourceId,
        sourceUrl,
      };
    }

    return {
      success: false,
      error: "Failed to get source URL after upload",
    };
  } catch (error: any) {
    console.error("[Shotstack Ingest] Upload error:", error);
    return {
      success: false,
      error: error.message || "Failed to upload audio",
    };
  }
}

async function pollIngestStatus(sourceId: string, maxAttempts: number = 30): Promise<string | null> {
  const apiKey = process.env.SHOTSTACK_API_KEY;
  const ingestUrl = getIngestApiUrl();
  
  if (!apiKey) return null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${ingestUrl}/sources/${sourceId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'x-api-key': apiKey,
        },
      });

      if (!response.ok) {
        console.log(`[Shotstack Ingest] Status check failed: ${response.status}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      const data = await response.json();
      const status = data.data?.attributes?.status;
      const sourceUrl = data.data?.attributes?.source;

      console.log(`[Shotstack Ingest] Status: ${status} (attempt ${attempt + 1}/${maxAttempts})`);

      if (status === 'ready' && sourceUrl) {
        return sourceUrl;
      }

      if (status === 'failed') {
        console.error("[Shotstack Ingest] Ingest failed");
        return null;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error("[Shotstack Ingest] Poll error:", error);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.error("[Shotstack Ingest] Polling timeout");
  return null;
}

export async function uploadBase64AudioToShotstack(base64DataUrl: string, filename: string = 'audio.mp3'): Promise<IngestUploadResult> {
  if (!base64DataUrl.startsWith('data:audio')) {
    return {
      success: false,
      error: "Invalid base64 audio data URL",
    };
  }

  try {
    const base64Data = base64DataUrl.split(',')[1];
    if (!base64Data) {
      return {
        success: false,
        error: "Failed to extract base64 data",
      };
    }

    const audioBuffer = Buffer.from(base64Data, 'base64');
    return await uploadAudioToShotstack(audioBuffer, filename);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to process base64 audio",
    };
  }
}

export async function uploadVideoToShotstack(videoBuffer: Buffer, filename: string = 'video.mp4'): Promise<IngestUploadResult> {
  const apiKey = process.env.SHOTSTACK_API_KEY;
  const ingestUrl = getIngestApiUrl();
  
  if (!apiKey) {
    console.log("[Shotstack Ingest] No API key configured, cannot upload video");
    return {
      success: false,
      error: "SHOTSTACK_API_KEY not configured",
    };
  }

  try {
    console.log(`[Shotstack Ingest] Requesting signed upload URL for video ${filename}...`);
    
    const uploadResponse = await fetch(`${ingestUrl}/upload`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'x-api-key': apiKey,
      },
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("[Shotstack Ingest] Upload URL request failed:", uploadResponse.status, errorText);
      return {
        success: false,
        error: `Failed to get upload URL: ${uploadResponse.status} - ${errorText}`,
      };
    }

    const uploadData = await uploadResponse.json();
    const signedUrl = uploadData.data?.attributes?.url;
    const sourceId = uploadData.data?.id;

    if (!signedUrl || !sourceId) {
      return {
        success: false,
        error: "No signed URL or source ID returned",
      };
    }

    console.log(`[Shotstack Ingest] Uploading video buffer (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB) to signed URL...`);
    
    const putResponse = await fetch(signedUrl, {
      method: 'PUT',
      body: videoBuffer,
      headers: {
        'Content-Type': 'video/mp4',
      },
    });

    if (!putResponse.ok) {
      const errorText = await putResponse.text();
      console.error("[Shotstack Ingest] Video upload failed:", putResponse.status, errorText);
      return {
        success: false,
        error: `Failed to upload video: ${putResponse.status}`,
      };
    }

    console.log(`[Shotstack Ingest] Video upload complete, polling for status (sourceId: ${sourceId})...`);
    
    const sourceUrl = await pollIngestStatus(sourceId, 60);
    
    if (sourceUrl) {
      console.log(`[Shotstack Ingest] Video hosted at: ${sourceUrl}`);
      return {
        success: true,
        sourceId,
        sourceUrl,
      };
    }

    return {
      success: false,
      error: "Failed to get source URL after upload",
    };
  } catch (error: any) {
    console.error("[Shotstack Ingest] Video upload error:", error);
    return {
      success: false,
      error: error.message || "Failed to upload video",
    };
  }
}

export function isGoogleAuthenticatedUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('generativelanguage.googleapis.com') && url.includes('/files/');
}

export async function downloadGoogleVideo(videoUrl: string): Promise<Buffer | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("[Google Video Download] No GEMINI_API_KEY configured");
    return null;
  }

  try {
    const urlWithAuth = videoUrl.includes('?') 
      ? `${videoUrl}&key=${apiKey}`
      : `${videoUrl}?key=${apiKey}`;
    
    console.log(`[Google Video Download] Downloading video from Google API...`);
    
    const response = await fetch(urlWithAuth);
    
    if (!response.ok) {
      console.error(`[Google Video Download] Failed: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[Google Video Download] Downloaded ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    
    return buffer;
  } catch (error: any) {
    console.error("[Google Video Download] Error:", error.message);
    return null;
  }
}

export async function preprocessVideoUrl(videoUrl: string, sceneId: string): Promise<string> {
  if (!isGoogleAuthenticatedUrl(videoUrl)) {
    return videoUrl;
  }
  
  console.log(`[Video Preprocess] Scene ${sceneId}: Converting Google authenticated URL to public URL...`);
  
  const videoBuffer = await downloadGoogleVideo(videoUrl);
  if (!videoBuffer) {
    console.error(`[Video Preprocess] Failed to download video for scene ${sceneId}`);
    throw new Error(`Failed to download video from Google for scene ${sceneId}`);
  }
  
  const uploadResult = await uploadVideoToShotstack(videoBuffer, `${sceneId}.mp4`);
  if (!uploadResult.success || !uploadResult.sourceUrl) {
    console.error(`[Video Preprocess] Failed to upload video to Shotstack for scene ${sceneId}: ${uploadResult.error}`);
    throw new Error(`Failed to upload video to Shotstack for scene ${sceneId}: ${uploadResult.error}`);
  }
  
  console.log(`[Video Preprocess] Scene ${sceneId}: Successfully converted to ${uploadResult.sourceUrl}`);
  return uploadResult.sourceUrl;
}

export async function preprocessVideoUrls(clips: { sceneId: string; videoUrl: string }[]): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();
  
  const googleClips = clips.filter(c => isGoogleAuthenticatedUrl(c.videoUrl));
  const regularClips = clips.filter(c => !isGoogleAuthenticatedUrl(c.videoUrl));
  
  for (const clip of regularClips) {
    urlMap.set(clip.sceneId, clip.videoUrl);
  }
  
  if (googleClips.length === 0) {
    console.log(`[Video Preprocess] No Google authenticated URLs to process`);
    return urlMap;
  }
  
  console.log(`[Video Preprocess] Processing ${googleClips.length} Google authenticated URLs...`);
  
  for (const clip of googleClips) {
    try {
      const publicUrl = await preprocessVideoUrl(clip.videoUrl, clip.sceneId);
      urlMap.set(clip.sceneId, publicUrl);
    } catch (error: any) {
      console.error(`[Video Preprocess] Error processing ${clip.sceneId}: ${error.message}`);
    }
  }
  
  return urlMap;
}

export function isHostedUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

export function isDataUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith('data:');
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
