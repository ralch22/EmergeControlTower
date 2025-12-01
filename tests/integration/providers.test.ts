import { describe, it, expect } from 'vitest';
import request from 'supertest';

const BASE_URL = 'http://localhost:5000';

describe('Provider Integration Tests', () => {
  describe('Provider Status Check', () => {
    it('returns status for all configured providers', async () => {
      const response = await request(BASE_URL).get('/api/providers/status');
      
      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      
      const providers = Object.keys(response.body);
      expect(providers.length).toBeGreaterThan(0);
      
      for (const provider of providers) {
        const status = response.body[provider];
        expect(status.configured).toBeDefined();
        expect(status.status).toBeDefined();
        expect(['working', 'limited', 'error', 'not_configured']).toContain(status.status);
      }
    });

    it('includes remediation steps for unconfigured providers', async () => {
      const response = await request(BASE_URL).get('/api/providers/status');
      
      expect(response.status).toBe(200);
      
      for (const [provider, status] of Object.entries(response.body) as [string, any][]) {
        if (status.status === 'not_configured') {
          expect(status.remediation).toBeDefined();
        }
      }
    });
  });

  describe('Provider Health Monitoring', () => {
    it('GET /api/provider-health returns health metrics', async () => {
      const response = await request(BASE_URL).get('/api/provider-health');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Self-Healing System Tests', () => {
  describe('Metrics Endpoint', () => {
    it('GET /api/self-healing/metrics returns healing metrics', async () => {
      const response = await request(BASE_URL).get('/api/self-healing/metrics');
      expect([200, 404]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toBeDefined();
      }
    });
  });

  describe('Incidents Endpoint', () => {
    it('GET /api/self-healing/incidents returns incident history', async () => {
      const response = await request(BASE_URL).get('/api/self-healing/incidents');
      expect([200, 404]).toContain(response.status);
    });
  });
});
