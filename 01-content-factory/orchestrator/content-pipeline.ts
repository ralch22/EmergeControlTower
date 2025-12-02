import {
  generateTopics,
  generateBlogPost,
  generateAllSocialPosts,
  generateAllAdCopy,
  generateVideoScript,
  reviewContent,
} from "../agents";
import type {
  ClientBrief,
  ContentTopic,
  GeneratedContent,
  ContentRunConfig,
  ContentRunResult,
  ContentType,
  QAResult,
} from "../types";
import type { InsertActivityLog } from "@shared/schema";
import fs from "fs";
import path from "path";
import axios from "axios";
import sharp from "sharp";
// @ts-ignore - colorthief doesn't have type definitions
import ColorThief from "colorthief";
import { loadBrandAssetsFromDatabase } from "../services/brand-brief";

export interface PipelineState {
  runId: string;
  config: ContentRunConfig;
  topics: ContentTopic[];
  contents: GeneratedContent[];
  qaResults: Map<string, QAResult>;
  stats: {
    totalGenerated: number;
    totalPassed: number;
    totalFailed: number;
    byType: Record<ContentType, number>;
  };
  errors: string[];
  status: "pending" | "running" | "completed" | "failed";
  startedAt: Date;
  completedAt?: Date;
}

type ProgressCallback = (state: PipelineState) => void;
type CounterCallback = (increment: number) => Promise<void>;
type ActivityLogCallback = (log: InsertActivityLog) => Promise<void>;
type ContentSaveCallback = (content: GeneratedContent, qaScore?: number) => Promise<void>;

export class ContentPipeline {
  private state: PipelineState;
  private onProgress?: ProgressCallback;
  private onContentCreated?: CounterCallback;
  private onActivityLog?: ActivityLogCallback;
  private onContentSave?: ContentSaveCallback;
  private savedContentIds: Set<string> = new Set();
  private validationErrors: string[] = [];

  constructor(
    config: ContentRunConfig,
    options: {
      runId?: string;
      onProgress?: ProgressCallback;
      onContentCreated?: CounterCallback;
      onActivityLog?: ActivityLogCallback;
      onContentSave?: ContentSaveCallback;
    } = {}
  ) {
    this.state = {
      runId: options.runId || `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      config,
      topics: [],
      contents: [],
      qaResults: new Map(),
      stats: {
        totalGenerated: 0,
        totalPassed: 0,
        totalFailed: 0,
        byType: {} as Record<ContentType, number>,
      },
      errors: [],
      status: "pending",
      startedAt: new Date(),
    };
    this.onProgress = options.onProgress;
    this.onContentCreated = options.onContentCreated;
    this.onActivityLog = options.onActivityLog;
    this.onContentSave = options.onContentSave;
    
    // Validate brand assets on initialization
    this.validateBrandAssets().catch(err => {
      console.warn(`[Pipeline] Asset validation warning: ${err.message}`);
    });
  }

  private updateState(updates: Partial<PipelineState>) {
    this.state = { ...this.state, ...updates };
    this.onProgress?.(this.state);
  }

  private async incrementCounter(count: number = 1) {
    if (this.onContentCreated) {
      await this.onContentCreated(count);
    }
  }

  private async emitActivityLog(
    eventType: string,
    level: string,
    message: string,
    metadata?: Record<string, unknown>
  ) {
    if (this.onActivityLog) {
      try {
        await this.onActivityLog({
          runId: this.state.runId,
          eventType,
          level,
          message,
          metadata: metadata ? JSON.stringify(metadata) : undefined,
        });
      } catch (err) {
        console.error(`[Pipeline] Failed to emit activity log:`, err);
      }
    }
  }

  async run(): Promise<ContentRunResult> {
    this.updateState({ status: "running" });
    const clientName = this.state.config.clientBrief.clientName;
    console.log(`[Pipeline] Starting run for client: ${clientName}`);

    await this.emitActivityLog(
      "run_started",
      "info",
      `Started content run for ${clientName}`,
      { clientId: this.state.config.clientId, runType: this.state.config.runType }
    );

    try {
      // Load brand assets from database and merge into brandVoiceConfig
      await this.loadAndMergeBrandAssets();
      // Step 1: Generate Topics
      console.log(`[Pipeline] Step 1: Generating ${this.state.config.topicCount} topics...`);
      const topicsResult = await generateTopics(
        this.state.config.clientBrief,
        this.state.config.topicCount,
        this.state.config.contentTypes
      );

      if (!topicsResult.success || !topicsResult.data) {
        console.error(`[Pipeline] ERROR: Topic generation failed: ${topicsResult.error}`);
        throw new Error(topicsResult.error || "Failed to generate topics");
      }

      this.updateState({ topics: topicsResult.data });
      console.log(`[Pipeline] Step 1 complete: Generated ${topicsResult.data.length} topics`);
      topicsResult.data.forEach((t, i) => console.log(`  - Topic ${i+1}: ${t.title}`));

      await this.emitActivityLog(
        "topic_generated",
        "success",
        `Generated ${topicsResult.data.length} topics for ${this.state.config.runType === 'weekly' ? 'weekly' : 'single'} content`,
        { topicCount: topicsResult.data.length, topics: topicsResult.data.map(t => t.title) }
      );

      // Step 2: Run parallel content generation pipelines for each topic
      console.log(`[Pipeline] Step 2: Generating content for ${this.state.topics.length} topics...`);
      const contentPromises: Promise<GeneratedContent[]>[] = [];

      for (const topic of this.state.topics) {
        contentPromises.push(this.generateContentForTopic(topic));
      }

      const allContents = await Promise.all(contentPromises);
      const flatContents = allContents.flat();
      console.log(`[Pipeline] Step 2 complete: Generated ${flatContents.length} content pieces`);

      this.updateState({
        contents: flatContents,
        stats: {
          ...this.state.stats,
          totalGenerated: flatContents.length,
        },
      });

      // Step 3: Run QA on all content
      console.log(`[Pipeline] Step 3: Running QA on ${flatContents.length} pieces...`);
      await this.runQAGate();
      console.log(`[Pipeline] Step 3 complete: QA finished. Passed: ${this.state.stats.totalPassed}, Failed: ${this.state.stats.totalFailed}`);

      // Step 4: Finalize
      console.log(`[Pipeline] Step 4: Finalizing run...`);
      this.updateState({
        status: "completed",
        completedAt: new Date(),
      });
      console.log(`[Pipeline] Run completed successfully!`);

      await this.emitActivityLog(
        "run_completed",
        "success",
        `Run completed: ${this.state.stats.totalGenerated} pieces generated, ${this.state.stats.totalPassed} approved, ${this.state.stats.totalFailed} failed`,
        { 
          totalGenerated: this.state.stats.totalGenerated,
          totalPassed: this.state.stats.totalPassed,
          totalFailed: this.state.stats.totalFailed,
          byType: this.state.stats.byType,
          durationMs: Date.now() - this.state.startedAt.getTime()
        }
      );

      return this.getResult();
    } catch (error: any) {
      console.error(`[Pipeline] FATAL ERROR: ${error.message}`);
      console.error(error.stack);
      this.updateState({
        status: "failed",
        errors: [...this.state.errors, error.message],
        completedAt: new Date(),
      });

      await this.emitActivityLog(
        "run_failed",
        "error",
        `Run failed: ${error.message}`,
        { error: error.message, stack: error.stack?.substring(0, 500) }
      );

      throw error;
    }
  }

  private async generateContentForTopic(topic: ContentTopic): Promise<GeneratedContent[]> {
    const contents: GeneratedContent[] = [];
    const { contentTypes, clientBrief } = this.state.config;
    console.log(`[Pipeline] Generating content for topic: "${topic.title}"`);

    const truncateTitle = (title: string, maxLen = 50) => 
      title.length > maxLen ? title.substring(0, maxLen) + '...' : title;

    // Run content generation in parallel based on content types
    const promises: Promise<void>[] = [];

    // Blog
    if (contentTypes.includes("blog") && topic.contentTypes.includes("blog")) {
      promises.push(
        (async () => {
          await this.emitActivityLog(
            "content_started",
            "info",
            `Generating blog post: ${topic.title}`,
            { contentType: "blog", topicTitle: topic.title }
          );
          try {
            console.log(`[Pipeline]   -> Generating blog for: ${topic.title}`);
            const result = await generateBlogPost(topic, clientBrief);
            if (result.success && result.data) {
              contents.push(result.data);
              await this.incrementCounter(1);
              this.updateStats("blog");
              console.log(`[Pipeline]   <- Blog generated successfully`);
              await this.emitActivityLog(
                "content_completed",
                "success",
                `Completed blog post: ${truncateTitle(result.data.title)}`,
                { contentType: "blog", contentId: result.data.id, title: result.data.title }
              );
            } else {
              console.error(`[Pipeline]   <- Blog generation failed: ${result.error}`);
              await this.emitActivityLog(
                "content_failed",
                "error",
                `Failed to generate blog post for topic: ${truncateTitle(topic.title)}`,
                { contentType: "blog", topicTitle: topic.title, error: result.error }
              );
            }
          } catch (err: any) {
            console.error(`[Pipeline]   <- Blog generation error: ${err.message}`);
            await this.emitActivityLog(
              "content_failed",
              "error",
              `Blog generation error: ${err.message}`,
              { contentType: "blog", topicTitle: topic.title, error: err.message }
            );
          }
        })()
      );
    }

    // Social Posts (LinkedIn, Twitter, Instagram)
    const socialPlatforms = ["linkedin", "twitter", "instagram"].filter(
      (p) =>
        contentTypes.includes(p as ContentType) &&
        topic.contentTypes.includes(p as ContentType)
    ) as ("linkedin" | "twitter" | "instagram")[];

    if (socialPlatforms.length > 0) {
      promises.push(
        (async () => {
          await this.emitActivityLog(
            "content_started",
            "info",
            `Generating social posts (${socialPlatforms.join(', ')}) for: ${truncateTitle(topic.title)}`,
            { contentType: "social", platforms: socialPlatforms, topicTitle: topic.title }
          );
          try {
            console.log(`[Pipeline]   -> Generating social posts (${socialPlatforms.join(', ')}) for: ${topic.title}`);
            const result = await generateAllSocialPosts(topic, clientBrief, socialPlatforms);
            if (result.success && result.data) {
              contents.push(...result.data);
              await this.incrementCounter(result.data.length);
              for (const content of result.data) {
                this.updateStats(content.type);
                await this.emitActivityLog(
                  "content_completed",
                  "success",
                  `Completed ${content.type} post for topic: ${truncateTitle(topic.title)}`,
                  { contentType: content.type, contentId: content.id, title: content.title }
                );
              }
              console.log(`[Pipeline]   <- Social posts generated: ${result.data.length} pieces`);
            } else {
              console.error(`[Pipeline]   <- Social posts generation failed: ${result.error}`);
              await this.emitActivityLog(
                "content_failed",
                "error",
                `Failed to generate social posts for topic: ${truncateTitle(topic.title)}`,
                { contentType: "social", platforms: socialPlatforms, topicTitle: topic.title, error: result.error }
              );
            }
          } catch (err: any) {
            console.error(`[Pipeline]   <- Social posts generation error: ${err.message}`);
            await this.emitActivityLog(
              "content_failed",
              "error",
              `Social posts generation error: ${err.message}`,
              { contentType: "social", platforms: socialPlatforms, topicTitle: topic.title, error: err.message }
            );
          }
        })()
      );
    }

    // Ad Copy (Facebook, Google)
    if (
      (contentTypes.includes("facebook_ad") || contentTypes.includes("google_ad")) &&
      (topic.contentTypes.includes("facebook_ad") || topic.contentTypes.includes("google_ad"))
    ) {
      promises.push(
        (async () => {
          await this.emitActivityLog(
            "content_started",
            "info",
            `Generating ad copy for: ${truncateTitle(topic.title)}`,
            { contentType: "ad_copy", topicTitle: topic.title }
          );
          try {
            console.log(`[Pipeline]   -> Generating ad copy for: ${topic.title}`);
            const result = await generateAllAdCopy(topic, clientBrief);
            if (result.success && result.data) {
              contents.push(...result.data);
              await this.incrementCounter(result.data.length);
              for (const content of result.data) {
                this.updateStats(content.type);
                await this.emitActivityLog(
                  "content_completed",
                  "success",
                  `Completed ${content.type} for topic: ${truncateTitle(topic.title)}`,
                  { contentType: content.type, contentId: content.id, title: content.title }
                );
              }
              console.log(`[Pipeline]   <- Ad copy generated: ${result.data.length} pieces`);
            } else {
              console.error(`[Pipeline]   <- Ad copy generation failed: ${result.error}`);
              await this.emitActivityLog(
                "content_failed",
                "error",
                `Failed to generate ad copy for topic: ${truncateTitle(topic.title)}`,
                { contentType: "ad_copy", topicTitle: topic.title, error: result.error }
              );
            }
          } catch (err: any) {
            console.error(`[Pipeline]   <- Ad copy generation error: ${err.message}`);
            await this.emitActivityLog(
              "content_failed",
              "error",
              `Ad copy generation error: ${err.message}`,
              { contentType: "ad_copy", topicTitle: topic.title, error: err.message }
            );
          }
        })()
      );
    }

    // Video Script
    if (
      contentTypes.includes("video_script") &&
      topic.contentTypes.includes("video_script")
    ) {
      promises.push(
        (async () => {
          await this.emitActivityLog(
            "content_started",
            "info",
            `Generating video script: ${truncateTitle(topic.title)}`,
            { contentType: "video_script", topicTitle: topic.title }
          );
          try {
            console.log(`[Pipeline]   -> Generating video script for: ${topic.title}`);
            const result = await generateVideoScript(topic, clientBrief);
            if (result.success && result.data) {
              contents.push(result.data);
              await this.incrementCounter(1);
              this.updateStats("video_script");
              console.log(`[Pipeline]   <- Video script generated successfully`);
              await this.emitActivityLog(
                "content_completed",
                "success",
                `Completed video script: ${truncateTitle(result.data.title)}`,
                { contentType: "video_script", contentId: result.data.id, title: result.data.title }
              );
            } else {
              console.error(`[Pipeline]   <- Video script generation failed: ${result.error}`);
              await this.emitActivityLog(
                "content_failed",
                "error",
                `Failed to generate video script for topic: ${truncateTitle(topic.title)}`,
                { contentType: "video_script", topicTitle: topic.title, error: result.error }
              );
            }
          } catch (err: any) {
            console.error(`[Pipeline]   <- Video script generation error: ${err.message}`);
            await this.emitActivityLog(
              "content_failed",
              "error",
              `Video script generation error: ${err.message}`,
              { contentType: "video_script", topicTitle: topic.title, error: err.message }
            );
          }
        })()
      );
    }

    await Promise.all(promises);
    console.log(`[Pipeline] Topic "${topic.title}" complete: ${contents.length} pieces generated`);
    return contents;
  }

  private updateStats(type: ContentType) {
    const currentCount = this.state.stats.byType[type] || 0;
    this.state.stats.byType[type] = currentCount + 1;
  }

  private async runQAGate(): Promise<void> {
    const qaPromises = this.state.contents.map(async (content) => {
      let qaScore: number | undefined;
      
      try {
        const result = await reviewContent(content);
        if (result.success && result.data) {
          this.state.qaResults.set(content.id, result.data);
          qaScore = result.data.score;
          
          if (result.data.passed) {
            content.status = "pending_review";
            this.state.stats.totalPassed++;
          } else {
            content.status = "draft";
            this.state.stats.totalFailed++;
          }
        } else {
          // QA service returned an error, keep as draft
          content.status = "draft";
          console.warn(`[Pipeline] QA failed for ${content.id}: ${result.error || 'Unknown error'}`);
        }
      } catch (err: any) {
        // QA service exception, keep as draft
        content.status = "draft";
        console.error(`[Pipeline] QA error for ${content.id}: ${err.message}`);
      }
      
      // Always save content after QA attempt (whether it passed, failed, or errored)
      await this.saveContent(content, qaScore);
    });

    await Promise.all(qaPromises);
  }
  
  private async saveContent(content: GeneratedContent, qaScore?: number): Promise<void> {
    if (!this.onContentSave) return;
    if (this.savedContentIds.has(content.id)) return; // Skip duplicates
    
    try {
      await this.onContentSave(content, qaScore);
      this.savedContentIds.add(content.id);
      console.log(`[Pipeline] Saved content: ${content.id}`);
    } catch (err: any) {
      console.error(`[Pipeline] Failed to save content ${content.id}: ${err.message}`);
    }
  }

  getResult(): ContentRunResult {
    return {
      runId: this.state.runId,
      clientId: this.state.config.clientId,
      startedAt: this.state.startedAt,
      completedAt: this.state.completedAt,
      totalPieces: this.state.contents.length,
      successfulPieces: this.state.stats.totalPassed,
      failedPieces: this.state.stats.totalFailed,
      contents: this.state.contents,
    };
  }

  getState(): PipelineState {
    return this.state;
  }

  /**
   * Extract dominant colors from an image file
   */
  private async extractDominantColors(filePath: string, numColors: number = 3): Promise<string[]> {
    try {
      // Use ColorThief for color extraction
      const colorThief = new ColorThief();
      // ColorThief.getPalette is synchronous and takes an image path
      const palette = colorThief.getPalette(filePath, numColors);
      
      // Convert RGB arrays to hex strings
      const hexColors = palette.map(([r, g, b]: number[]) => {
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      });
      
      return hexColors;
    } catch (error: any) {
      console.warn(`[Pipeline] Color extraction failed for ${filePath}: ${error.message}`);
      // Fallback: try with sharp for basic color sampling
      try {
        const img = sharp(filePath);
        const { data, info } = await img.raw().resize(150, 150).toBuffer({ resolveWithObject: true });
        
        // Simple color sampling - get average colors from regions
        const colors: string[] = [];
        const sampleSize = Math.min(numColors, 3);
        const step = Math.floor(data.length / (sampleSize * info.channels));
        
        for (let i = 0; i < sampleSize; i++) {
          const offset = i * step * info.channels;
          const r = data[offset];
          const g = data[offset + 1];
          const b = data[offset + 2];
          colors.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
        }
        
        return colors;
      } catch (fallbackError: any) {
        console.warn(`[Pipeline] Fallback color extraction also failed: ${fallbackError.message}`);
        return [];
      }
    }
  }

  /**
   * Validate brand assets referenced in brandVoice
   */
  private async validateBrandAssets(): Promise<void> {
    const brandVoice = this.state.config.clientBrief.brandVoiceConfig;
    if (!brandVoice?.referenceAssets) {
      return;
    }

    const assets = brandVoice.referenceAssets;
    const validAssets: Record<string, string> = {};

    for (const [key, ref] of Object.entries(assets)) {
      try {
        if (ref.startsWith('http://') || ref.startsWith('https://')) {
          await this.validateUrl(key, ref);
          validAssets[key] = ref;
        } else {
          const isValid = await this.validateLocalFile(key, ref);
          if (isValid) {
            validAssets[key] = ref;
          }
        }
      } catch (error: any) {
        this.validationErrors.push(`Asset ${key}: ${error.message}`);
      }
    }

    // Update referenceAssets to only include valid ones
    if (brandVoice) {
      brandVoice.referenceAssets = validAssets;
    }

    // Auto-extract colors if palette is empty and we have image assets
    if (!brandVoice.colorPalette || brandVoice.colorPalette.length === 0) {
      for (const [key, ref] of Object.entries(validAssets)) {
        if (ref.match(/\.(png|jpg|jpeg|gif|webp)$/i) && !ref.startsWith('http')) {
          try {
            const colors = await this.extractDominantColors(ref, 3);
            if (colors.length > 0) {
              brandVoice.colorPalette = colors;
              console.log(`[Pipeline] Auto-populated color palette from ${key}: ${colors.join(', ')}`);
              break; // Use first successful extraction
            }
          } catch (error: any) {
            console.warn(`[Pipeline] Failed to extract colors from ${key}: ${error.message}`);
          }
        }
      }
    }

    if (this.validationErrors.length > 0) {
      console.warn(`[Pipeline] Asset validation warnings: ${this.validationErrors.join('; ')}`);
    }
  }

  private async validateUrl(key: string, url: string): Promise<void> {
    try {
      const response = await axios.head(url, { timeout: 5000 });
      if (response.status !== 200) {
        throw new Error(`URL invalid (status ${response.status})`);
      }
      const contentLength = parseInt(response.headers['content-length'] || '0', 10);
      if (contentLength > 50 * 1024 * 1024) {
        throw new Error(`File too large (${(contentLength / 1024 / 1024).toFixed(2)}MB)`);
      }
      const contentType = response.headers['content-type'] || '';
      if (!this.isValidAssetType(key, contentType)) {
        throw new Error(`Invalid type (${contentType})`);
      }
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        throw new Error(`URL check failed: ${error.message}`);
      }
      throw error;
    }
  }

  private async validateLocalFile(key: string, filePath: string): Promise<boolean> {
    if (!fs.existsSync(filePath)) {
      this.validationErrors.push(`Asset ${key}: File not found: ${filePath}`);
      return false;
    }

    const stats = fs.statSync(filePath);
    if (stats.size > 50 * 1024 * 1024) {
      this.validationErrors.push(`Asset ${key}: File too large (${(stats.size / 1024 / 1024).toFixed(2)}MB)`);
      return false;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = this.getMimeTypeFromExt(ext);
    if (!this.isValidAssetType(key, mimeType)) {
      this.validationErrors.push(`Asset ${key}: Invalid type (${mimeType})`);
      return false;
    }

    // Advanced checks for images
    if (mimeType.startsWith('image/')) {
      try {
        const img = sharp(filePath);
        const metadata = await img.metadata();
        if ((metadata.width ?? 0) < 100 || (metadata.height ?? 0) < 100) {
          this.validationErrors.push(`Asset ${key}: Image too small (${metadata.width}x${metadata.height})`);
          return false;
        }
      } catch (error: any) {
        this.validationErrors.push(`Asset ${key}: Image invalid: ${error.message}`);
        return false;
      }
    }

    return true;
  }

  private isValidAssetType(key: string, mimeType: string): boolean {
    if (key.includes('logo') || key.includes('mood_board')) {
      return ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'].includes(mimeType);
    } else if (key.includes('ref_video') || key.includes('video')) {
      return ['video/mp4', 'video/quicktime', 'video/webm'].includes(mimeType);
    }
    return true; // Default allow
  }

  private getMimeTypeFromExt(ext: string): string {
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
  }

  /**
   * Load brand assets from database and merge into brandVoiceConfig
   */
  private async loadAndMergeBrandAssets(): Promise<void> {
    try {
      // Import storage dynamically to avoid circular dependencies
      const { storage } = await import("../../server/storage");
      
      const clientId = parseInt(this.state.config.clientId);
      const assetFiles = await storage.getBrandAssetFiles(clientId);
      
      if (assetFiles.length > 0) {
        const dbAssets = loadBrandAssetsFromDatabase(assetFiles);
        
        // Merge into brandVoiceConfig.referenceAssets
        const brief = this.state.config.clientBrief;
        if (!brief.brandVoiceConfig) {
          brief.brandVoiceConfig = {
            tone: brief.brandVoice,
            targetAudience: brief.targetAudience,
            keywords: brief.keywords,
            contentGoals: brief.contentGoals,
            referenceAssets: {},
          };
        }
        
        const config = brief.brandVoiceConfig;
        if (!config.referenceAssets) {
          config.referenceAssets = {};
        }
        
        // Merge database assets (they take precedence)
        config.referenceAssets = {
          ...config.referenceAssets,
          ...dbAssets,
        };
        
        console.log(`[Pipeline] Loaded ${assetFiles.length} brand assets from database`);
      }
    } catch (error: any) {
      console.warn(`[Pipeline] Failed to load brand assets: ${error.message}`);
      // Continue without assets - not a fatal error
    }
  }
}

export async function runContentPipeline(
  config: ContentRunConfig,
  options: {
    runId?: string;
    onProgress?: ProgressCallback;
    onContentCreated?: CounterCallback;
    onActivityLog?: ActivityLogCallback;
    onContentSave?: ContentSaveCallback;
  } = {}
): Promise<ContentRunResult> {
  const pipeline = new ContentPipeline(config, options);
  return pipeline.run();
}
