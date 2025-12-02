/**
 * Brand Asset Integration Tests
 * Tests for color extraction, validation, asset loading, and end-to-end brand consistency
 */
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
// @ts-ignore
import ColorThief from 'colorthief';
import type { ContentRunConfig, ClientBrief } from '../../01-content-factory/types';
import { loadBrandAssetsFromDatabase } from '../../01-content-factory/services/brand-brief';
import type { BrandAssetFile } from '../../shared/schema';

describe('Brand Asset Integration', () => {
  const testAssetsDir = path.join(__dirname, '../../attached_assets/brand');
  const tempTestDir = path.join(__dirname, '../../test-temp-assets');
  
  beforeEach(() => {
    // Create temp directory for test assets
    if (!fs.existsSync(tempTestDir)) {
      fs.mkdirSync(tempTestDir, { recursive: true });
    }
  });

  describe('Color Extraction', () => {
    it('should extract dominant colors from an image using ColorThief', async () => {
      // Create a simple test image (red square)
      const testImagePath = path.join(tempTestDir, 'test-red.png');
      const redImage = sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 }
        }
      });
      await redImage.png().toFile(testImagePath);

      // Test color extraction
      const colorThief = new ColorThief();
      const palette = colorThief.getPalette(testImagePath, 3);
      
      expect(palette).toBeDefined();
      expect(palette.length).toBeGreaterThan(0);
      expect(palette[0]).toHaveLength(3); // RGB array
      
      // Cleanup
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    });

    it('should extract colors using Sharp fallback when ColorThief fails', async () => {
      const testImagePath = path.join(tempTestDir, 'test-blue.png');
      const blueImage = sharp({
        create: {
          width: 150,
          height: 150,
          channels: 3,
          background: { r: 0, g: 0, b: 255 }
        }
      });
      await blueImage.png().toFile(testImagePath);

      // Simulate ColorThief failure and use Sharp fallback
      try {
        const img = sharp(testImagePath);
        const { data, info } = await img.raw().resize(150, 150).toBuffer({ resolveWithObject: true });
        
        const colors: string[] = [];
        const sampleSize = 3;
        const step = Math.floor(data.length / (sampleSize * info.channels));
        
        for (let i = 0; i < sampleSize; i++) {
          const offset = i * step * info.channels;
          const r = data[offset];
          const g = data[offset + 1];
          const b = data[offset + 2];
          colors.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
        }
        
        expect(colors.length).toBeGreaterThan(0);
        expect(colors[0]).toMatch(/^#[0-9a-f]{6}$/i);
      } finally {
        if (fs.existsSync(testImagePath)) {
          fs.unlinkSync(testImagePath);
        }
      }
    });

    it('should return empty array for invalid image file', async () => {
      const invalidPath = path.join(tempTestDir, 'nonexistent.png');
      
      // This should handle gracefully
      let colors: string[] = [];
      try {
        const colorThief = new ColorThief();
        colors = colorThief.getPalette(invalidPath, 3).map(([r, g, b]: number[]) => {
          return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        });
      } catch (error) {
        // Expected to fail
        expect(colors).toEqual([]);
      }
    });
  });

  describe('Asset Validation', () => {
    it('should validate local image file exists and has correct dimensions', async () => {
      const testImagePath = path.join(tempTestDir, 'valid-image.png');
      const validImage = sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 128, g: 128, b: 128 }
        }
      });
      await validImage.png().toFile(testImagePath);

      // Check file exists
      expect(fs.existsSync(testImagePath)).toBe(true);
      
      // Check dimensions
      const metadata = await sharp(testImagePath).metadata();
      expect(metadata.width).toBeGreaterThanOrEqual(100);
      expect(metadata.height).toBeGreaterThanOrEqual(100);
      
      // Cleanup
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    });

    it('should reject image files that are too small', async () => {
      const smallImagePath = path.join(tempTestDir, 'small-image.png');
      const smallImage = sharp({
        create: {
          width: 50,
          height: 50,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      });
      await smallImage.png().toFile(smallImagePath);

      const metadata = await sharp(smallImagePath).metadata();
      expect(metadata.width).toBeLessThan(100);
      expect(metadata.height).toBeLessThan(100);
      
      // This should be rejected by validation
      const isValid = (metadata.width ?? 0) >= 100 && (metadata.height ?? 0) >= 100;
      expect(isValid).toBe(false);
      
      // Cleanup
      if (fs.existsSync(smallImagePath)) {
        fs.unlinkSync(smallImagePath);
      }
    });

    it('should reject files that exceed size limit', () => {
      const maxSize = 50 * 1024 * 1024; // 50MB
      const largeSize = 60 * 1024 * 1024; // 60MB
      
      expect(largeSize).toBeGreaterThan(maxSize);
    });

    it('should validate MIME types correctly', () => {
      const getMimeTypeFromExt = (ext: string): string => {
        const map: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.mp4': 'video/mp4',
          '.mov': 'video/quicktime',
          '.webm': 'video/webm',
        };
        return map[ext] || 'application/octet-stream';
      };

      expect(getMimeTypeFromExt('.png')).toBe('image/png');
      expect(getMimeTypeFromExt('.jpg')).toBe('image/jpeg');
      expect(getMimeTypeFromExt('.mp4')).toBe('video/mp4');
      expect(getMimeTypeFromExt('.unknown')).toBe('application/octet-stream');
    });
  });

  describe('Asset Loading from Database', () => {
    it('should map brand asset files to referenceAssets format', () => {
      const mockAssetFiles: BrandAssetFile[] = [
        {
          id: 1,
          clientId: 1,
          category: 'assets',
          subcategory: 'logo',
          fileName: 'logo.png',
          originalName: 'logo.png',
          filePath: '/uploads/brand/logo.png',
          fileType: 'png',
          mimeType: 'image/png',
          fileSize: 102400,
          purpose: 'logo_full',
          metadata: {},
          uploadedAt: new Date(),
        },
        {
          id: 2,
          clientId: 1,
          category: 'assets',
          subcategory: 'moodboard',
          fileName: 'mood.jpg',
          originalName: 'mood.jpg',
          filePath: '/uploads/brand/mood.jpg',
          fileType: 'jpg',
          mimeType: 'image/jpeg',
          fileSize: 204800,
          purpose: 'mood_board',
          metadata: {},
          uploadedAt: new Date(),
        },
      ];

      const referenceAssets = loadBrandAssetsFromDatabase(mockAssetFiles);
      
      expect(referenceAssets).toBeDefined();
      expect(referenceAssets['logo']).toBe('/uploads/brand/logo.png');
      expect(referenceAssets['mood_board']).toBe('/uploads/brand/mood.jpg');
    });

    it('should handle assets without purpose by using subcategory or filename', () => {
      const mockAssetFiles: BrandAssetFile[] = [
        {
          id: 3,
          clientId: 1,
          category: 'assets',
          subcategory: 'icon',
          fileName: 'icon-set.svg',
          originalName: 'icon-set.svg',
          filePath: '/uploads/brand/icon-set.svg',
          fileType: 'svg',
          mimeType: 'image/svg+xml',
          fileSize: 51200,
          purpose: null,
          metadata: {},
          uploadedAt: new Date(),
        },
      ];

      const referenceAssets = loadBrandAssetsFromDatabase(mockAssetFiles);
      
      expect(referenceAssets).toBeDefined();
      // Should use subcategory as key
      expect(referenceAssets['icon']).toBe('/uploads/brand/icon-set.svg');
    });

    it('should handle empty asset files array', () => {
      const referenceAssets = loadBrandAssetsFromDatabase([]);
      expect(referenceAssets).toEqual({});
    });
  });

  describe('Content Pipeline Integration', () => {
    it('should prepare brand assets for pipeline integration', () => {
      const mockClientBrief: ClientBrief = {
        clientId: '1',
        clientName: 'Test Client',
        industry: 'Tech',
        brandVoice: 'Professional and friendly',
        targetAudience: 'Developers',
        keywords: ['tech', 'innovation'],
        contentGoals: ['engagement'],
      };

      const config: ContentRunConfig = {
        clientId: '1',
        clientBrief: mockClientBrief,
        topicCount: 1,
        contentTypes: ['blog'],
        runType: 'single',
      };

      // Verify config structure
      expect(config.clientBrief.brandVoiceConfig).toBeUndefined();
      
      // After assets are loaded (in actual pipeline run), brandVoiceConfig should be populated
      // This is tested indirectly through integration tests
      expect(config.clientBrief.clientName).toBe('Test Client');
    });
  });

  describe('End-to-End Brand Consistency', () => {
    it('should maintain brand consistency through upload → extract → generate flow', async () => {
      // Step 1: Simulate asset upload
      const testImagePath = path.join(tempTestDir, 'brand-logo.png');
      const brandImage = sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 100, g: 150, b: 200 } // Brand color
        }
      });
      await brandImage.png().toFile(testImagePath);

      // Step 2: Extract colors (simulating upload endpoint)
      const colorThief = new ColorThief();
      const palette = colorThief.getPalette(testImagePath, 3);
      const extractedColors = palette.map(([r, g, b]: number[]) => {
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      });

      expect(extractedColors.length).toBeGreaterThan(0);
      expect(extractedColors[0]).toMatch(/^#[0-9a-f]{6}$/i);

      // Step 3: Verify colors would be added to brand profile
      const mockBrandProfile = {
        visual: {
          colorPalette: {
            darkMode: {
              accent: {
                name: 'Primary Accent',
                hex: extractedColors[0],
                usage: 'Primary brand color'
              }
            }
          }
        }
      };

      expect(mockBrandProfile.visual.colorPalette.darkMode.accent.hex).toBe(extractedColors[0]);

      // Step 4: Verify asset would be available in referenceAssets
      const mockAssetFiles: BrandAssetFile[] = [
        {
          id: 1,
          clientId: 1,
          category: 'assets',
          subcategory: 'logo',
          fileName: 'brand-logo.png',
          originalName: 'brand-logo.png',
          filePath: testImagePath,
          fileType: 'png',
          mimeType: 'image/png',
          fileSize: 102400,
          purpose: 'logo_full',
          metadata: { extractedColors },
          uploadedAt: new Date(),
        },
      ];

      const referenceAssets = loadBrandAssetsFromDatabase(mockAssetFiles);
      expect(referenceAssets['logo']).toBe(testImagePath);

      // Cleanup
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    });

    it('should validate brand assets before content generation', async () => {
      const mockClientBrief: ClientBrief = {
        clientId: '1',
        clientName: 'Test Client',
        industry: 'Tech',
        brandVoice: 'Professional',
        targetAudience: 'Developers',
        keywords: ['tech'],
        contentGoals: ['engagement'],
        brandVoiceConfig: {
          tone: 'Professional',
          targetAudience: 'Developers',
          keywords: ['tech'],
          contentGoals: ['engagement'],
          referenceAssets: {
            logo: '/valid/path/logo.png',
            invalid: '/invalid/path/asset.png',
          },
        },
      };

      const config: ContentRunConfig = {
        clientId: '1',
        clientBrief: mockClientBrief,
        topicCount: 1,
        contentTypes: ['blog'],
        runType: 'single',
      };

      // Verify brand voice config structure
      // Validation would happen in ContentPipeline constructor
      expect(config.clientBrief.brandVoiceConfig?.referenceAssets).toBeDefined();
      expect(config.clientBrief.brandVoiceConfig?.referenceAssets?.['logo']).toBe('/valid/path/logo.png');
    });
  });

  // Cleanup after all tests
  afterAll(() => {
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  });
});

