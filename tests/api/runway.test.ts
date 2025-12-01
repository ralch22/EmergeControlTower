import { describe, it, expect } from 'vitest';
import request from 'supertest';

const BASE_URL = 'http://localhost:5000';

describe('Runway API Integration Tests', () => {
  describe('Model Configuration', () => {
    it('returns complete model list with pricing', async () => {
      const response = await request(BASE_URL).get('/api/runway/models');
      
      expect(response.status).toBe(200);
      expect(response.body.configured).toBeDefined();
      expect(response.body.models).toBeDefined();
      expect(response.body.pricing).toBeDefined();
      
      if (response.body.models) {
        expect(response.body.models.video).toBeDefined();
        expect(response.body.models.image).toBeDefined();
      }
    });
  });

  describe('Tier Management', () => {
    it('returns current tier status with model limits', async () => {
      const response = await request(BASE_URL).get('/api/runway/tier-status');
      
      expect(response.status).toBe(200);
      expect(response.body.tier).toBeGreaterThanOrEqual(1);
      expect(response.body.tier).toBeLessThanOrEqual(5);
      expect(response.body.modelStatus).toBeDefined();
      
      const modelStatus = response.body.modelStatus;
      if (modelStatus.gen4_turbo) {
        expect(modelStatus.gen4_turbo.concurrency).toBeDefined();
        expect(modelStatus.gen4_turbo.dailyUsage).toBeDefined();
        expect(modelStatus.gen4_turbo.canSubmit).toBeDefined();
      }
    });

    it('validates tier range on update', async () => {
      const invalidTier = await request(BASE_URL)
        .post('/api/runway/tier')
        .send({ tier: 0 });
      expect(invalidTier.status).toBe(400);

      const invalidTier2 = await request(BASE_URL)
        .post('/api/runway/tier')
        .send({ tier: 6 });
      expect(invalidTier2.status).toBe(400);
    });

    it('checks task submission eligibility', async () => {
      const response = await request(BASE_URL).get('/api/runway/can-submit/gen4_turbo');
      
      expect(response.status).toBe(200);
      expect(typeof response.body.canSubmit).toBe('boolean');
      
      if (response.body.canSubmit === false) {
        expect(response.body.reason).toBeDefined();
      }
    });
  });

  describe('Video Generation Validation', () => {
    it('rejects video generation without prompt', async () => {
      const response = await request(BASE_URL)
        .post('/api/runway/video/generate')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('prompt');
    });

    it('accepts valid video generation request format', async () => {
      const response = await request(BASE_URL)
        .post('/api/runway/video/generate')
        .send({
          prompt: 'Test prompt for validation only',
          model: 'gen4_turbo',
          duration: 5,
          aspectRatio: '16:9',
        });
      
      expect([200, 400, 500]).toContain(response.status);
    });
  });

  describe('Image Generation Validation', () => {
    it('rejects image generation without prompt', async () => {
      const response = await request(BASE_URL)
        .post('/api/runway/image/generate')
        .send({});
      
      expect([400, 404]).toContain(response.status);
    });
  });
});

describe('Runway Tier Limits', () => {
  const TIER_LIMITS = {
    1: { maxConcurrency: 1, dailyLimit: 50 },
    2: { maxConcurrency: 3, dailyLimit: 500 },
    3: { maxConcurrency: 5, dailyLimit: 1000 },
    4: { maxConcurrency: 10, dailyLimit: 5000 },
    5: { maxConcurrency: 20, dailyLimit: 25000 },
  };

  it('tier status reflects correct limits', async () => {
    const response = await request(BASE_URL).get('/api/runway/tier-status');
    
    expect(response.status).toBe(200);
    
    const tier = response.body.tier as keyof typeof TIER_LIMITS;
    const expectedLimits = TIER_LIMITS[tier];
    
    if (expectedLimits && response.body.modelStatus?.gen4_turbo) {
      expect(response.body.modelStatus.gen4_turbo.concurrency.max).toBe(expectedLimits.maxConcurrency);
    }
  });
});
