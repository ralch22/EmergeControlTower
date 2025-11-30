import { 
  generateVoiceoverWithOpenAI, 
  generateVoiceoverWithOpenAIUrl, 
  isOpenAIConfigured,
  type OpenAIVoice 
} from './openai-tts';

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";

export interface VoiceoverResult {
  success: boolean;
  audioUrl?: string;
  audioData?: Buffer;
  duration?: number;
  error?: string;
}

export interface VoiceoverResultWithProvider extends VoiceoverResult {
  provider?: 'elevenlabs' | 'openai';
}

export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  labels?: Record<string, string>;
}

export type VoiceStyle = 
  | 'professional_male' 
  | 'professional_female' 
  | 'friendly_male' 
  | 'friendly_female' 
  | 'energetic' 
  | 'calm'
  | 'warm_male'
  | 'warm_female';

const DEFAULT_VOICES: Record<VoiceStyle, string> = {
  professional_male: "pNInz6obpgDQGcFmaJgB", // Adam
  professional_female: "21m00Tcm4TlvDq8ikWAM", // Rachel
  friendly_male: "IKne3meq5aSn9XLyUdCD", // Charlie
  friendly_female: "LcfcDJNUP1GQjkzn1xUU", // Emily
  energetic: "TxGEqnHWrfWFTfGW9XjX", // Josh
  calm: "ZQe5CZNOzWyzPSCn5a3c", // James
  warm_male: "VR6AewLTigWG4xSOukaG", // Arnold
  warm_female: "EXAVITQu4vr4xnSDxMaL", // Bella
};

const VOICE_STYLE_TO_OPENAI: Record<VoiceStyle, OpenAIVoice> = {
  professional_male: 'onyx',
  professional_female: 'nova',
  friendly_male: 'alloy',
  friendly_female: 'shimmer',
  energetic: 'echo',
  calm: 'fable',
  warm_male: 'onyx',
  warm_female: 'nova',
};

export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

export async function generateVoiceover(
  text: string,
  options: {
    voiceId?: string;
    voiceStyle?: VoiceStyle;
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
    voiceStyle?: VoiceStyle;
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

export async function generateVoiceoverWithFallback(
  text: string,
  options: {
    voiceId?: string;
    voiceStyle?: VoiceStyle;
    stability?: number;
    similarityBoost?: number;
    speed?: number;
    preferredProvider?: 'elevenlabs' | 'openai';
  } = {}
): Promise<VoiceoverResultWithProvider> {
  const { voiceStyle, preferredProvider, speed = 1.0, ...elevenLabsOptions } = options;
  
  const elevenlabsConfigured = isElevenLabsConfigured();
  const openaiConfigured = isOpenAIConfigured();

  if (preferredProvider === 'openai' && openaiConfigured) {
    console.log("[Voiceover] Using OpenAI TTS as preferred provider");
    const openaiResult = await generateVoiceoverWithOpenAIUrl(text, {
      voiceStyle,
      speed,
    });
    
    if (openaiResult.success) {
      return {
        ...openaiResult,
        provider: 'openai',
      };
    }
    
    if (elevenlabsConfigured) {
      console.log("[Voiceover] OpenAI TTS failed, falling back to ElevenLabs");
      const elevenLabsResult = await generateVoiceoverWithUrl(text, { voiceStyle, ...elevenLabsOptions });
      return {
        ...elevenLabsResult,
        provider: elevenLabsResult.success ? 'elevenlabs' : undefined,
      };
    }
    
    return {
      ...openaiResult,
      provider: undefined,
    };
  }

  if (elevenlabsConfigured) {
    console.log("[Voiceover] Trying ElevenLabs first");
    const elevenLabsResult = await generateVoiceoverWithUrl(text, { voiceStyle, ...elevenLabsOptions });
    
    if (elevenLabsResult.success) {
      return {
        ...elevenLabsResult,
        provider: 'elevenlabs',
      };
    }

    console.log("[Voiceover] ElevenLabs failed, attempting OpenAI TTS fallback");
    
    if (openaiConfigured) {
      const openaiResult = await generateVoiceoverWithOpenAIUrl(text, {
        voiceStyle,
        speed,
      });
      
      if (openaiResult.success) {
        return {
          ...openaiResult,
          provider: 'openai',
        };
      }
      
      return {
        success: false,
        error: `Both providers failed. ElevenLabs: ${elevenLabsResult.error}. OpenAI: ${openaiResult.error}`,
        provider: undefined,
      };
    }
    
    return {
      ...elevenLabsResult,
      provider: undefined,
    };
  }

  if (openaiConfigured) {
    console.log("[Voiceover] ElevenLabs not configured, using OpenAI TTS");
    const openaiResult = await generateVoiceoverWithOpenAIUrl(text, {
      voiceStyle,
      speed,
    });
    
    return {
      ...openaiResult,
      provider: openaiResult.success ? 'openai' : undefined,
    };
  }

  return {
    success: false,
    error: "No TTS provider configured. Please add ELEVENLABS_API_KEY or OPENAI_API_KEY to your secrets.",
    provider: undefined,
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

export { DEFAULT_VOICES, VOICE_STYLE_TO_OPENAI };
