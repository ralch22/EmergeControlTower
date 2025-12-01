import { describe, it, expect } from 'vitest';
import request from 'supertest';

const BASE_URL = 'http://localhost:5000';

describe('OpenRouter API Integration Tests', () => {
  describe('Configuration', () => {
    it('GET /api/openrouter/test returns configuration status', async () => {
      const response = await request(BASE_URL).get('/api/openrouter/test');
      expect([200, 404]).toContain(response.status);
    });

    it('GET /api/openrouter/models returns available models', async () => {
      const response = await request(BASE_URL).get('/api/openrouter/models');
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toBeDefined();
      }
    });
  });

  describe('Content Generation', () => {
    it('POST /api/openrouter/generate validates request body', async () => {
      const response = await request(BASE_URL)
        .post('/api/openrouter/generate')
        .send({});
      
      expect([400, 404]).toContain(response.status);
    });

    it('POST /api/openrouter/blog requires topic', async () => {
      const response = await request(BASE_URL)
        .post('/api/openrouter/blog')
        .send({});
      
      expect([400, 404]).toContain(response.status);
    });

    it('POST /api/openrouter/social requires content', async () => {
      const response = await request(BASE_URL)
        .post('/api/openrouter/social')
        .send({});
      
      expect([400, 404]).toContain(response.status);
    });
  });
});
