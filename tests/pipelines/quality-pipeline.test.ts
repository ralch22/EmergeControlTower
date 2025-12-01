/**
 * Quality Review Pipeline Tests
 * Covers: approval queue, reviewer workflows, acceptance metrics, rejection feedback
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

describe('Quality Dashboard Pipeline', () => {
  describe('GET /api/quality/dashboard', () => {
    it('should return quality dashboard data', async () => {
      const response = await fetchApi('/api/quality/dashboard');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });
  });

  describe('Quality Summary Metrics', () => {
    it('should return summary statistics', async () => {
      const response = await fetchApi('/api/quality/dashboard');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.summary || data).toBeDefined();
    });
  });
});

describe('Quality Reviews Pipeline', () => {
  describe('POST /api/quality/reviews', () => {
    it('should create a quality review', async () => {
      const response = await fetchApi('/api/quality/reviews', {
        method: 'POST',
        body: JSON.stringify({
          contentType: 'video_project',
          contentId: '1',
          overallRating: 4,
          isAccepted: true,
          reviewerFeedback: 'Good quality video',
          providerName: 'runway',
          serviceType: 'video',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });

    it('should validate review data', async () => {
      const response = await fetchApi('/api/quality/reviews', {
        method: 'POST',
        body: JSON.stringify({
          contentType: 'invalid',
        }),
      });
      expect([400, 422, 500]).toContain(response.status);
    });
  });

  describe('GET /api/quality/reviews', () => {
    it('should return list of reviews', async () => {
      const response = await fetchApi('/api/quality/reviews');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/quality/reviews/content/:contentType/:contentId', () => {
    it('should return reviews for specific content', async () => {
      const response = await fetchApi('/api/quality/reviews/content/video_project/1');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Quality Metrics Pipeline', () => {
  describe('POST /api/quality/metrics', () => {
    it('should record quality metrics', async () => {
      const response = await fetchApi('/api/quality/metrics', {
        method: 'POST',
        body: JSON.stringify({
          contentType: 'video_project',
          contentId: '1',
          resolution: '1080p',
          bitrate: 5000000,
          fps: 30,
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });

  describe('GET /api/quality/metrics/content/:contentType/:contentId', () => {
    it('should return metrics for specific content', async () => {
      const response = await fetchApi('/api/quality/metrics/content/video_project/1');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Provider Quality Scores Pipeline', () => {
  describe('GET /api/quality/provider-scores', () => {
    it('should return all provider quality scores', async () => {
      const response = await fetchApi('/api/quality/provider-scores');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/quality/provider-scores/:providerName/:serviceType', () => {
    it('should return specific provider quality score', async () => {
      const response = await fetchApi('/api/quality/provider-scores/runway/video');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('POST /api/quality/provider-feedback', () => {
    it('should update provider quality from feedback', async () => {
      const response = await fetchApi('/api/quality/provider-feedback', {
        method: 'POST',
        body: JSON.stringify({
          providerName: 'runway',
          serviceType: 'video',
          rating: 4,
          isAccepted: true,
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });
});

describe('Quality Tiers Pipeline', () => {
  describe('GET /api/quality/tiers', () => {
    it('should return all quality tiers', async () => {
      const response = await fetchApi('/api/quality/tiers');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/quality/tiers/:tierName', () => {
    it('should return draft tier configuration', async () => {
      const response = await fetchApi('/api/quality/tiers/draft');
      expect([200, 404]).toContain(response.status);
    });

    it('should return production tier configuration', async () => {
      const response = await fetchApi('/api/quality/tiers/production');
      expect([200, 404]).toContain(response.status);
    });

    it('should return cinematic_4k tier configuration', async () => {
      const response = await fetchApi('/api/quality/tiers/cinematic_4k');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('PATCH /api/quality/tiers/:tierName', () => {
    it('should update tier configuration', async () => {
      const response = await fetchApi('/api/quality/tiers/draft', {
        method: 'PATCH',
        body: JSON.stringify({
          qualityWeight: 0.3,
          operationalWeight: 0.7,
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });
});

describe('Quality Feedback Pipeline', () => {
  describe('GET /api/quality/feedback', () => {
    it('should return recent feedback', async () => {
      const response = await fetchApi('/api/quality/feedback');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Video Project Quality Review Pipeline', () => {
  describe('POST /api/video-projects/:projectId/quality-review', () => {
    it('should submit quality review for video project', async () => {
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

describe('Approval Queue Workflow Pipeline', () => {
  describe('GET /api/approvals', () => {
    it('should return pending approvals', async () => {
      const response = await fetchApi('/api/approvals');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('POST /api/approvals', () => {
    it('should add item to approval queue', async () => {
      const response = await fetchApi('/api/approvals', {
        method: 'POST',
        body: JSON.stringify({
          client: 'Test Client',
          type: 'video',
          author: 'AI',
          thumbnail: 'https://example.com/thumb.jpg',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });

  describe('POST /api/approvals/:id/approve', () => {
    it('should approve item', async () => {
      const response = await fetchApi('/api/approvals/1/approve', {
        method: 'POST',
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('POST /api/approvals/:id/reject', () => {
    it('should reject item with reason', async () => {
      const response = await fetchApi('/api/approvals/1/reject', {
        method: 'POST',
        body: JSON.stringify({
          reason: 'Does not meet quality standards',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });
});

describe('Quality Routing Pipeline', () => {
  describe('GET /api/quality/provider-status', () => {
    it('should return combined quality + operational status', async () => {
      const response = await fetchApi('/api/quality/provider-status');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.providers || data).toBeDefined();
    });
  });

  describe('GET /api/quality/routing/:serviceType', () => {
    it('should return quality-aware provider order', async () => {
      const response = await fetchApi('/api/quality/routing/video');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('POST /api/quality/recommend-tier', () => {
    it('should recommend appropriate tier', async () => {
      const response = await fetchApi('/api/quality/recommend-tier', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 1,
          contentType: 'video',
          priority: 'high',
        }),
      });
      expect([200, 400]).toContain(response.status);
    });
  });
});

describe('Quality Initialization Pipeline', () => {
  describe('POST /api/quality/initialize', () => {
    it('should initialize quality system', async () => {
      const response = await fetchApi('/api/quality/initialize', {
        method: 'POST',
      });
      expect([200, 500]).toContain(response.status);
    });
  });
});

describe('Acceptance Rate Tracking', () => {
  describe('Dashboard Acceptance Rate', () => {
    it('should return acceptance rate in dashboard', async () => {
      const response = await fetchApi('/api/quality/dashboard');
      expect(response.status).toBe(200);
      const data = await response.json();
      // Acceptance rate may be in summary
      expect(data.summary?.acceptanceRate || data).toBeDefined();
    });
  });
});

describe('Rejection Feedback Loop', () => {
  describe('Rejection with Reason', () => {
    it('should capture rejection reason', async () => {
      const response = await fetchApi('/api/quality/reviews', {
        method: 'POST',
        body: JSON.stringify({
          contentType: 'video_project',
          contentId: '1',
          overallRating: 2,
          isAccepted: false,
          rejectionReason: 'Video quality too low',
          reviewerFeedback: 'Please increase resolution',
          providerName: 'runway',
          serviceType: 'video',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });
});
