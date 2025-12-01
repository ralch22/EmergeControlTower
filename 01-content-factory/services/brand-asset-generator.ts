import { randomUUID } from 'crypto';
import { generatePrompt, formatPromptForProvider, generateVideoScript } from './smart-prompt-engine';
import { generateImageWithGemini } from '../integrations/gemini-image';
import { generateImageWithFal, isFalConfigured } from '../integrations/fal-ai';
import { generateWithClaude } from '../integrations/anthropic';
import { healthMonitor } from './provider-health-monitor';
import type { 
  BrandProfile, 
  AssetType, 
  AssetGenerationRequest, 
  AssetGenerationResult 
} from '../types/brand-profile';
import type { BrandProfileJSON, InsertBrandAssetFile, Client } from '../../shared/schema';
import * as fs from 'fs';
import * as path from 'path';

const uuidv4 = () => randomUUID();

// ============================================
// BRAND ASSET GENERATOR SERVICE
// Generates all brand assets using Smart Prompt Engine
// With database persistence for generated assets
// ============================================

const ASSET_OUTPUT_DIR = 'uploads/brand-assets';

// Storage interface for database persistence
let storageInstance: any = null;

export function setStorageInstance(storage: any) {
  storageInstance = storage;
}

// Helper to persist generated asset to database
async function persistAssetToDatabase(
  clientId: number,
  localPath: string,
  category: string,
  subcategory: string | null,
  purpose: string,
  mimeType: string,
  dimensions?: { width: number; height: number },
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!storageInstance) {
    console.warn('[BrandAssetGenerator] Storage instance not set - asset not persisted to database');
    return;
  }

  try {
    const fileName = path.basename(localPath);
    const fileStats = fs.statSync(localPath);
    
    const assetRecord: InsertBrandAssetFile = {
      clientId,
      category,
      subcategory,
      fileName,
      originalName: fileName,
      filePath: localPath,
      fileType: path.extname(fileName).slice(1) || 'png',
      mimeType,
      fileSize: fileStats.size,
      purpose,
      metadata: {
        ...metadata,
        dimensions,
        generatedAt: new Date().toISOString(),
        source: 'brand-asset-generator',
      },
    };

    await storageInstance.createBrandAssetFile(assetRecord);
    console.log(`[BrandAssetGenerator] Asset persisted to database: ${fileName}`);
  } catch (error: any) {
    console.error(`[BrandAssetGenerator] Failed to persist asset to database:`, error.message);
  }
}

// Helper to get client's logo reference for prompts
async function getClientLogoReference(clientId: number): Promise<string | undefined> {
  if (!storageInstance) return undefined;
  
  try {
    const client: Client | undefined = await storageInstance.getClient(clientId);
    if (client?.primaryLogoUrl) {
      return client.primaryLogoUrl;
    }
    
    // Try to get logo from brand asset files
    const logoFile = await storageInstance.getBrandAssetFilesByPurpose(clientId, 'logo_full_color');
    if (logoFile?.filePath) {
      return logoFile.filePath;
    }
  } catch (error: any) {
    console.warn(`[BrandAssetGenerator] Could not fetch logo reference:`, error.message);
  }
  
  return undefined;
}

// Helper to enhance prompt with logo reference
function enhancePromptWithLogoReference(prompt: string, logoPath?: string, brandName?: string): string {
  if (logoPath) {
    return `${prompt}\n\nIMPORTANT: This asset MUST be consistent with the brand's existing logo identity. Reference logo is available at: ${logoPath}. Maintain the same visual style, color usage patterns, and design language as the existing brand identity.`;
  }
  if (brandName) {
    return `${prompt}\n\nBrand name: ${brandName}. Ensure all generated assets reflect the brand identity.`;
  }
  return prompt;
}

// Ensure output directory exists
function ensureOutputDir(clientId: number): string {
  const dir = path.join(ASSET_OUTPUT_DIR, `client-${clientId}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Convert JSON profile to full BrandProfile type
function jsonToBrandProfile(json: BrandProfileJSON, clientId: number): BrandProfile {
  return {
    version: json.version,
    lastUpdated: json.lastUpdated,
    clientId,
    textual: {
      brandName: json.textual.brandName,
      tagline: { ...json.textual.tagline, maxWords: json.textual.tagline.maxWords || 10 },
      brandStory: json.textual.brandStory,
      mission: json.textual.mission,
      vision: json.textual.vision,
      values: json.textual.values,
      personality: json.textual.personality,
      tone: json.textual.tone,
      forbiddenWords: json.textual.forbiddenWords,
      keywords: json.textual.keywords,
      contentGoals: json.textual.contentGoals,
      pastSuccesses: json.textual.pastSuccesses,
      examplePhrases: json.textual.examplePhrases,
      callToActions: json.textual.callToActions,
      targetAudience: json.textual.targetAudience,
    },
    visual: {
      visualStyle: json.visual.visualStyle,
      colorPalette: {
        darkMode: {
          background: { ...json.visual.colorPalette.darkMode.background, usage: json.visual.colorPalette.darkMode.background.usage as any },
          accent: { ...json.visual.colorPalette.darkMode.accent, usage: json.visual.colorPalette.darkMode.accent.usage as any },
          textPrimary: { ...json.visual.colorPalette.darkMode.textPrimary, usage: json.visual.colorPalette.darkMode.textPrimary.usage as any },
          textSecondary: json.visual.colorPalette.darkMode.textSecondary ? { ...json.visual.colorPalette.darkMode.textSecondary, usage: json.visual.colorPalette.darkMode.textSecondary.usage as any } : undefined,
          success: json.visual.colorPalette.darkMode.success ? { ...json.visual.colorPalette.darkMode.success, usage: json.visual.colorPalette.darkMode.success.usage as any } : undefined,
          warning: json.visual.colorPalette.darkMode.warning ? { ...json.visual.colorPalette.darkMode.warning, usage: json.visual.colorPalette.darkMode.warning.usage as any } : undefined,
          error: json.visual.colorPalette.darkMode.error ? { ...json.visual.colorPalette.darkMode.error, usage: json.visual.colorPalette.darkMode.error.usage as any } : undefined,
        },
        lightMode: json.visual.colorPalette.lightMode ? {
          background: { ...json.visual.colorPalette.lightMode.background, usage: json.visual.colorPalette.lightMode.background.usage as any },
          accent: { ...json.visual.colorPalette.lightMode.accent, usage: json.visual.colorPalette.lightMode.accent.usage as any },
          textPrimary: { ...json.visual.colorPalette.lightMode.textPrimary, usage: json.visual.colorPalette.lightMode.textPrimary.usage as any },
        } : undefined,
        additionalColors: json.visual.colorPalette.additionalColors?.map(c => ({ ...c, usage: c.usage as any })),
      },
      typography: {
        fonts: json.visual.typography.fonts.map(f => ({ ...f, category: f.category as any, weights: f.weights })),
      },
      iconography: {
        style: json.visual.iconography.style as any,
        cornerStyle: json.visual.iconography.cornerStyle as any,
        shape: json.visual.iconography.shape,
        colorApproach: json.visual.iconography.colorApproach,
        sizeBase: json.visual.iconography.sizeBase,
      },
      cinematicGuidelines: {
        aspectRatio: json.visual.cinematicGuidelines.aspectRatio as any,
        resolution: json.visual.cinematicGuidelines.resolution as any,
        duration: json.visual.cinematicGuidelines.duration,
        pacing: json.visual.cinematicGuidelines.pacing as any,
        motionStyle: json.visual.cinematicGuidelines.motionStyle,
        transitionStyle: json.visual.cinematicGuidelines.transitionStyle,
        soundtrackStyle: json.visual.cinematicGuidelines.soundtrackStyle,
        colorGrading: json.visual.cinematicGuidelines.colorGrading,
      },
      accessibility: {
        standard: json.visual.accessibility.standard as any,
        minContrastRatio: json.visual.accessibility.minContrastRatio,
        altTextRequired: json.visual.accessibility.altTextRequired,
        noFlashing: true,
        focusIndicators: true,
      },
      usageRules: json.visual.usageRules,
    },
    referenceAssets: json.referenceAssets as any,
  };
}

// Save base64 image to file
async function saveImageToFile(base64Data: string, clientId: number, filename: string): Promise<string> {
  const outputDir = ensureOutputDir(clientId);
  const filePath = path.join(outputDir, filename);
  
  // Remove data URL prefix if present
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Clean, 'base64');
  
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

// Save URL image to file
async function downloadAndSaveImage(url: string, clientId: number, filename: string): Promise<string> {
  const outputDir = ensureOutputDir(clientId);
  const filePath = path.join(outputDir, filename);
  
  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  } catch (error) {
    console.error(`Failed to download image from ${url}:`, error);
    throw error;
  }
}

// ============================================
// MOOD BOARD GENERATOR
// ============================================
export async function generateMoodBoard(
  profile: BrandProfile | BrandProfileJSON,
  clientId: number
): Promise<AssetGenerationResult> {
  const startTime = Date.now();
  const brandProfile = 'clientId' in profile ? profile : jsonToBrandProfile(profile, clientId);
  
  // Get logo reference for brand consistency
  const logoReference = await getClientLogoReference(clientId);
  
  const promptContext = generatePrompt({
    brandProfile,
    assetType: 'mood_board',
  });
  
  let formattedPrompt = formatPromptForProvider(promptContext, 'gemini');
  formattedPrompt = enhancePromptWithLogoReference(formattedPrompt, logoReference, brandProfile.textual.brandName.primary);
  console.log(`[BrandAssetGenerator] Generating mood board for client ${clientId} (logo ref: ${logoReference ? 'yes' : 'no'})`);
  
  // Try Gemini first, then Fal
  let result: AssetGenerationResult;
  
  if (!healthMonitor.isProviderQuarantined('gemini_image')) {
    try {
      const geminiResult = await generateImageWithGemini(formattedPrompt, 'professional brand collage');
      
      if (geminiResult.success && geminiResult.imageDataUrl) {
        const filename = `mood_board_${uuidv4().slice(0, 8)}.png`;
        const localPath = await saveImageToFile(geminiResult.imageDataUrl, clientId, filename);
        
        // Persist to database
        await persistAssetToDatabase(
          clientId, localPath, 'assets', 'mood-board', 'mood_board',
          'image/png', { width: 1920, height: 1080 }, { provider: 'gemini' }
        );
        
        await healthMonitor.recordRequest('gemini_image', 'image_generation', uuidv4(), {
          success: true,
          latencyMs: Date.now() - startTime,
        });
        
        return {
          success: true,
          assetType: 'mood_board',
          assets: [{
            id: uuidv4(),
            localPath,
            base64: geminiResult.imageDataUrl,
            mimeType: 'image/png',
            dimensions: { width: 1920, height: 1080 },
          }],
          provider: 'gemini',
          processingTime: Date.now() - startTime,
        };
      }
    } catch (error: any) {
      console.error('[BrandAssetGenerator] Gemini mood board failed:', error.message);
      await healthMonitor.recordRequest('gemini_image', 'image_generation', uuidv4(), {
        success: false,
        latencyMs: Date.now() - startTime,
        errorMessage: error.message,
      });
    }
  }
  
  // Fallback to Fal AI
  if (!healthMonitor.isProviderQuarantined('fal_flux') && isFalConfigured()) {
    try {
      const { generateImageWithFalFluxPro } = await import('../integrations/fal-ai');
      const falResult = await generateImageWithFalFluxPro(formattedPrompt, {
        width: 1920,
        height: 1080,
      });
      
      if (falResult.success && falResult.imageUrl) {
        const filename = `mood_board_${uuidv4().slice(0, 8)}.png`;
        const localPath = await downloadAndSaveImage(falResult.imageUrl, clientId, filename);
        
        // Persist to database
        await persistAssetToDatabase(
          clientId, localPath, 'assets', 'mood-board', 'mood_board',
          'image/png', { width: 1920, height: 1080 }, { provider: 'fal' }
        );
        
        await healthMonitor.recordRequest('fal_flux', 'image_generation', uuidv4(), {
          success: true,
          latencyMs: Date.now() - startTime,
        });
        
        return {
          success: true,
          assetType: 'mood_board',
          assets: [{
            id: uuidv4(),
            url: falResult.imageUrl,
            localPath,
            mimeType: 'image/png',
            dimensions: { width: 1920, height: 1080 },
          }],
          provider: 'fal',
          processingTime: Date.now() - startTime,
        };
      }
    } catch (error: any) {
      console.error('[BrandAssetGenerator] Fal mood board failed:', error.message);
      await healthMonitor.recordRequest('fal_flux', 'image_generation', uuidv4(), {
        success: false,
        latencyMs: Date.now() - startTime,
        errorMessage: error.message,
      });
    }
  }
  
  return {
    success: false,
    assetType: 'mood_board',
    assets: [],
    error: 'All image providers failed to generate mood board',
    processingTime: Date.now() - startTime,
  };
}

// ============================================
// ICON SET GENERATOR
// ============================================
export async function generateIconSet(
  profile: BrandProfile | BrandProfileJSON,
  clientId: number,
  iconNames: string[] = ['lock', 'shield', 'flame', 'arrow', 'chain', 'wallet', 'chart', 'secure', 'yield', 'bridge']
): Promise<AssetGenerationResult> {
  const startTime = Date.now();
  const brandProfile = 'clientId' in profile ? profile : jsonToBrandProfile(profile, clientId);
  const assets: AssetGenerationResult['assets'] = [];
  
  // Get logo reference for brand consistency
  const logoReference = await getClientLogoReference(clientId);
  
  console.log(`[BrandAssetGenerator] Generating ${iconNames.length} icons for client ${clientId} (logo ref: ${logoReference ? 'yes' : 'no'})`);
  
  for (const iconName of iconNames) {
    const promptContext = generatePrompt({
      brandProfile,
      assetType: 'icon_individual',
      options: { iconNames: [iconName] },
    });
    
    let formattedPrompt = formatPromptForProvider(promptContext, 'gemini');
    formattedPrompt = enhancePromptWithLogoReference(formattedPrompt, logoReference, brandProfile.textual.brandName.primary);
    
    try {
      const geminiResult = await generateImageWithGemini(
        formattedPrompt,
        'minimal vector icon, flat design, single color'
      );
      
      if (geminiResult.success && geminiResult.imageDataUrl) {
        const filename = `icon_${iconName}_${uuidv4().slice(0, 8)}.png`;
        const localPath = await saveImageToFile(geminiResult.imageDataUrl, clientId, filename);
        
        // Persist to database
        await persistAssetToDatabase(
          clientId, localPath, 'assets', 'icons', 'icon_individual',
          'image/png', { width: 48, height: 48 }, { iconName, provider: 'gemini' }
        );
        
        assets.push({
          id: uuidv4(),
          localPath,
          base64: geminiResult.imageDataUrl,
          mimeType: 'image/png',
          dimensions: { width: 48, height: 48 },
          metadata: { iconName },
        });
      }
    } catch (error: any) {
      console.error(`[BrandAssetGenerator] Icon ${iconName} generation failed:`, error.message);
    }
    
    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return {
    success: assets.length > 0,
    assetType: 'icon_set',
    assets,
    provider: 'gemini',
    processingTime: Date.now() - startTime,
    error: assets.length === 0 ? 'Failed to generate any icons' : undefined,
  };
}

// ============================================
// INFOGRAPHIC GENERATOR
// ============================================
export async function generateInfographic(
  profile: BrandProfile | BrandProfileJSON,
  clientId: number,
  type: 'tokenomics' | 'general' = 'tokenomics',
  data?: Record<string, unknown>
): Promise<AssetGenerationResult> {
  const startTime = Date.now();
  const brandProfile = 'clientId' in profile ? profile : jsonToBrandProfile(profile, clientId);
  
  // Get logo reference for brand consistency
  const logoReference = await getClientLogoReference(clientId);
  
  const promptContext = generatePrompt({
    brandProfile,
    assetType: 'infographic',
    options: { infographicData: { type, ...data } },
  });
  
  let formattedPrompt = formatPromptForProvider(promptContext, 'gemini');
  formattedPrompt = enhancePromptWithLogoReference(formattedPrompt, logoReference, brandProfile.textual.brandName.primary);
  console.log(`[BrandAssetGenerator] Generating ${type} infographic for client ${clientId} (logo ref: ${logoReference ? 'yes' : 'no'})`);
  
  // Try Gemini first
  if (!healthMonitor.isProviderQuarantined('gemini_image')) {
    try {
      const geminiResult = await generateImageWithGemini(
        formattedPrompt,
        'data visualization, infographic design, clean typography'
      );
      
      if (geminiResult.success && geminiResult.imageDataUrl) {
        const filename = `infographic_${type}_${uuidv4().slice(0, 8)}.png`;
        const localPath = await saveImageToFile(geminiResult.imageDataUrl, clientId, filename);
        
        // Persist to database
        await persistAssetToDatabase(
          clientId, localPath, 'assets', 'infographics', `${type}_infographic`,
          'image/png', { width: 1200, height: 1200 }, { type, provider: 'gemini' }
        );
        
        await healthMonitor.recordRequest('gemini_image', 'image_generation', uuidv4(), {
          success: true,
          latencyMs: Date.now() - startTime,
        });
        
        return {
          success: true,
          assetType: 'infographic',
          assets: [{
            id: uuidv4(),
            localPath,
            base64: geminiResult.imageDataUrl,
            mimeType: 'image/png',
            dimensions: { width: 1200, height: 1200 },
            metadata: { type },
          }],
          provider: 'gemini',
          processingTime: Date.now() - startTime,
        };
      }
    } catch (error: any) {
      console.error('[BrandAssetGenerator] Gemini infographic failed:', error.message);
      await healthMonitor.recordRequest('gemini_image', 'image_generation', uuidv4(), {
        success: false,
        latencyMs: Date.now() - startTime,
        errorMessage: error.message,
      });
    }
  }
  
  // Fallback to Fal AI
  if (!healthMonitor.isProviderQuarantined('fal_flux') && isFalConfigured()) {
    try {
      const { generateImageWithFalFluxPro } = await import('../integrations/fal-ai');
      const falResult = await generateImageWithFalFluxPro(formattedPrompt, {
        width: 1200,
        height: 1200,
      });
      
      if (falResult.success && falResult.imageUrl) {
        const filename = `infographic_${type}_${uuidv4().slice(0, 8)}.png`;
        const localPath = await downloadAndSaveImage(falResult.imageUrl, clientId, filename);
        
        // Persist to database
        await persistAssetToDatabase(
          clientId, localPath, 'assets', 'infographics', `${type}_infographic`,
          'image/png', { width: 1200, height: 1200 }, { type, provider: 'fal' }
        );
        
        await healthMonitor.recordRequest('fal_flux', 'image_generation', uuidv4(), {
          success: true,
          latencyMs: Date.now() - startTime,
        });
        
        return {
          success: true,
          assetType: 'infographic',
          assets: [{
            id: uuidv4(),
            url: falResult.imageUrl,
            localPath,
            mimeType: 'image/png',
            dimensions: { width: 1200, height: 1200 },
            metadata: { type },
          }],
          provider: 'fal',
          processingTime: Date.now() - startTime,
        };
      }
    } catch (error: any) {
      console.error('[BrandAssetGenerator] Fal infographic failed:', error.message);
      await healthMonitor.recordRequest('fal_flux', 'image_generation', uuidv4(), {
        success: false,
        latencyMs: Date.now() - startTime,
        errorMessage: error.message,
      });
    }
  }
  
  return {
    success: false,
    assetType: 'infographic',
    assets: [],
    error: 'All image providers failed to generate infographic',
    processingTime: Date.now() - startTime,
  };
}

// ============================================
// LOGO VARIANT GENERATOR
// ============================================
export async function generateLogoVariant(
  profile: BrandProfile | BrandProfileJSON,
  clientId: number,
  variantType: 'monochrome' | 'inverted' | 'simplified',
  referenceLogoUrl?: string
): Promise<AssetGenerationResult> {
  const startTime = Date.now();
  const brandProfile = 'clientId' in profile ? profile : jsonToBrandProfile(profile, clientId);
  
  // Get logo reference - use provided or fetch from client
  const logoReference = referenceLogoUrl || await getClientLogoReference(clientId);
  
  const promptContext = generatePrompt({
    brandProfile,
    assetType: 'logo_variant',
    options: { variantType },
  });
  
  let formattedPrompt = formatPromptForProvider(promptContext, 'gemini');
  formattedPrompt = enhancePromptWithLogoReference(formattedPrompt, logoReference, brandProfile.textual.brandName.primary);
  
  console.log(`[BrandAssetGenerator] Generating ${variantType} logo variant for client ${clientId} (logo ref: ${logoReference ? 'yes' : 'no'})`);
  
  try {
    const geminiResult = await generateImageWithGemini(
      formattedPrompt,
      'logo design, vector quality, brand identity'
    );
    
    if (geminiResult.success && geminiResult.imageDataUrl) {
      const filename = `logo_${variantType}_${uuidv4().slice(0, 8)}.png`;
      const localPath = await saveImageToFile(geminiResult.imageDataUrl, clientId, filename);
      
      // Persist to database
      await persistAssetToDatabase(
        clientId, localPath, 'logos', variantType, `logo_${variantType}`,
        'image/png', { width: 1024, height: 1024 }, { variantType, provider: 'gemini' }
      );
      
      return {
        success: true,
        assetType: 'logo_variant',
        assets: [{
          id: uuidv4(),
          localPath,
          base64: geminiResult.imageDataUrl,
          mimeType: 'image/png',
          dimensions: { width: 1024, height: 1024 },
          metadata: { variantType },
        }],
        provider: 'gemini',
        processingTime: Date.now() - startTime,
      };
    }
  } catch (error: any) {
    console.error('[BrandAssetGenerator] Logo variant generation failed:', error.message);
  }
  
  return {
    success: false,
    assetType: 'logo_variant',
    assets: [],
    error: 'Failed to generate logo variant',
    processingTime: Date.now() - startTime,
  };
}

// ============================================
// SOCIAL POST IMAGE GENERATOR
// ============================================
export async function generateSocialPostImage(
  profile: BrandProfile | BrandProfileJSON,
  clientId: number,
  platform: 'linkedin' | 'twitter' | 'instagram' | 'facebook',
  topic?: string
): Promise<AssetGenerationResult> {
  const startTime = Date.now();
  const brandProfile = 'clientId' in profile ? profile : jsonToBrandProfile(profile, clientId);
  
  // Get logo reference for brand consistency
  const logoReference = await getClientLogoReference(clientId);
  
  const promptContext = generatePrompt({
    brandProfile,
    assetType: 'social_post',
    options: { 
      platform,
      customPromptAdditions: topic ? `Topic: ${topic}` : undefined,
    },
  });
  
  let formattedPrompt = formatPromptForProvider(promptContext, 'gemini');
  formattedPrompt = enhancePromptWithLogoReference(formattedPrompt, logoReference, brandProfile.textual.brandName.primary);
  console.log(`[BrandAssetGenerator] Generating ${platform} social post image for client ${clientId} (logo ref: ${logoReference ? 'yes' : 'no'})`);
  
  const dimensions: Record<string, { width: number; height: number }> = {
    linkedin: { width: 1200, height: 627 },
    twitter: { width: 1600, height: 900 },
    instagram: { width: 1080, height: 1080 },
    facebook: { width: 1200, height: 630 },
  };
  
  try {
    const geminiResult = await generateImageWithGemini(
      formattedPrompt,
      'social media graphic, engaging design'
    );
    
    if (geminiResult.success && geminiResult.imageDataUrl) {
      const filename = `social_${platform}_${uuidv4().slice(0, 8)}.png`;
      const localPath = await saveImageToFile(geminiResult.imageDataUrl, clientId, filename);
      
      // Persist to database
      await persistAssetToDatabase(
        clientId, localPath, 'assets', 'social', `social_${platform}`,
        'image/png', dimensions[platform], { platform, topic, provider: 'gemini' }
      );
      
      return {
        success: true,
        assetType: 'social_post',
        assets: [{
          id: uuidv4(),
          localPath,
          base64: geminiResult.imageDataUrl,
          mimeType: 'image/png',
          dimensions: dimensions[platform],
          metadata: { platform, topic },
        }],
        provider: 'gemini',
        processingTime: Date.now() - startTime,
      };
    }
  } catch (error: any) {
    console.error('[BrandAssetGenerator] Social post image generation failed:', error.message);
  }
  
  return {
    success: false,
    assetType: 'social_post',
    assets: [],
    error: 'Failed to generate social post image',
    processingTime: Date.now() - startTime,
  };
}

// ============================================
// TEXT CONTENT GENERATOR (Blog, Ad Copy, Social Text)
// ============================================
export async function generateTextContent(
  profile: BrandProfile | BrandProfileJSON,
  clientId: number,
  contentType: 'blog_post' | 'social_caption' | 'ad_copy' | 'tagline_variations',
  topic: string
): Promise<{ success: boolean; content?: string; error?: string }> {
  const brandProfile = 'clientId' in profile ? profile : jsonToBrandProfile(profile, clientId);
  
  const promptContext = generatePrompt({
    brandProfile,
    assetType: 'social_post', // Use for system prompt generation
  });
  
  const contentPrompts: Record<string, string> = {
    blog_post: `Write a 500-word blog post about: ${topic}. Use the brand voice and keywords.`,
    social_caption: `Write 5 engaging social media captions about: ${topic}. Each should be under 280 characters.`,
    ad_copy: `Write compelling ad copy for: ${topic}. Include a headline, body text, and call-to-action.`,
    tagline_variations: `Generate 10 tagline variations for ${brandProfile.textual.brandName.primary} emphasizing: ${topic}`,
  };
  
  try {
    const content = await generateWithClaude(
      promptContext.systemPrompt || `You are a brand content writer for ${brandProfile.textual.brandName.primary}.`,
      contentPrompts[contentType]
    );
    
    return { success: true, content };
  } catch (error: any) {
    console.error('[BrandAssetGenerator] Text content generation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// PROMO VIDEO SCRIPT GENERATOR
// ============================================
export async function generatePromoVideoScript(
  profile: BrandProfile | BrandProfileJSON,
  clientId: number,
  duration: number = 30
): Promise<{
  success: boolean;
  script?: ReturnType<typeof generateVideoScript>;
  error?: string;
}> {
  const brandProfile = 'clientId' in profile ? profile : jsonToBrandProfile(profile, clientId);
  
  try {
    const script = generateVideoScript(brandProfile, duration);
    console.log(`[BrandAssetGenerator] Generated ${script.scenes.length}-scene video script for client ${clientId}`);
    
    return { success: true, script };
  } catch (error: any) {
    console.error('[BrandAssetGenerator] Video script generation failed:', error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// COMPLETE BRAND PACKAGE GENERATOR
// Generates all assets for a client
// ============================================
export async function generateCompleteBrandPackage(
  profile: BrandProfileJSON,
  clientId: number,
  options: {
    includeMoodBoard?: boolean;
    includeIcons?: boolean;
    includeInfographic?: boolean;
    includeLogoVariants?: boolean;
    includeSocialImages?: boolean;
    includePromoScript?: boolean;
    referenceLogoUrl?: string;
  } = {}
): Promise<{
  success: boolean;
  results: Record<string, AssetGenerationResult | any>;
  totalProcessingTime: number;
}> {
  const startTime = Date.now();
  const results: Record<string, AssetGenerationResult | any> = {};
  
  console.log(`[BrandAssetGenerator] Starting complete brand package generation for client ${clientId}`);
  
  // Generate assets in parallel where possible
  const tasks: Promise<void>[] = [];
  
  if (options.includeMoodBoard !== false) {
    tasks.push(
      generateMoodBoard(profile, clientId).then(r => { results.moodBoard = r; })
    );
  }
  
  if (options.includeIcons !== false) {
    tasks.push(
      generateIconSet(profile, clientId).then(r => { results.iconSet = r; })
    );
  }
  
  if (options.includeInfographic !== false) {
    tasks.push(
      generateInfographic(profile, clientId, 'tokenomics').then(r => { results.infographic = r; })
    );
  }
  
  if (options.includeLogoVariants !== false) {
    tasks.push(
      Promise.all([
        generateLogoVariant(profile, clientId, 'monochrome', options.referenceLogoUrl),
        generateLogoVariant(profile, clientId, 'inverted', options.referenceLogoUrl),
      ]).then(([mono, inv]) => {
        results.logoMonochrome = mono;
        results.logoInverted = inv;
      })
    );
  }
  
  if (options.includeSocialImages !== false) {
    tasks.push(
      Promise.all([
        generateSocialPostImage(profile, clientId, 'linkedin'),
        generateSocialPostImage(profile, clientId, 'twitter'),
        generateSocialPostImage(profile, clientId, 'instagram'),
      ]).then(([linkedin, twitter, instagram]) => {
        results.socialLinkedIn = linkedin;
        results.socialTwitter = twitter;
        results.socialInstagram = instagram;
      })
    );
  }
  
  if (options.includePromoScript !== false) {
    tasks.push(
      generatePromoVideoScript(profile, clientId, 30).then(r => { results.promoScript = r; })
    );
  }
  
  await Promise.all(tasks);
  
  const totalProcessingTime = Date.now() - startTime;
  const successCount = Object.values(results).filter((r: any) => r?.success).length;
  const totalCount = Object.keys(results).length;
  
  console.log(`[BrandAssetGenerator] Complete package done: ${successCount}/${totalCount} successful in ${totalProcessingTime}ms`);
  
  return {
    success: successCount > 0,
    results,
    totalProcessingTime,
  };
}

export default {
  generateMoodBoard,
  generateIconSet,
  generateInfographic,
  generateLogoVariant,
  generateSocialPostImage,
  generateTextContent,
  generatePromoVideoScript,
  generateCompleteBrandPackage,
};
