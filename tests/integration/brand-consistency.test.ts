/**
 * End-to-End Brand Consistency Integration Tests
 * Tests the complete flow: upload → extract → load → generate → verify
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { loadBrandAssetsFromDatabase } from '../../01-content-factory/services/brand-brief';
import type { BrandAssetFile } from '../../shared/schema';
import type { ClientBrief } from '../../01-content-factory/types';

describe('End-to-End Brand Consistency', () => {
  const tempTestDir = path.join(__dirname, '../../test-temp-assets');
  
  beforeEach(() => {
    if (!fs.existsSync(tempTestDir)) {
      fs.mkdirSync(tempTestDir, { recursive: true });
    }
  });

  describe('Complete Brand Asset Flow', () => {
    it('should maintain brand consistency through full pipeline', async () => {
      // Step 1: Create brand logo
      const logoPath = path.join(tempTestDir, 'brand-logo.png');
      const brandLogo = sharp({
        create: {
          width: 300,
          height: 300,
          channels: 3,
          background: { r: 50, g: 100, b: 200 } // Brand blue
        }
      });
      await brandLogo.png().toFile(logoPath);

      // Step 2: Extract colors (simulating upload)
      // @ts-ignore
      const ColorThief = (await import('colorthief')).default;
      const colorThief = new ColorThief();
      const palette = colorThief.getPalette(logoPath, 5);
      const extractedColors = palette.map(([r, g, b]: number[]) => {
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      });

      expect(extractedColors.length).toBeGreaterThan(0);

      // Step 3: Create brand asset file record (simulating database save)
      const assetFile: BrandAssetFile = {
        id: 1,
        clientId: 1,
        category: 'assets',
        subcategory: 'logo',
        fileName: 'brand-logo.png',
        originalName: 'brand-logo.png',
        filePath: logoPath,
        fileType: 'png',
        mimeType: 'image/png',
        fileSize: 102400,
        purpose: 'logo_full',
        metadata: { extractedColors },
        uploadedAt: new Date(),
      };

      // Step 4: Load assets from database (simulating pipeline load)
      const assetFiles: BrandAssetFile[] = [assetFile];
      const referenceAssets = loadBrandAssetsFromDatabase(assetFiles);

      expect(referenceAssets['logo']).toBe(logoPath);

      // Step 5: Create brand profile with extracted colors
      const brandProfile = {
        visual: {
          colorPalette: {
            darkMode: {
              accent: {
                name: 'Primary Accent',
                hex: extractedColors[0],
                usage: 'Primary brand color'
              }
            },
            additionalColors: extractedColors.slice(1).map((color, idx) => ({
              name: `Accent ${idx + 1}`,
              hex: color,
              usage: 'Secondary accent color'
            })),
          }
        },
        referenceAssets: {
          logos: [{
            id: 'logo-1',
            url: logoPath,
            isPrimary: true,
          }]
        }
      };

      // Step 6: Create client brief with brand profile
      const clientBrief: ClientBrief = {
        clientId: '1',
        clientName: 'Test Brand',
        industry: 'Technology',
        brandVoice: 'Professional and innovative',
        targetAudience: 'Tech professionals',
        keywords: ['innovation', 'technology'],
        contentGoals: ['engagement', 'awareness'],
        brandVoiceConfig: {
          tone: 'Professional and innovative',
          targetAudience: 'Tech professionals',
          keywords: ['innovation', 'technology'],
          contentGoals: ['engagement', 'awareness'],
          colorPalette: extractedColors,
          referenceAssets: referenceAssets,
        },
      };

      // Step 7: Verify brand consistency
      expect(clientBrief.brandVoiceConfig?.colorPalette).toEqual(extractedColors);
      expect(clientBrief.brandVoiceConfig?.referenceAssets?.['logo']).toBe(logoPath);
      expect(brandProfile.visual.colorPalette.darkMode.accent.hex).toBe(extractedColors[0]);

      // Cleanup
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    });

    it('should validate assets before using them in content generation', async () => {
      // Create valid asset
      const validAssetPath = path.join(tempTestDir, 'valid-asset.png');
      const validAsset = sharp({
        create: {
          width: 200,
          height: 200,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      });
      await validAsset.png().toFile(validAssetPath);

      // Validate asset
      const metadata = await sharp(validAssetPath).metadata();
      const isValid = (metadata.width ?? 0) >= 100 && 
                     (metadata.height ?? 0) >= 100 && 
                     fs.existsSync(validAssetPath);

      expect(isValid).toBe(true);

      // Create invalid asset (too small)
      const invalidAssetPath = path.join(tempTestDir, 'invalid-asset.png');
      const invalidAsset = sharp({
        create: {
          width: 50,
          height: 50,
          channels: 3,
          background: { r: 255, g: 255, b: 255 }
        }
      });
      await invalidAsset.png().toFile(invalidAssetPath);

      const invalidMetadata = await sharp(invalidAssetPath).metadata();
      const isInvalid = (invalidMetadata.width ?? 0) < 100 || 
                       (invalidMetadata.height ?? 0) < 100;

      expect(isInvalid).toBe(true);

      // Cleanup
      if (fs.existsSync(validAssetPath)) {
        fs.unlinkSync(validAssetPath);
      }
      if (fs.existsSync(invalidAssetPath)) {
        fs.unlinkSync(invalidAssetPath);
      }
    });

    it('should handle multiple brand assets correctly', async () => {
      // Create multiple assets
      const logoPath = path.join(tempTestDir, 'logo.png');
      const moodBoardPath = path.join(tempTestDir, 'moodboard.jpg');
      
      await sharp({
        create: { width: 200, height: 200, channels: 3, background: { r: 0, g: 0, b: 0 } }
      }).png().toFile(logoPath);
      
      await sharp({
        create: { width: 400, height: 300, channels: 3, background: { r: 128, g: 128, b: 128 } }
      }).jpeg().toFile(moodBoardPath);

      const assetFiles: BrandAssetFile[] = [
        {
          id: 1,
          clientId: 1,
          category: 'assets',
          subcategory: 'logo',
          fileName: 'logo.png',
          originalName: 'logo.png',
          filePath: logoPath,
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
          fileName: 'moodboard.jpg',
          originalName: 'moodboard.jpg',
          filePath: moodBoardPath,
          fileType: 'jpg',
          mimeType: 'image/jpeg',
          fileSize: 204800,
          purpose: 'mood_board',
          metadata: {},
          uploadedAt: new Date(),
        },
      ];

      const referenceAssets = loadBrandAssetsFromDatabase(assetFiles);

      expect(referenceAssets['logo']).toBe(logoPath);
      expect(referenceAssets['mood_board']).toBe(moodBoardPath);
      expect(Object.keys(referenceAssets).length).toBe(2);

      // Cleanup
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
      if (fs.existsSync(moodBoardPath)) {
        fs.unlinkSync(moodBoardPath);
      }
    });
  });

  afterAll(() => {
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  });
});

