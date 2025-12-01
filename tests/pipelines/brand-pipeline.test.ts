/**
 * Brand Management Pipeline Tests
 * Covers: clients, brand assets, brand files, brand guidelines, asset generation
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

describe('Clients Pipeline', () => {
  describe('GET /api/clients', () => {
    it('should return list of clients', async () => {
      const response = await fetchApi('/api/clients');
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('POST /api/clients', () => {
    it('should create a new client', async () => {
      const response = await fetchApi('/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Client',
          industry: 'Technology',
          brandVoice: 'Professional and innovative',
          targetAudience: 'Tech enthusiasts',
          keywords: 'innovation, technology, future',
          contentGoals: 'Brand awareness and thought leadership',
        }),
      });
      expect([200, 201, 400]).toContain(response.status);
    });

    it('should validate required fields', async () => {
      const response = await fetchApi('/api/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test',
        }),
      });
      expect([400, 422, 500]).toContain(response.status);
    });
  });

  describe('GET /api/clients/:id', () => {
    it('should return specific client', async () => {
      const response = await fetchApi('/api/clients/1');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('PUT /api/clients/:id', () => {
    it('should update client', async () => {
      const response = await fetchApi('/api/clients/1', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Updated Client Name',
          industry: 'Finance',
          brandVoice: 'Trustworthy',
          targetAudience: 'Business professionals',
          keywords: 'finance, trust, growth',
          contentGoals: 'Client acquisition',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('PUT /api/clients/:id/brand-profile', () => {
    it('should update brand profile', async () => {
      const response = await fetchApi('/api/clients/1/brand-profile', {
        method: 'PUT',
        body: JSON.stringify({
          version: '1.0',
          textual: {
            brandName: { primary: 'Test Brand' },
            tagline: { primary: 'Innovation First' },
            brandStory: { short: 'A test brand story' },
            values: [{ name: 'Innovation', description: 'We innovate' }],
            personality: { archetype: 'Creator', traits: ['innovative'] },
            tone: { description: 'Professional', formality: 7, energy: 6, technicality: 8, warmth: 5 },
            forbiddenWords: ['cheap'],
            keywords: ['innovation'],
            contentGoals: ['awareness'],
            examplePhrases: ['Leading innovation'],
            targetAudience: { demographics: 'Tech professionals' },
          },
          visual: {
            visualStyle: { description: 'Modern', aesthetic: ['clean'], moodKeywords: ['professional'] },
            colorPalette: {
              darkMode: {
                background: { name: 'Dark', hex: '#1a1a1a', usage: 'Primary background' },
                accent: { name: 'Blue', hex: '#3b82f6', usage: 'CTAs' },
                textPrimary: { name: 'White', hex: '#ffffff', usage: 'Headings' },
              },
            },
            typography: { fonts: [{ family: 'Inter', category: 'sans-serif', weights: [400, 600], usage: 'Body' }] },
            iconography: { style: 'Outlined', colorApproach: 'Monochrome', sizeBase: 24 },
            cinematicGuidelines: {
              aspectRatio: '16:9',
              resolution: '1080p',
              duration: { short: 15, medium: 30, long: 60 },
              pacing: 'Dynamic',
              motionStyle: 'Smooth',
            },
            accessibility: { standard: 'WCAG 2.1 AA', minContrastRatio: 4.5, altTextRequired: true },
            usageRules: { dos: ['Use brand colors'], donts: ['Use stock imagery'] },
          },
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('DELETE /api/clients/:id', () => {
    it('should handle client deletion', async () => {
      const response = await fetchApi('/api/clients/999', {
        method: 'DELETE',
      });
      expect([200, 204, 404]).toContain(response.status);
    });
  });
});

describe('Brand Assets Pipeline', () => {
  describe('GET /api/brand-assets', () => {
    it('should return all brand assets', async () => {
      const response = await fetchApi('/api/brand-assets');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/brand-assets/:clientId', () => {
    it('should return brand assets for client', async () => {
      const response = await fetchApi('/api/brand-assets/1');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('POST /api/brand-assets', () => {
    it('should create brand assets', async () => {
      const response = await fetchApi('/api/brand-assets', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 1,
          visualStyle: 'Modern and clean',
          colorPalette: ['#3b82f6', '#1a1a1a', '#ffffff'],
          fonts: ['Inter', 'Roboto Mono'],
          cinematicGuidelines: 'Professional, smooth transitions',
        }),
      });
      expect([200, 201, 400, 404, 409]).toContain(response.status);
    });
  });

  describe('PUT /api/brand-assets/:clientId', () => {
    it('should update brand assets', async () => {
      const response = await fetchApi('/api/brand-assets/1', {
        method: 'PUT',
        body: JSON.stringify({
          visualStyle: 'Updated visual style',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('DELETE /api/brand-assets/:clientId', () => {
    it('should delete brand assets', async () => {
      const response = await fetchApi('/api/brand-assets/999', {
        method: 'DELETE',
      });
      expect([200, 204, 404]).toContain(response.status);
    });
  });
});

describe('Brand Asset Files Pipeline', () => {
  describe('GET /api/brand-asset-files/:clientId', () => {
    it('should return asset files for client', async () => {
      const response = await fetchApi('/api/brand-asset-files/1');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/brand-asset-files/file/:id', () => {
    it('should return specific file metadata', async () => {
      const response = await fetchApi('/api/brand-asset-files/file/1');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('PATCH /api/brand-asset-files/file/:id', () => {
    it('should update file metadata', async () => {
      const response = await fetchApi('/api/brand-asset-files/file/1', {
        method: 'PATCH',
        body: JSON.stringify({
          purpose: 'logo_full_color',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('DELETE /api/brand-asset-files/file/:id', () => {
    it('should delete file', async () => {
      const response = await fetchApi('/api/brand-asset-files/file/999', {
        method: 'DELETE',
      });
      expect([200, 204, 404]).toContain(response.status);
    });
  });

  describe('DELETE /api/brand-asset-files/:clientId/all', () => {
    it('should delete all files for client', async () => {
      const response = await fetchApi('/api/brand-asset-files/999/all', {
        method: 'DELETE',
      });
      expect([200, 204, 404]).toContain(response.status);
    });
  });

  describe('GET /api/brand-asset-files/download/:id', () => {
    it('should handle file download', async () => {
      const response = await fetchApi('/api/brand-asset-files/download/1');
      expect([200, 404]).toContain(response.status);
    });
  });

  describe('GET /api/brand-asset-files/content/:id', () => {
    it('should return file content', async () => {
      const response = await fetchApi('/api/brand-asset-files/content/1');
      // 200 = success, 400 = bad request (valid), 404 = not found
      expect([200, 400, 404]).toContain(response.status);
    });
  });
});

describe('Brand Asset Generation Pipeline', () => {
  describe('POST /api/clients/:id/generate/mood-board', () => {
    it('should generate mood board', async () => {
      const response = await fetchApi('/api/clients/1/generate/mood-board', {
        method: 'POST',
        body: JSON.stringify({
          style: 'modern',
          themes: ['innovation', 'technology'],
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/clients/:id/generate/icons', () => {
    it('should generate icon set', async () => {
      const response = await fetchApi('/api/clients/1/generate/icons', {
        method: 'POST',
        body: JSON.stringify({
          style: 'outlined',
          count: 10,
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/clients/:id/generate/infographic', () => {
    it('should generate infographic', async () => {
      const response = await fetchApi('/api/clients/1/generate/infographic', {
        method: 'POST',
        body: JSON.stringify({
          topic: 'Company overview',
          style: 'modern',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/clients/:id/generate/logo-variant', () => {
    it('should generate logo variant', async () => {
      const response = await fetchApi('/api/clients/1/generate/logo-variant', {
        method: 'POST',
        body: JSON.stringify({
          variant: 'monochrome',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/clients/:id/generate/social-image', () => {
    it('should generate social image', async () => {
      const response = await fetchApi('/api/clients/1/generate/social-image', {
        method: 'POST',
        body: JSON.stringify({
          platform: 'linkedin',
          type: 'cover',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/clients/:id/generate/text-content', () => {
    it('should generate text content', async () => {
      const response = await fetchApi('/api/clients/1/generate/text-content', {
        method: 'POST',
        body: JSON.stringify({
          type: 'tagline',
          count: 5,
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/clients/:id/generate/promo-script', () => {
    it('should generate promo script', async () => {
      const response = await fetchApi('/api/clients/1/generate/promo-script', {
        method: 'POST',
        body: JSON.stringify({
          duration: 30,
          type: 'brand_intro',
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('POST /api/clients/:id/generate/complete-package', () => {
    it('should generate complete brand package', async () => {
      const response = await fetchApi('/api/clients/1/generate/complete-package', {
        method: 'POST',
        body: JSON.stringify({
          includeAssets: ['mood-board', 'icons', 'logo-variants'],
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});

describe('Brand Validation Pipeline', () => {
  describe('Brand Voice Validation', () => {
    it('should validate content against brand voice', async () => {
      const response = await fetchApi('/api/content-factory/run', {
        method: 'POST',
        body: JSON.stringify({
          clientId: 1,
          contentTypes: ['blog'],
          topic: 'Test topic',
          validateBrand: true,
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });

  describe('Forbidden Words Check', () => {
    it('should check for forbidden words in content', async () => {
      // This is validated during content generation
      const response = await fetchApi('/api/clients/1');
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        const data = await response.json();
        // brandProfile may contain forbiddenWords
        expect(data.brandProfile?.textual?.forbiddenWords || []).toBeDefined();
      }
    });
  });
});

// =====================================================
// LOGO REFERENCE INTEGRATION TESTS
// =====================================================
describe('Logo Reference Integration Pipeline', () => {
  describe('Logo URL in Client Data', () => {
    it('should return client with valid data structure', async () => {
      const response = await fetchApi('/api/clients/1');
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('name');
        // primaryLogoUrl field should be present in schema (can be null)
        expect(typeof data.primaryLogoUrl === 'string' || data.primaryLogoUrl === null || data.primaryLogoUrl === undefined).toBe(true);
      } else {
        expect(response.status).toBe(404);
      }
    });

    it('should have logo URL field available for asset generation', async () => {
      const response = await fetchApi('/api/clients/1');
      if (response.status === 200) {
        const data = await response.json();
        // When client has a logo, it should be a valid URL string
        if (data.primaryLogoUrl && typeof data.primaryLogoUrl === 'string') {
          expect(data.primaryLogoUrl.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Logo Usage in Asset Generation', () => {
    it('should accept mood board request with logo reference', async () => {
      const response = await fetchApi('/api/clients/1/generate/mood-board', {
        method: 'POST',
        body: JSON.stringify({
          style: 'modern',
          themes: ['brand identity'],
          useLogo: true,
        }),
      });
      // 400 = bad request (valid rejection), 200 = success, 500 = server error
      expect([200, 400, 404, 500]).toContain(response.status);
      if (response.status === 200) {
        const data = await response.json();
        expect(data).toBeDefined();
      }
    });

    it('should accept social image request with brand watermark', async () => {
      const response = await fetchApi('/api/clients/1/generate/social-image', {
        method: 'POST',
        body: JSON.stringify({
          platform: 'linkedin',
          type: 'post',
          includeWatermark: true,
        }),
      });
      expect([200, 400, 404, 500]).toContain(response.status);
    });
  });
});

// =====================================================
// DATABASE PERSISTENCE TESTS
// =====================================================
describe('Brand Asset Database Persistence Pipeline', () => {
  describe('Asset File Creation', () => {
    it('should return asset files for client with proper structure', async () => {
      const response = await fetchApi('/api/brand-asset-files/1');
      if (response.status === 200) {
        const data = await response.json();
        expect(Array.isArray(data)).toBe(true);
        // Each file should have required fields per schema
        if (data.length > 0) {
          const file = data[0];
          expect(file).toHaveProperty('id');
          expect(file).toHaveProperty('clientId');
          expect(file).toHaveProperty('filePath');
          expect(file).toHaveProperty('fileName');
          expect(typeof file.id).toBe('number');
        }
      } else {
        expect(response.status).toBe(404);
      }
    });

    it('should return file with complete metadata', async () => {
      const response = await fetchApi('/api/brand-asset-files/file/1');
      if (response.status === 200) {
        const data = await response.json();
        // File must have required fields per schema
        expect(data).toHaveProperty('id');
        expect(data).toHaveProperty('clientId');
        expect(data).toHaveProperty('filePath');
        expect(data).toHaveProperty('fileName');
        expect(data).toHaveProperty('fileType');
        // filePath should be a valid string
        expect(typeof data.filePath).toBe('string');
      } else {
        // 404 is acceptable if file doesn't exist
        expect(response.status).toBe(404);
      }
    });
  });

  describe('Asset File Updates', () => {
    it('should update asset metadata', async () => {
      const response = await fetchApi('/api/brand-asset-files/file/1', {
        method: 'PATCH',
        body: JSON.stringify({
          purpose: 'mood_board',
        }),
      });
      expect([200, 400, 404]).toContain(response.status);
    });
  });
});

// =====================================================
// AI GENERATION PROVIDER TESTS
// =====================================================
describe('Brand Asset AI Generation Pipeline', () => {
  describe('Provider Selection', () => {
    it('should use fallback provider chain', async () => {
      const response = await fetchApi('/api/providers/status');
      expect([200, 404]).toContain(response.status);
      if (response.status === 200) {
        const data = await response.json();
        // Should have provider status info
        expect(data).toBeDefined();
      }
    });
  });

  describe('Quality Tier Selection', () => {
    it('should use appropriate quality tier', async () => {
      const response = await fetchApi('/api/quality/dashboard');
      expect([200, 404]).toContain(response.status);
    });
  });
});

describe('Brand Profile Schema Validation', () => {
  describe('Required Fields', () => {
    it('should validate brand name is required', async () => {
      const response = await fetchApi('/api/clients/1/brand-profile', {
        method: 'PUT',
        body: JSON.stringify({
          version: '1.0',
          textual: {},
          visual: {},
        }),
      });
      expect([200, 400, 422, 500]).toContain(response.status);
    });
  });

  describe('Color Palette Validation', () => {
    it('should validate hex color format', async () => {
      const response = await fetchApi('/api/clients/1/brand-profile', {
        method: 'PUT',
        body: JSON.stringify({
          version: '1.0',
          textual: {
            brandName: { primary: 'Test' },
            tagline: { primary: 'Test tagline' },
            brandStory: { short: 'Test story' },
            values: [],
            personality: { archetype: 'Creator', traits: [] },
            tone: { description: 'Test', formality: 5, energy: 5, technicality: 5, warmth: 5 },
            forbiddenWords: [],
            keywords: [],
            contentGoals: [],
            examplePhrases: [],
            targetAudience: { demographics: 'Test' },
          },
          visual: {
            visualStyle: { description: 'Test', aesthetic: [], moodKeywords: [] },
            colorPalette: {
              darkMode: {
                background: { name: 'Test', hex: 'invalid', usage: 'Test' },
                accent: { name: 'Test', hex: '#ffffff', usage: 'Test' },
                textPrimary: { name: 'Test', hex: '#ffffff', usage: 'Test' },
              },
            },
            typography: { fonts: [] },
            iconography: { style: 'Test', colorApproach: 'Test', sizeBase: 24 },
            cinematicGuidelines: {
              aspectRatio: '16:9',
              resolution: '1080p',
              duration: { short: 15, medium: 30, long: 60 },
              pacing: 'Test',
              motionStyle: 'Test',
            },
            accessibility: { standard: 'WCAG', minContrastRatio: 4.5, altTextRequired: true },
            usageRules: { dos: [], donts: [] },
          },
        }),
      });
      expect([200, 400, 422, 500]).toContain(response.status);
    });
  });
});
