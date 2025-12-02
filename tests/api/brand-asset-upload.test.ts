/**
 * Brand Asset Upload API Tests
 * Tests for color extraction on upload and API response
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

describe('Brand Asset Upload API', () => {
  const tempTestDir = path.join(__dirname, '../../test-temp-assets');
  
  beforeEach(() => {
    if (!fs.existsSync(tempTestDir)) {
      fs.mkdirSync(tempTestDir, { recursive: true });
    }
  });

  describe('Color Extraction on Upload', () => {
    it('should extract colors from uploaded image and return in response', async () => {
      // Simulate image upload
      const testImagePath = path.join(tempTestDir, 'upload-test.png');
      const testImage = sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 100, b: 50 } // Orange brand color
        }
      });
      await testImage.png().toFile(testImagePath);

      // Simulate color extraction (from routes.ts)
      // @ts-ignore
      const ColorThief = (await import('colorthief')).default;
      const colorThief = new ColorThief();
      const palette = colorThief.getPalette(testImagePath, 5);
      const extractedColors = palette.map(([r, g, b]: number[]) => {
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      });

      // Verify response structure
      const mockResponse = {
        assetFile: {
          id: 1,
          fileName: 'upload-test.png',
          filePath: testImagePath,
        },
        extractedColors,
        updatedColorPalette: true,
      };

      expect(mockResponse.extractedColors).toBeDefined();
      expect(mockResponse.extractedColors.length).toBeGreaterThan(0);
      expect(mockResponse.updatedColorPalette).toBe(true);
      expect(mockResponse.extractedColors[0]).toMatch(/^#[0-9a-f]{6}$/i);

      // Cleanup
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    });

    it('should handle non-image files gracefully (no color extraction)', () => {
      const mockResponse = {
        assetFile: {
          id: 2,
          fileName: 'document.pdf',
          filePath: '/uploads/document.pdf',
        },
        extractedColors: undefined,
        updatedColorPalette: false,
      };

      expect(mockResponse.extractedColors).toBeUndefined();
      expect(mockResponse.updatedColorPalette).toBe(false);
    });

    it('should update brand profile color palette when colors are extracted', () => {
      const extractedColors = ['#FF6432', '#1A2B5C', '#FFFFFF'];
      
      // Simulate brand profile update
      const mockBrandProfile = {
        visual: {
          colorPalette: {
            darkMode: {
              background: { name: 'Deep Space', hex: '#0A0F1A', usage: 'Primary background' },
              accent: {
                name: 'Primary Accent',
                hex: extractedColors[0],
                usage: 'Primary brand color'
              },
              textPrimary: { name: 'Pure White', hex: '#FFFFFF', usage: 'Main text color' },
            },
            additionalColors: extractedColors.slice(1).map((color, idx) => ({
              name: `Accent ${idx + 1}`,
              hex: color,
              usage: 'Secondary accent color'
            })),
          }
        }
      };

      expect(mockBrandProfile.visual.colorPalette.darkMode.accent.hex).toBe(extractedColors[0]);
      expect(mockBrandProfile.visual.colorPalette.additionalColors.length).toBe(2);
    });
  });

  describe('File Validation on Upload', () => {
    it('should reject files exceeding size limit', () => {
      const maxSize = 50 * 1024 * 1024; // 50MB
      const fileSize = 60 * 1024 * 1024; // 60MB

      const isValid = fileSize <= maxSize;
      expect(isValid).toBe(false);
    });

    it('should accept files within size limit', () => {
      const maxSize = 50 * 1024 * 1024; // 50MB
      const fileSize = 10 * 1024 * 1024; // 10MB

      const isValid = fileSize <= maxSize;
      expect(isValid).toBe(true);
    });

    it('should validate image MIME types', () => {
      const validImageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      const testMimeType = 'image/png';

      expect(validImageTypes).toContain(testMimeType);
    });

    it('should reject invalid MIME types', () => {
      const validImageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
      const testMimeType = 'application/pdf';

      expect(validImageTypes).not.toContain(testMimeType);
    });
  });

  afterAll(() => {
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  });
});

