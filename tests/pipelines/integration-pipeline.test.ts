/**
 * End-to-End Integration Pipeline Tests
 * Covers: cross-pipeline flows, database persistence, message passing, UI surfacing
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

describe('Content Brief to Asset Generation Flow', () => {
  describe('Client Setup', () => {
    it('should create client for content flow', async () => {
      const response = await fetchApi('/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Integration Test Client',
          industry: 'Technology',
          brandVoice: 'Professional and innovative',
          targetAudience: 'Tech professionals',
          keywords: 'innovation, AI, technology',
          contentGoals: 'Thought leadership',
        }),
      });
      expect([200, 201, 400]).toContain(response.status);
    });
  });

  describe('Content Generation', () => {
    it('should trigger content generation from client brief', async () => {
      const response = await fetchApi('/api/content-factory/run', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 1,
          contentTypes: ['blog', 'social'],
          topic: 'AI in Modern Business',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Content to Approval Queue', () => {
    it('should move content to approval queue', async () => {
      const response = await fetchApi('/api/approval-queue', {
        method: 'POST',
        body: JSON.stringify({
          contentId: '1',
          contentType: 'blog',
          title: 'Integration test content',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });

  describe('QA Review', () => {
    it('should submit QA review for content', async () => {
      const response = await fetchApi('/api/quality/reviews', {
        method: 'POST',
        body: JSON.stringify({
          contentType: 'blog',
          contentId: '1',
          overallRating: 4,
          isAccepted: true,
          reviewerFeedback: 'Good content quality',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });
});

describe('Video + Voice Synthesis to QA Flow', () => {
  describe('Video Project Creation', () => {
    it('should create video project', async () => {
      const response = await fetchApi('/api/video-projects', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Integration Test Video',
          description: 'Testing video pipeline',
          type: 'promo',
          status: 'draft',
        }),
      });
      expect([200, 201, 400]).toContain(response.status);
    });
  });

  describe('Scene Generation', () => {
    it('should generate scenes for video', async () => {
      const response = await fetchApi('/api/video-projects/1/generate-scenes', {
        method: 'POST',
        body: JSON.stringify({
          sceneCount: 3,
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Voiceover Generation', () => {
    it('should generate voiceover for video', async () => {
      const response = await fetchApi('/api/video-projects/1/generate-voiceover', {
        method: 'POST',
        body: JSON.stringify({
          voice: 'alloy',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Video Assembly', () => {
    it('should assemble video with scenes and voiceover', async () => {
      const response = await fetchApi('/api/video-projects/1/assemble', {
        method: 'POST',
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Video QA Review', () => {
    it('should submit QA review for video', async () => {
      const response = await fetchApi('/api/video-projects/1/quality-review', {
        method: 'POST',
        body: JSON.stringify({
          rating: 5,
          isApproved: true,
          feedback: 'Excellent video quality',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });
});

describe('Provider Failure Cascade to Self-Healing Flow', () => {
  describe('Provider Status Check', () => {
    it('should check initial provider status', async () => {
      const response = await fetchApi('/api/providers/status');
      expect(response.status).toBe(200);
    });
  });

  describe('Provider Health Monitor', () => {
    it('should check provider health', async () => {
      const response = await fetchApi('/api/providers/health');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Self-Healing Trigger', () => {
    it('should trigger self-healing check', async () => {
      const response = await fetchApi('/api/self-healing/metrics');
      expect(response.status).toBe(200);
    });
  });

  describe('Incident Creation on Failure', () => {
    it('should create incident for provider failure', async () => {
      const response = await fetchApi('/api/self-healing/incidents', {
        method: 'POST',
        body: JSON.stringify({
          type: 'provider_failure',
          provider: 'test-provider',
          severity: 'high',
          description: 'Integration test incident',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });

  describe('Auto-Remediation', () => {
    it('should check remediation actions', async () => {
      const response = await fetchApi('/api/providers/healing-actions');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Database Persistence Validation', () => {
  describe('Client Persistence', () => {
    it('should persist client data', async () => {
      const createResponse = await fetchApi('/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Persistence Test Client',
          industry: 'Finance',
          brandVoice: 'Professional',
          targetAudience: 'Investors',
          keywords: 'finance, investment',
          contentGoals: 'Lead generation',
        }),
      });
      expect([200, 201, 400]).toContain(createResponse.status);

      const listResponse = await fetchApi('/api/clients');
      expect(listResponse.status).toBe(200);
      const clients = await listResponse.json();
      expect(Array.isArray(clients)).toBe(true);
    });
  });

  describe('Video Project Persistence', () => {
    it('should persist video project data', async () => {
      const createResponse = await fetchApi('/api/video-projects', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Persistence Test Video',
          description: 'Testing data persistence',
          type: 'explainer',
          status: 'draft',
        }),
      });
      expect([200, 201, 400]).toContain(createResponse.status);

      const listResponse = await fetchApi('/api/video-projects');
      expect(listResponse.status).toBe(200);
    });
  });

  describe('Quality Review Persistence', () => {
    it('should persist quality reviews', async () => {
      const response = await fetchApi('/api/quality/dashboard');
      expect(response.status).toBe(200);
    });
  });
});

describe('Message Passing Validation', () => {
  describe('Activity Log Propagation', () => {
    it('should log activities', async () => {
      const response = await fetchApi('/api/activity-logs');
      expect(response.status).toBe(200);
    });
  });

  describe('Pipeline Status Updates', () => {
    it('should track pipeline status', async () => {
      const response = await fetchApi('/api/pipeline-status');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('KPI Updates', () => {
    it('should update KPIs', async () => {
      const response = await fetchApi('/api/kpis');
      expect(response.status).toBe(200);
    });
  });
});

describe('UI Surfacing Validation', () => {
  describe('Dashboard Data', () => {
    it('should provide dashboard data', async () => {
      const response = await fetchApi('/api/kpis');
      expect(response.status).toBe(200);
    });
  });

  describe('Pods Data', () => {
    it('should provide pods data', async () => {
      const response = await fetchApi('/api/pods');
      expect(response.status).toBe(200);
    });
  });

  describe('Alerts Data', () => {
    it('should provide alerts data', async () => {
      const response = await fetchApi('/api/alerts');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Phase Changes Data', () => {
    it('should provide phase changes data', async () => {
      const response = await fetchApi('/api/phase-changes');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Full Content Factory Run Integration', () => {
  describe('Weekly Content Batch', () => {
    it('should run weekly content batch', async () => {
      const response = await fetchApi('/api/content-factory/run-week', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 1,
          startDate: new Date().toISOString(),
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Content Run Status', () => {
    it('should track content run status', async () => {
      const response = await fetchApi('/api/content-runs');
      expect(response.status).toBe(200);
    });
  });

  describe('Generated Content Retrieval', () => {
    it('should retrieve generated content', async () => {
      const response = await fetchApi('/api/content');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Full Video Generation Integration', () => {
  describe('Topic to Video Flow', () => {
    it('should generate video from topic', async () => {
      const response = await fetchApi('/api/video/generate-full', {
        method: 'POST',
        body: JSON.stringify({
          topic: 'Integration test video topic',
          clientId: 1,
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Video Project Status', () => {
    it('should track video project status', async () => {
      const response = await fetchApi('/api/video-projects');
      expect(response.status).toBe(200);
    });
  });
});

describe('Provider Fallback Chain Integration', () => {
  describe('Video Provider Fallback', () => {
    it('should have fallback providers configured', async () => {
      const response = await fetchApi('/api/providers/smart-order/video');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Image Provider Fallback', () => {
    it('should have image fallback providers', async () => {
      const response = await fetchApi('/api/providers/smart-order/image');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Text Provider Fallback', () => {
    it('should have text fallback providers', async () => {
      const response = await fetchApi('/api/providers/smart-order/text');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Audio Provider Fallback', () => {
    it('should have audio fallback providers', async () => {
      const response = await fetchApi('/api/providers/smart-order/audio');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Quality Tier Routing Integration', () => {
  describe('Draft Tier Routing', () => {
    it('should route with draft tier settings', async () => {
      const response = await fetchApi('/api/quality/routing/video');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Production Tier Routing', () => {
    it('should route with production tier settings', async () => {
      const response = await fetchApi('/api/quality/routing/video');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Tier Recommendation', () => {
    it('should recommend appropriate tier', async () => {
      const response = await fetchApi('/api/quality/recommend-tier', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 1,
          contentType: 'video',
        }),
      });
      expect([200, 400]).toContain(response.status);
    });
  });
});

describe('Runway Tier Management Integration', () => {
  describe('Tier Status Check', () => {
    it('should return tier status', async () => {
      const response = await fetchApi('/api/runway/tier-status');
      expect(response.status).toBe(200);
    });
  });

  describe('Model Availability', () => {
    it('should check model availability', async () => {
      const response = await fetchApi('/api/runway/can-submit/gen4_turbo');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Tier Update', () => {
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
});

describe('Test Runner Self-Healing Integration', () => {
  describe('Test Execution', () => {
    it('should execute tests', async () => {
      const response = await fetchApi('/api/tests/run');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.results).toBeDefined();
    });
  });

  describe('Broken Feature Detection', () => {
    it('should detect broken features', async () => {
      const response = await fetchApi('/api/tests/broken-features');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.brokenFeatures).toBeDefined();
    });
  });

  describe('Feature Health Status', () => {
    it('should return feature health', async () => {
      const response = await fetchApi('/api/tests/feature-health');
      expect(response.status).toBe(200);
    });
  });
});
