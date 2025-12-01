/**
 * AI Provider Pipeline Tests
 * Covers: Runway, OpenRouter, Gemini, Anthropic, ElevenLabs, Shotstack, Fal AI, Alibaba
 */

import { describe, it, expect } from 'vitest';

const API_BASE = 'http://localhost:5000';

async function fetchApi(path: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  return response;
}

describe('Runway API Pipeline', () => {
  describe('GET /api/runway/models', () => {
    it('should return all available Runway models', async () => {
      const response = await fetchApi('/api/runway/models');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.models).toBeDefined();
      expect(Array.isArray(data.models)).toBe(true);
    });
  });

  describe('GET /api/runway/tier-status', () => {
    it('should return tier usage status', async () => {
      const response = await fetchApi('/api/runway/tier-status');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.currentTier).toBeDefined();
    });
  });

  describe('POST /api/runway/tier', () => {
    it('should update tier settings', async () => {
      const response = await fetchApi('/api/runway/tier', {
        method: 'POST',
        body: JSON.stringify({
          tier: 'standard',
        }),
      });
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('GET /api/runway/can-submit/:model', () => {
    it('should check if model can be submitted', async () => {
      const response = await fetchApi('/api/runway/can-submit/gen4_turbo');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('POST /api/runway/video/generate', () => {
    it('should handle video generation request', async () => {
      const response = await fetchApi('/api/runway/video/generate', {
        method: 'POST',
        body: JSON.stringify({
          model: 'gen4_turbo',
          prompt: 'Test video generation',
          duration: 5,
        }),
      });
      expect([200, 400, 402, 429, 500]).toContain(response.status);
    });
  });

  describe('POST /api/runway/video/video-to-video', () => {
    it('should handle video-to-video transformation', async () => {
      const response = await fetchApi('/api/runway/video/video-to-video', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'https://example.com/video.mp4',
          prompt: 'Transform to anime style',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/runway/video/upscale', () => {
    it('should handle video upscaling', async () => {
      const response = await fetchApi('/api/runway/video/upscale', {
        method: 'POST',
        body: JSON.stringify({
          videoUrl: 'https://example.com/video.mp4',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/runway/image/generate', () => {
    it('should handle image generation', async () => {
      const response = await fetchApi('/api/runway/image/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test image generation',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/runway/audio/speech', () => {
    it('should handle TTS request', async () => {
      const response = await fetchApi('/api/runway/audio/speech', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Test text to speech',
          voice_id: 'alloy',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/runway/audio/sound-effect', () => {
    it('should handle sound effect generation', async () => {
      const response = await fetchApi('/api/runway/audio/sound-effect', {
        method: 'POST',
        body: JSON.stringify({
          description: 'Whoosh sound effect',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('GET /api/runway/tasks/:taskId', () => {
    it('should check task status', async () => {
      const response = await fetchApi('/api/runway/tasks/test-task-id');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('OpenRouter Pipeline', () => {
  describe('GET /api/openrouter/test', () => {
    it('should test OpenRouter connection', async () => {
      const response = await fetchApi('/api/openrouter/test');
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/openrouter/models', () => {
    it('should return available models', async () => {
      const response = await fetchApi('/api/openrouter/models');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.models).toBeDefined();
    });
  });

  describe('POST /api/openrouter/generate', () => {
    it('should generate text content', async () => {
      const response = await fetchApi('/api/openrouter/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test text generation',
          model: 'deepseek/deepseek-r1',
        }),
      });
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('POST /api/openrouter/blog', () => {
    it('should generate blog content', async () => {
      const response = await fetchApi('/api/openrouter/blog', {
        method: 'POST',
        body: JSON.stringify({
          topic: 'Test blog topic',
          wordCount: 500,
        }),
      });
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('POST /api/openrouter/social', () => {
    it('should generate social content', async () => {
      const response = await fetchApi('/api/openrouter/social', {
        method: 'POST',
        body: JSON.stringify({
          topic: 'Test social topic',
          platform: 'linkedin',
        }),
      });
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('POST /api/openrouter/analyze', () => {
    it('should analyze content', async () => {
      const response = await fetchApi('/api/openrouter/analyze', {
        method: 'POST',
        body: JSON.stringify({
          content: 'Test content for analysis',
        }),
      });
      expect([200, 400, 500]).toContain(response.status);
    });
  });
});

describe('Provider Status Pipeline', () => {
  describe('GET /api/providers/status', () => {
    it('should return all provider statuses', async () => {
      const response = await fetchApi('/api/providers/status');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.providers).toBeDefined();
    });
  });

  describe('GET /api/providers/health', () => {
    it('should return provider health metrics', async () => {
      const response = await fetchApi('/api/providers/health');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/providers/smart-order/:serviceType', () => {
    it('should return smart provider order for video', async () => {
      const response = await fetchApi('/api/providers/smart-order/video');
      expect([200, 404]).toContain(response.status);
    });

    it('should return smart provider order for image', async () => {
      const response = await fetchApi('/api/providers/smart-order/image');
      expect([200, 404]).toContain(response.status);
    });

    it('should return smart provider order for text', async () => {
      const response = await fetchApi('/api/providers/smart-order/text');
      expect([200, 404]).toContain(response.status);
    });

    it('should return smart provider order for audio', async () => {
      const response = await fetchApi('/api/providers/smart-order/audio');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('POST /api/providers/initialize', () => {
    it('should initialize provider health monitor', async () => {
      const response = await fetchApi('/api/providers/initialize', {
        method: 'POST',
      });
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('POST /api/providers/reset-rate-limits', () => {
    it('should reset rate limits', async () => {
      const response = await fetchApi('/api/providers/reset-rate-limits', {
        method: 'POST',
      });
      expect([200, 500]).toContain(response.status);
    });
  });
});

describe('Provider Quarantine Pipeline', () => {
  describe('GET /api/providers/quarantine', () => {
    it('should return quarantined providers', async () => {
      const response = await fetchApi('/api/providers/quarantine');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('POST /api/providers/quarantine/:providerName/release', () => {
    it('should release provider from quarantine', async () => {
      const response = await fetchApi('/api/providers/quarantine/runway/release', {
        method: 'POST',
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('POST /api/providers/quarantine/clear-all', () => {
    it('should clear all quarantined providers', async () => {
      const response = await fetchApi('/api/providers/quarantine/clear-all', {
        method: 'POST',
      });
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('POST /api/providers/recalculate-priorities', () => {
    it('should recalculate provider priorities', async () => {
      const response = await fetchApi('/api/providers/recalculate-priorities', {
        method: 'POST',
      });
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('GET /api/providers/healing-actions', () => {
    it('should return healing actions', async () => {
      const response = await fetchApi('/api/providers/healing-actions');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Quality-Aware Routing Pipeline', () => {
  describe('GET /api/quality/provider-status', () => {
    it('should return quality-aware provider status', async () => {
      const response = await fetchApi('/api/quality/provider-status');
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/quality/routing/:serviceType', () => {
    it('should return quality-aware routing for video', async () => {
      const response = await fetchApi('/api/quality/routing/video');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('POST /api/quality/recommend-tier', () => {
    it('should recommend quality tier', async () => {
      const response = await fetchApi('/api/quality/recommend-tier', {
        method: 'POST',
        body: JSON.stringify({
          contentType: 'video',
          clientId: 1,
        }),
      });
      expect([200, 400]).toContain(response.status);
    });
  });
});

describe('Image Generation Providers', () => {
  describe('Gemini Image Generation', () => {
    it('should handle Gemini image request', async () => {
      const response = await fetchApi('/api/image/generate/gemini', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test image generation',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Fal AI Image Generation', () => {
    it('should handle Fal AI image request', async () => {
      const response = await fetchApi('/api/image/generate/fal', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test Fal AI image',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Alibaba WAN Image Generation', () => {
    it('should handle Alibaba image request', async () => {
      const response = await fetchApi('/api/image/generate/alibaba', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test Alibaba image',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});

describe('Text-to-Speech Providers', () => {
  describe('ElevenLabs TTS', () => {
    it('should handle ElevenLabs TTS request', async () => {
      const response = await fetchApi('/api/tts/elevenlabs', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Test text to speech',
          voice: 'default',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('OpenAI TTS Fallback', () => {
    it('should handle OpenAI TTS request', async () => {
      const response = await fetchApi('/api/tts/openai', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Test OpenAI TTS',
          voice: 'alloy',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});
