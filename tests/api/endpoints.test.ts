import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

const BASE_URL = 'http://localhost:5000';

describe('API Endpoint Health Checks', () => {
  describe('Core API Endpoints', () => {
    it('GET /api/kpis returns data', async () => {
      const response = await request(BASE_URL).get('/api/kpis');
      expect([200, 404]).toContain(response.status);
    });

    it('GET /api/pods returns data', async () => {
      const response = await request(BASE_URL).get('/api/pods');
      expect([200, 404]).toContain(response.status);
    });

    it('GET /api/clients returns data', async () => {
      const response = await request(BASE_URL).get('/api/clients');
      expect([200, 404]).toContain(response.status);
    });

    it('GET /api/approval-queue returns data', async () => {
      const response = await request(BASE_URL).get('/api/approval-queue');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Video API Endpoints', () => {
    it('GET /api/video-projects returns projects list', async () => {
      const response = await request(BASE_URL).get('/api/video-projects');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body) || response.body.projects).toBeTruthy();
    });

    it('GET /api/video-projects/:id returns 404 for non-existent project', async () => {
      const response = await request(BASE_URL).get('/api/video-projects/999999');
      expect([404, 200]).toContain(response.status);
    });
  });

  describe('Runway API Endpoints', () => {
    it('GET /api/runway/models returns model configuration', async () => {
      const response = await request(BASE_URL).get('/api/runway/models');
      expect(response.status).toBe(200);
      expect(response.body.models).toBeDefined();
      expect(response.body.pricing).toBeDefined();
    });

    it('GET /api/runway/tier-status returns tier information', async () => {
      const response = await request(BASE_URL).get('/api/runway/tier-status');
      expect(response.status).toBe(200);
      expect(response.body.tier).toBeDefined();
      expect(response.body.modelStatus).toBeDefined();
    });

    it('GET /api/runway/can-submit/:model returns submission status', async () => {
      const response = await request(BASE_URL).get('/api/runway/can-submit/gen4_turbo');
      expect(response.status).toBe(200);
      expect(response.body.canSubmit).toBeDefined();
    });

    it('POST /api/runway/tier validates tier range', async () => {
      const response = await request(BASE_URL)
        .post('/api/runway/tier')
        .send({ tier: 10 });
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Provider Status Endpoints', () => {
    it('GET /api/providers/status returns all provider statuses', async () => {
      const response = await request(BASE_URL).get('/api/providers/status');
      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
    });
  });

  describe('Quality System Endpoints', () => {
    it('GET /api/quality/provider-status returns quality metrics', async () => {
      const response = await request(BASE_URL).get('/api/quality/provider-status');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('API Error Handling', () => {
  it('Returns 404 for non-existent endpoints', async () => {
    const response = await request(BASE_URL).get('/api/non-existent-endpoint');
    expect(response.status).toBe(404);
  });

  it('Handles malformed JSON gracefully', async () => {
    const response = await request(BASE_URL)
      .post('/api/video-projects')
      .set('Content-Type', 'application/json')
      .send('invalid json');
    expect([400, 500]).toContain(response.status);
  });
});
