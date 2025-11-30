const SHOTSTACK_API_URL = "https://api.shotstack.io/stage";

export interface ShotstackClip {
  asset: {
    type: 'video' | 'audio' | 'image' | 'title';
    src?: string;
    text?: string;
    trim?: number;
    volume?: number;
  };
  start: number;
  length: number;
  effect?: string;
  transition?: {
    in?: string;
    out?: string;
  };
  fit?: 'cover' | 'contain' | 'crop' | 'none';
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
}

export interface ShotstackEdit {
  timeline: ShotstackTimeline;
  output: {
    format: 'mp4' | 'gif' | 'mp3';
    resolution: 'sd' | 'hd' | '1080' | '4k';
    aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5' | '4:3';
    fps?: number;
  };
}

export interface ShotstackRenderResult {
  success: boolean;
  renderId?: string;
  videoUrl?: string;
  status?: 'queued' | 'fetching' | 'rendering' | 'saving' | 'done' | 'failed';
  error?: string;
}

export async function renderVideo(edit: ShotstackEdit): Promise<ShotstackRenderResult> {
  const apiKey = process.env.SHOTSTACK_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "SHOTSTACK_API_KEY not configured. Add it to your secrets.",
    };
  }

  try {
    console.log("[Shotstack] Submitting render job...");
    
    const response = await fetch(`${SHOTSTACK_API_URL}/render`, {
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
  const apiKey = process.env.SHOTSTACK_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "SHOTSTACK_API_KEY not configured",
    };
  }

  try {
    const response = await fetch(`${SHOTSTACK_API_URL}/render/${renderId}`, {
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
