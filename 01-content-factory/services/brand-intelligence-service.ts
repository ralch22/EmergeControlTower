/**
 * Brand Intelligence Service
 * 
 * Ingests brand files (logos, guidelines, websites), extracts visual style,
 * colors, and guidelines, and builds a comprehensive brand intelligence layer
 * that informs all content generation.
 */

import { db } from '../../server/db';
import { clients, brandAssetFiles, brandAssets, type BrandProfileJSON } from '../../shared/schema';
import { composeBrandBrief, type EnrichedClientBrief } from './brand-brief';
import { eq, and } from 'drizzle-orm';
import fetch from 'node-fetch';

export interface BrandColorExtraction {
  primary: { hex: string; name: string; usage: string };
  secondary: { hex: string; name: string; usage: string }[];
  background: { hex: string; name: string; usage: string };
  text: { hex: string; name: string; usage: string };
  accent: { hex: string; name: string; usage: string }[];
}

export interface BrandStyleExtraction {
  visualStyle: string;
  aesthetic: string[];
  moodKeywords: string[];
  patterns: string[];
  motifs: string[];
}

export interface BrandVoiceExtraction {
  toneDescription: string;
  formality: number; // 1-10
  energy: number; // 1-10
  technicality: number; // 1-10
  warmth: number; // 1-10
  personality: string[];
  forbiddenWords: string[];
  examplePhrases: string[];
}

export interface BrandIntelligenceReport {
  clientId: number;
  clientName: string;
  completeness: number; // 0-100%
  colorExtraction?: BrandColorExtraction;
  styleExtraction?: BrandStyleExtraction;
  voiceExtraction?: BrandVoiceExtraction;
  referenceAssets: {
    logos: string[];
    icons: string[];
    moodboards: string[];
    videos: string[];
  };
  recommendations: string[];
  lastUpdated: Date;
}

/**
 * Analyzes all brand assets for a client and builds intelligence report
 */
export async function analyzeBrandAssets(clientId: number): Promise<BrandIntelligenceReport> {
  // Get client data
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
  });
  
  if (!client) {
    throw new Error(`Client ${clientId} not found`);
  }
  
  // Get all brand asset files
  const assetFiles = await db.query.brandAssetFiles.findMany({
    where: eq(brandAssetFiles.clientId, clientId),
  });
  
  // Categorize assets
  const logos = assetFiles.filter(f => f.subcategory === 'logos');
  const icons = assetFiles.filter(f => f.subcategory === 'icons');
  const moodboards = assetFiles.filter(f => f.subcategory === 'mood-board');
  const videos = assetFiles.filter(f => f.subcategory === 'videos');
  const textualFiles = assetFiles.filter(f => f.category === 'textual');
  const visualFiles = assetFiles.filter(f => f.category === 'visual');
  
  // Calculate completeness
  let completenessScore = 0;
  if (client.brandProfile) completenessScore += 40;
  if (client.primaryLogoUrl) completenessScore += 15;
  if (logos.length > 0) completenessScore += 10;
  if (textualFiles.length > 0) completenessScore += 15;
  if (visualFiles.length > 0) completenessScore += 10;
  if (client.websiteUrl) completenessScore += 10;
  
  // Extract from brand profile if available
  let colorExtraction: BrandColorExtraction | undefined;
  let styleExtraction: BrandStyleExtraction | undefined;
  let voiceExtraction: BrandVoiceExtraction | undefined;
  
  if (client.brandProfile) {
    const bp = client.brandProfile;
    
    if (bp.visual?.colorPalette?.darkMode) {
      const dm = bp.visual.colorPalette.darkMode;
      colorExtraction = {
        primary: dm.accent || { hex: '#3B82F6', name: 'Primary', usage: 'Accents' },
        secondary: bp.visual.colorPalette.additionalColors || [],
        background: dm.background || { hex: '#1a1a2e', name: 'Background', usage: 'Backgrounds' },
        text: dm.textPrimary || { hex: '#ffffff', name: 'Text', usage: 'Primary text' },
        accent: [dm.success, dm.warning, dm.error].filter(Boolean) as { hex: string; name: string; usage: string }[],
      };
    }
    
    if (bp.visual?.visualStyle) {
      styleExtraction = {
        visualStyle: bp.visual.visualStyle.description,
        aesthetic: bp.visual.visualStyle.aesthetic || [],
        moodKeywords: bp.visual.visualStyle.moodKeywords || [],
        patterns: bp.visual.visualStyle.patterns || [],
        motifs: bp.visual.visualStyle.motifs || [],
      };
    }
    
    if (bp.textual) {
      voiceExtraction = {
        toneDescription: bp.textual.tone?.description || client.brandVoice,
        formality: bp.textual.tone?.formality || 7,
        energy: bp.textual.tone?.energy || 5,
        technicality: bp.textual.tone?.technicality || 5,
        warmth: bp.textual.tone?.warmth || 5,
        personality: bp.textual.personality?.traits || [],
        forbiddenWords: bp.textual.forbiddenWords || [],
        examplePhrases: bp.textual.examplePhrases || [],
      };
    }
  }
  
  // Build recommendations
  const recommendations: string[] = [];
  
  if (!client.primaryLogoUrl) {
    recommendations.push('Upload a primary logo for brand consistency in visual content');
  }
  if (!client.brandProfile) {
    recommendations.push('Complete the brand profile for enhanced content personalization');
  }
  if (logos.length === 0) {
    recommendations.push('Add logo variations (full color, monochrome, inverted) for different contexts');
  }
  if (!styleExtraction) {
    recommendations.push('Define visual style guidelines for consistent visual content');
  }
  if (!voiceExtraction?.examplePhrases.length) {
    recommendations.push('Add example phrases to help AI match your brand voice');
  }
  if (!client.websiteUrl) {
    recommendations.push('Add website URL as a brand reference anchor');
  }
  
  return {
    clientId,
    clientName: client.name,
    completeness: completenessScore,
    colorExtraction,
    styleExtraction,
    voiceExtraction,
    referenceAssets: {
      logos: logos.map(l => l.filePath),
      icons: icons.map(i => i.filePath),
      moodboards: moodboards.map(m => m.filePath),
      videos: videos.map(v => v.filePath),
    },
    recommendations,
    lastUpdated: new Date(),
  };
}

/**
 * Fetches and extracts brand information from a website
 */
export async function extractFromWebsite(websiteUrl: string): Promise<{
  title?: string;
  description?: string;
  colors: string[];
  fonts: string[];
  logoUrl?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(websiteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BrandIntelligenceBot/1.0)',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return { colors: [], fonts: [] };
    }
    
    const html = await response.text();
    
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim();
    
    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = descMatch?.[1]?.trim();
    
    // Extract colors from CSS (simplified)
    const colorMatches = html.match(/#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}|rgb\([^)]+\)/g) || [];
    const colors = Array.from(new Set(colorMatches)).slice(0, 10);
    
    // Extract font families
    const fontMatches = html.match(/font-family:\s*["']?([^;"']+)/gi) || [];
    const fonts = Array.from(new Set(fontMatches.map(f => f.replace(/font-family:\s*["']?/i, '').trim()))).slice(0, 5);
    
    // Look for logo
    const logoMatch = html.match(/<img[^>]*(?:class|id)[^>]*logo[^>]*src=["']([^"']+)["']/i) ||
                      html.match(/<img[^>]*src=["']([^"']*logo[^"']*)["']/i);
    const logoUrl = logoMatch?.[1];
    
    return {
      title,
      description,
      colors,
      fonts,
      logoUrl: logoUrl ? new URL(logoUrl, websiteUrl).href : undefined,
    };
  } catch (error) {
    console.error('Error extracting from website:', error);
    return { colors: [], fonts: [] };
  }
}

/**
 * Builds enriched client brief with all brand intelligence
 */
export async function buildEnrichedBrief(clientId: number): Promise<EnrichedClientBrief> {
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
  });
  
  if (!client) {
    throw new Error(`Client ${clientId} not found`);
  }
  
  return composeBrandBrief({
    id: client.id,
    name: client.name,
    industry: client.industry,
    brandVoice: client.brandVoice,
    targetAudience: client.targetAudience,
    keywords: client.keywords,
    contentGoals: client.contentGoals,
    brandProfile: client.brandProfile as BrandProfileJSON | null,
    primaryLogoUrl: client.primaryLogoUrl,
    websiteUrl: client.websiteUrl,
  });
}

/**
 * Updates brand profile with extracted intelligence
 */
export async function updateBrandProfile(
  clientId: number,
  updates: Partial<BrandProfileJSON>
): Promise<void> {
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
  });
  
  if (!client) {
    throw new Error(`Client ${clientId} not found`);
  }
  
  const currentProfile = (client.brandProfile || {}) as unknown as Record<string, unknown>;
  const updatesRecord = updates as unknown as Record<string, unknown>;
  const mergedProfile = deepMerge(currentProfile, updatesRecord) as unknown as BrandProfileJSON;
  mergedProfile.version = '1.1';
  mergedProfile.lastUpdated = new Date().toISOString();
  
  await db.update(clients)
    .set({ brandProfile: mergedProfile })
    .where(eq(clients.id, clientId));
}

/**
 * Deep merge utility for brand profiles
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const output = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (target[key] && typeof target[key] === 'object') {
        output[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
      } else {
        output[key] = source[key];
      }
    } else {
      output[key] = source[key];
    }
  }
  
  return output;
}

/**
 * Generates brand-aware system prompt for any AI model
 */
export async function generateBrandSystemPrompt(
  clientId: number,
  contentType: 'video' | 'blog' | 'social' | 'ad_copy' | 'image'
): Promise<string> {
  const brief = await buildEnrichedBrief(clientId);
  
  const parts: string[] = [
    `You are creating ${contentType} content for ${brief.textual.brandName}.`,
    '',
    '## Brand Identity',
    `- Brand: ${brief.textual.brandName}`,
    brief.textual.tagline ? `- Tagline: "${brief.textual.tagline}"` : '',
    `- Industry: ${brief.industry}`,
    `- Archetype: ${brief.textual.archetype}`,
    '',
    '## Brand Voice',
    `- Tone: ${brief.textual.toneDescription}`,
    `- Personality: ${brief.textual.personalityTraits.join(', ')}`,
    brief.textual.avoidTraits.length > 0 ? `- Avoid: ${brief.textual.avoidTraits.join(', ')}` : '',
    '',
    '## Target Audience',
    `- Demographics: ${brief.textual.audienceDemographics}`,
    brief.textual.audiencePsychographics ? `- Psychographics: ${brief.textual.audiencePsychographics}` : '',
    brief.textual.audiencePainPoints.length > 0 ? `- Pain Points: ${brief.textual.audiencePainPoints.join(', ')}` : '',
  ];
  
  if (contentType === 'video' || contentType === 'image') {
    parts.push(
      '',
      '## Visual Guidelines',
      `- Style: ${brief.visual.visualStyle}`,
      `- Mood: ${brief.visual.moodKeywords.join(', ')}`,
      `- Primary Color: ${brief.visual.primaryColor?.hex || 'brand colors'}`,
      `- Background: ${brief.visual.backgroundColor?.hex || 'dark'}`,
      brief.visual.cinematicMotionStyle ? `- Motion: ${brief.visual.cinematicMotionStyle}` : '',
      brief.visual.cinematicColorGrading ? `- Color Grading: ${brief.visual.cinematicColorGrading}` : '',
    );
  }
  
  if (brief.textual.forbiddenWords.length > 0) {
    parts.push(
      '',
      '## IMPORTANT: Avoid These',
      `- Words: ${brief.textual.forbiddenWords.join(', ')}`,
    );
  }
  
  if (brief.visual.usageDonts.length > 0 && (contentType === 'video' || contentType === 'image')) {
    parts.push(`- Visual Don'ts: ${brief.visual.usageDonts.join(', ')}`);
  }
  
  return parts.filter(Boolean).join('\n');
}

/**
 * Validates content against brand guidelines
 */
export async function validateAgainstBrand(
  clientId: number,
  content: string,
  contentType: 'video' | 'blog' | 'social' | 'ad_copy' | 'image'
): Promise<{
  score: number;
  issues: string[];
  passed: boolean;
}> {
  const brief = await buildEnrichedBrief(clientId);
  const issues: string[] = [];
  let score = 100;
  
  const contentLower = content.toLowerCase();
  
  // Check forbidden words
  for (const word of brief.textual.forbiddenWords) {
    if (contentLower.includes(word.toLowerCase())) {
      issues.push(`Contains forbidden word: "${word}"`);
      score -= 15;
    }
  }
  
  // Check for brand name mention (if appropriate)
  if (contentType !== 'image') {
    if (!contentLower.includes(brief.textual.brandName.toLowerCase())) {
      issues.push('Brand name not mentioned');
      score -= 5;
    }
  }
  
  // Check for avoid traits in tone
  for (const trait of brief.textual.avoidTraits) {
    if (contentLower.includes(trait.toLowerCase())) {
      issues.push(`May reflect avoided trait: "${trait}"`);
      score -= 10;
    }
  }
  
  // Content-specific checks
  if (contentType === 'social') {
    // Check length for social
    if (content.length > 500) {
      issues.push('Social content may be too long');
      score -= 5;
    }
  }
  
  if (contentType === 'ad_copy') {
    // Check for CTA presence
    const hasCta = brief.textual.callToActions.some(cta => 
      contentLower.includes(cta.toLowerCase().slice(0, 10))
    );
    if (!hasCta && brief.textual.callToActions.length > 0) {
      issues.push('Missing brand-aligned call-to-action');
      score -= 10;
    }
  }
  
  return {
    score: Math.max(0, score),
    issues,
    passed: score >= 70,
  };
}

/**
 * Gets brand reference anchors for visual content
 */
export async function getBrandReferenceAnchors(clientId: number): Promise<{
  logoUrl?: string;
  websiteUrl?: string;
  moodboardUrls: string[];
  colorPalette: string[];
}> {
  const client = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
  });
  
  if (!client) {
    throw new Error(`Client ${clientId} not found`);
  }
  
  const assets = await db.query.brandAssetFiles.findMany({
    where: and(
      eq(brandAssetFiles.clientId, clientId),
      eq(brandAssetFiles.subcategory, 'mood-board')
    ),
  });
  
  const colorPalette: string[] = [];
  if (client.brandProfile?.visual?.colorPalette?.darkMode) {
    const dm = client.brandProfile.visual.colorPalette.darkMode;
    if (dm.accent?.hex) colorPalette.push(dm.accent.hex);
    if (dm.background?.hex) colorPalette.push(dm.background.hex);
    if (dm.textPrimary?.hex) colorPalette.push(dm.textPrimary.hex);
  }
  
  return {
    logoUrl: client.primaryLogoUrl || undefined,
    websiteUrl: client.websiteUrl || undefined,
    moodboardUrls: assets.map(a => a.filePath),
    colorPalette,
  };
}

export default {
  analyzeBrandAssets,
  extractFromWebsite,
  buildEnrichedBrief,
  updateBrandProfile,
  generateBrandSystemPrompt,
  validateAgainstBrand,
  getBrandReferenceAnchors,
};
