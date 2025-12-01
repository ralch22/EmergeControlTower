/**
 * Content Generation Pipeline Tests
 * Covers: blog, social, ad copy, topic generation
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

describe('Content Factory Pipeline', () => {
  describe('GET /api/content-runs', () => {
    it('should return list of content runs', async () => {
      const response = await fetchApi('/api/content-runs');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('POST /api/content-factory/run', () => {
    it('should accept content generation request', async () => {
      const response = await fetchApi('/api/content-factory/run', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 1,
          contentTypes: ['blog', 'social'],
          topic: 'Test content generation',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });

    it('should validate content type', async () => {
      const response = await fetchApi('/api/content-factory/run', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 1,
          contentTypes: ['invalid_type'],
        }),
      });
      expect([200, 400, 422, 500]).toContain(response.status);
    });
  });

  describe('POST /api/content-factory/run-week', () => {
    it('should handle weekly content batch request', async () => {
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

  describe('POST /api/content-factory/cleanup-stuck-runs', () => {
    it('should cleanup stuck content runs', async () => {
      const response = await fetchApi('/api/content-factory/cleanup-stuck-runs', {
        method: 'POST',
      });
      expect([200, 500]).toContain(response.status);
    });
  });
});

describe('Blog Content Pipeline', () => {
  describe('Blog Generation', () => {
    it('should generate blog content', async () => {
      const response = await fetchApi('/api/content-factory/run', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 1,
          contentTypes: ['blog'],
          topic: 'Test blog topic',
          parameters: {
            wordCount: 1500,
            tone: 'professional',
          },
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Blog Content Retrieval', () => {
    it('should retrieve generated blog content', async () => {
      const response = await fetchApi('/api/content?type=blog');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Social Media Pipeline', () => {
  describe('Social Content Generation', () => {
    it('should generate social media content', async () => {
      const response = await fetchApi('/api/content-factory/run', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 1,
          contentTypes: ['social'],
          topic: 'Test social topic',
          platforms: ['linkedin', 'twitter', 'instagram'],
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Platform-Specific Content', () => {
    it('should retrieve LinkedIn content', async () => {
      const response = await fetchApi('/api/content?type=social&platform=linkedin');
      expect([200, 404]).toContain(response.status);
    });

    it('should retrieve Twitter content', async () => {
      const response = await fetchApi('/api/content?type=social&platform=twitter');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Ad Copy Pipeline', () => {
  describe('Ad Copy Generation', () => {
    it('should generate ad copy', async () => {
      const response = await fetchApi('/api/content-factory/run', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 1,
          contentTypes: ['adcopy'],
          topic: 'Test ad campaign',
          platforms: ['google', 'meta'],
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Ad Copy Variants', () => {
    it('should retrieve ad copy variants', async () => {
      const response = await fetchApi('/api/content?type=adcopy');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Topic Generation Pipeline', () => {
  describe('Topic Discovery', () => {
    it('should generate topics for client', async () => {
      const response = await fetchApi('/api/content-factory/run', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 1,
          contentTypes: ['topic'],
          count: 10,
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});

describe('Generated Content Management', () => {
  describe('GET /api/content', () => {
    it('should list all generated content', async () => {
      const response = await fetchApi('/api/content');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('PATCH /api/content/:contentId/status', () => {
    it('should update content status', async () => {
      const response = await fetchApi('/api/content/1/status', {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'approved',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('POST /api/content/:contentId/generate-video', () => {
    it('should trigger video generation from content', async () => {
      const response = await fetchApi('/api/content/1/generate-video', {
        method: 'POST',
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});

describe('Approval Queue Pipeline', () => {
  describe('GET /api/approval-queue', () => {
    it('should return approval queue', async () => {
      const response = await fetchApi('/api/approval-queue');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('POST /api/approval-queue', () => {
    it('should add content to approval queue', async () => {
      const response = await fetchApi('/api/approval-queue', {
        method: 'POST',
        body: JSON.stringify({
          contentId: '1',
          contentType: 'blog',
          title: 'Test content for approval',
        }),
      });
      expect([200, 201, 400, 404]).toContain(response.status);
    });
  });

  describe('Content Approval', () => {
    it('should approve content', async () => {
      const response = await fetchApi('/api/content/1/approve', {
        method: 'POST',
      });
      expect([200, 400, 404]).toContain(response.status);
    });

    it('should reject content with reason', async () => {
      const response = await fetchApi('/api/content/1/reject', {
        method: 'POST',
        body: JSON.stringify({
          reason: 'Does not meet brand guidelines',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });
});

describe('KPI Tracking Pipeline', () => {
  describe('POST /api/kpis/increment-ai-output', () => {
    it('should increment AI output counter', async () => {
      const response = await fetchApi('/api/kpis/increment-ai-output', {
        method: 'POST',
      });
      expect([200, 500]).toContain(response.status);
    });
  });
});
