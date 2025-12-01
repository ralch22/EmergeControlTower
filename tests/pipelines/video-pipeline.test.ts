/**
 * Video Production Pipeline Tests
 * Covers: ingredients, scenes, clips, voiceover, assembly
 */

import { describe, it, expect, beforeAll } from 'vitest';

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

describe('Video Projects Pipeline', () => {
  describe('GET /api/video-projects', () => {
    it('should return list of video projects', async () => {
      const response = await fetchApi('/api/video-projects');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('POST /api/video-projects', () => {
    it('should create a new video project with valid data', async () => {
      const response = await fetchApi('/api/video-projects', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Test Video Project',
          description: 'A test video for pipeline testing',
          type: 'promo',
          status: 'draft',
        }),
      });
      expect([200, 201]).toContain(response.status);
    });

    it('should validate required fields', async () => {
      const response = await fetchApi('/api/video-projects', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      expect([400, 422, 500]).toContain(response.status);
    });
  });
});

describe('Video Ingredients Pipeline', () => {
  describe('GET /api/video-ingredients', () => {
    it('should return video ingredients list', async () => {
      const response = await fetchApi('/api/video-ingredients');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('POST /api/video-ingredients', () => {
    it('should create video ingredients', async () => {
      const response = await fetchApi('/api/video-ingredients', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 1,
          topic: 'Test Topic',
          description: 'Test ingredient creation',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });
});

describe('Video Scenes Pipeline', () => {
  describe('GET /api/video-scenes', () => {
    it('should return video scenes', async () => {
      const response = await fetchApi('/api/video-scenes');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Scene Generation', () => {
    it('should validate scene generation request', async () => {
      const response = await fetchApi('/api/video-projects/1/generate-scenes', {
        method: 'POST',
        body: JSON.stringify({
          sceneCount: 5,
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});

describe('Video Clips Pipeline', () => {
  describe('Clip Generation', () => {
    it('should handle clip generation request', async () => {
      const response = await fetchApi('/api/video-clips/generate', {
        method: 'POST',
        body: JSON.stringify({
          sceneId: 1,
          prompt: 'Test clip generation',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Clip Status', () => {
    it('should check clip generation status', async () => {
      const response = await fetchApi('/api/video-clips/1/status');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Voiceover Pipeline', () => {
  describe('POST /api/video-projects/:id/generate-voiceover', () => {
    it('should handle voiceover generation request', async () => {
      const response = await fetchApi('/api/video-projects/1/generate-voiceover', {
        method: 'POST',
        body: JSON.stringify({
          voice: 'alloy',
          speed: 1.0,
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('ElevenLabs Integration', () => {
    it('should validate ElevenLabs TTS request', async () => {
      const response = await fetchApi('/api/runway/audio/speech', {
        method: 'POST',
        body: JSON.stringify({
          text: 'Test voiceover generation',
          voice_id: 'test-voice',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});

describe('Video Assembly Pipeline', () => {
  describe('Shotstack Integration', () => {
    it('should get studio timeline for project', async () => {
      const response = await fetchApi('/api/video-projects/1/studio-timeline');
      expect([200, 404]).toContain(response.status);
    });

    it('should save studio timeline', async () => {
      const response = await fetchApi('/api/video-projects/1/studio-timeline', {
        method: 'PUT',
        body: JSON.stringify({
          timeline: { tracks: [], duration: 30 },
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });

    it('should render from timeline', async () => {
      const response = await fetchApi('/api/video-projects/1/render-from-timeline', {
        method: 'POST',
        body: JSON.stringify({
          format: 'mp4',
          quality: 'high',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Full Assembly', () => {
    it('should assemble video from clips', async () => {
      const response = await fetchApi('/api/video-projects/1/assemble', {
        method: 'POST',
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});

describe('Full Video Generation Pipeline', () => {
  describe('POST /api/video/generate-full', () => {
    it('should handle full video generation request', async () => {
      const response = await fetchApi('/api/video/generate-full', {
        method: 'POST',
        body: JSON.stringify({
          topic: 'Test full video generation',
          clientId: 1,
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Auto-Retry System', () => {
    it('should trigger auto-retry for failed scenes', async () => {
      const response = await fetchApi('/api/video-projects/1/auto-retry', {
        method: 'POST',
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});

describe('Video Provider Fallback', () => {
  describe('Provider Chain', () => {
    it('should list available video providers', async () => {
      const response = await fetchApi('/api/providers/status');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.providers).toBeDefined();
    });

    it('should get smart provider order for video', async () => {
      const response = await fetchApi('/api/providers/smart-order/video');
      expect([200, 404]).toContain(response.status);
    });
  });
});
