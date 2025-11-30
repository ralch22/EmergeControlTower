const OPENAI_TTS_BASE_URL = "https://api.openai.com/v1/audio/speech";

export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export interface OpenAITTSResult {
  success: boolean;
  audioUrl?: string;
  audioData?: Buffer;
  duration?: number;
  error?: string;
  provider: 'openai';
}

export interface OpenAITTSOptions {
  voice?: OpenAIVoice;
  voiceStyle?: string;
  model?: 'tts-1' | 'tts-1-hd';
  speed?: number;
}

const VOICE_STYLE_TO_OPENAI: Record<string, OpenAIVoice> = {
  professional_male: 'onyx',
  professional_female: 'nova',
  friendly_male: 'alloy',
  friendly_female: 'shimmer',
  energetic: 'echo',
  calm: 'fable',
  warm_male: 'onyx',
  warm_female: 'nova',
};

export async function generateVoiceoverWithOpenAI(
  text: string,
  options: OpenAITTSOptions = {}
): Promise<OpenAITTSResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return {
      success: false,
      error: "OPENAI_API_KEY not configured. Add it to your secrets.",
      provider: 'openai',
    };
  }

  const {
    voice,
    voiceStyle,
    model = 'tts-1',
    speed = 1.0,
  } = options;

  const selectedVoice: OpenAIVoice = voice || 
    (voiceStyle && VOICE_STYLE_TO_OPENAI[voiceStyle]) || 
    'alloy';

  try {
    const response = await fetch(OPENAI_TTS_BASE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        voice: selectedVoice,
        speed,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[OpenAI TTS] API error:", response.status, errorText);
      return {
        success: false,
        error: `OpenAI TTS API error: ${response.status} - ${errorText}`,
        provider: 'openai',
      };
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    
    const estimatedDuration = Math.ceil(text.split(/\s+/).length / 2.5);

    console.log(`[OpenAI TTS] Generated ${audioBuffer.length} bytes of audio (~${estimatedDuration}s) using voice: ${selectedVoice}`);

    return {
      success: true,
      audioData: audioBuffer,
      duration: estimatedDuration,
      provider: 'openai',
    };
  } catch (error: any) {
    console.error("[OpenAI TTS] Voiceover error:", error);
    return {
      success: false,
      error: error.message || "Failed to generate voiceover with OpenAI",
      provider: 'openai',
    };
  }
}

export async function generateVoiceoverWithOpenAIUrl(
  text: string,
  options: OpenAITTSOptions = {}
): Promise<OpenAITTSResult> {
  const result = await generateVoiceoverWithOpenAI(text, options);
  
  if (!result.success || !result.audioData) {
    return result;
  }

  const base64Audio = result.audioData.toString('base64');
  const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;

  return {
    success: true,
    audioUrl,
    duration: result.duration,
    provider: 'openai',
  };
}

export function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export { VOICE_STYLE_TO_OPENAI };
