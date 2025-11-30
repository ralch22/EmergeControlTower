const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

export interface VoiceoverResult {
  success: boolean;
  audioUrl?: string;
  audioData?: Buffer;
  duration?: number;
  error?: string;
}

export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels?: Record<string, string>;
}

const DEFAULT_VOICES: Record<string, string> = {
  professional_male: "pNInz6obpgDQGcFmaJgB", // Adam
  professional_female: "21m00Tcm4TlvDq8ikWAM", // Rachel
  warm_male: "VR6AewLTigWG4xSOukaG", // Arnold
  warm_female: "EXAVITQu4vr4xnSDxMaL", // Bella
  energetic: "ErXwobaYiN019PkySvjV", // Antoni
  calm: "MF3mGyEYCl7XYWbV9V6O", // Elli
};

export async function generateVoiceover(
  text: string,
  options: {
    voiceId?: string;
    voiceStyle?: keyof typeof DEFAULT_VOICES;
    stability?: number;
    similarityBoost?: number;
    speed?: number;
  } = {}
): Promise<VoiceoverResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "ELEVENLABS_API_KEY not configured. Add it to your secrets.",
    };
  }

  const {
    voiceId = DEFAULT_VOICES.professional_male,
    voiceStyle,
    stability = 0.5,
    similarityBoost = 0.75,
    speed = 1.0,
  } = options;

  const selectedVoiceId = voiceStyle ? DEFAULT_VOICES[voiceStyle] : voiceId;

  try {
    const response = await fetch(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${selectedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            speed,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ElevenLabs] API error:", response.status, errorText);
      return {
        success: false,
        error: `ElevenLabs API error: ${response.status} - ${errorText}`,
      };
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    const estimatedDuration = Math.ceil(text.split(/\s+/).length / 2.5);

    console.log(`[ElevenLabs] Generated ${audioBuffer.length} bytes of audio (~${estimatedDuration}s)`);

    return {
      success: true,
      audioData: audioBuffer,
      duration: estimatedDuration,
    };
  } catch (error: any) {
    console.error("[ElevenLabs] Voiceover error:", error);
    return {
      success: false,
      error: error.message || "Failed to generate voiceover",
    };
  }
}

export async function generateVoiceoverWithUrl(
  text: string,
  options: {
    voiceId?: string;
    voiceStyle?: keyof typeof DEFAULT_VOICES;
  } = {}
): Promise<VoiceoverResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "ELEVENLABS_API_KEY not configured",
    };
  }

  const result = await generateVoiceover(text, options);
  
  if (!result.success || !result.audioData) {
    return result;
  }

  const base64Audio = result.audioData.toString('base64');
  const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;

  return {
    success: true,
    audioUrl,
    duration: result.duration,
  };
}

export async function getAvailableVoices(): Promise<Voice[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    console.warn("[ElevenLabs] API key not configured, returning default voices");
    return Object.entries(DEFAULT_VOICES).map(([name, id]) => ({
      voice_id: id,
      name: name.replace(/_/g, ' '),
      category: 'default',
    }));
  }

  try {
    const response = await fetch(`${ELEVENLABS_BASE_URL}/voices`, {
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      console.error("[ElevenLabs] Failed to fetch voices:", response.status);
      return [];
    }

    const data = await response.json();
    return data.voices || [];
  } catch (error) {
    console.error("[ElevenLabs] Error fetching voices:", error);
    return [];
  }
}

export async function estimateAudioDuration(text: string): Promise<number> {
  const words = text.split(/\s+/).length;
  return Math.ceil(words / 2.5);
}

export { DEFAULT_VOICES };
