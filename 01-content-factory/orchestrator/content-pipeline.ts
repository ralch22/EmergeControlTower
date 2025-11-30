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

export class ContentPipeline {
  private state: PipelineState;
  private onProgress?: ProgressCallback;
  private onContentCreated?: CounterCallback;

  constructor(
    config: ContentRunConfig,
    options: {
      onProgress?: ProgressCallback;
      onContentCreated?: CounterCallback;
    } = {}
  ) {
    this.state = {
      runId: `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

  async run(): Promise<ContentRunResult> {
    this.updateState({ status: "running" });
    console.log(`[Pipeline] Starting run for client: ${this.state.config.clientBrief.clientName}`);

    try {
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

      return this.getResult();
    } catch (error: any) {
      console.error(`[Pipeline] FATAL ERROR: ${error.message}`);
      console.error(error.stack);
      this.updateState({
        status: "failed",
        errors: [...this.state.errors, error.message],
        completedAt: new Date(),
      });
      throw error;
    }
  }

  private async generateContentForTopic(topic: ContentTopic): Promise<GeneratedContent[]> {
    const contents: GeneratedContent[] = [];
    const { contentTypes, clientBrief } = this.state.config;
    console.log(`[Pipeline] Generating content for topic: "${topic.title}"`);

    // Run content generation in parallel based on content types
    const promises: Promise<void>[] = [];

    // Blog
    if (contentTypes.includes("blog") && topic.contentTypes.includes("blog")) {
      promises.push(
        (async () => {
          try {
            console.log(`[Pipeline]   -> Generating blog for: ${topic.title}`);
            const result = await generateBlogPost(topic, clientBrief);
            if (result.success && result.data) {
              contents.push(result.data);
              await this.incrementCounter(1);
              this.updateStats("blog");
              console.log(`[Pipeline]   <- Blog generated successfully`);
            } else {
              console.error(`[Pipeline]   <- Blog generation failed: ${result.error}`);
            }
          } catch (err: any) {
            console.error(`[Pipeline]   <- Blog generation error: ${err.message}`);
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
          try {
            console.log(`[Pipeline]   -> Generating social posts (${socialPlatforms.join(', ')}) for: ${topic.title}`);
            const result = await generateAllSocialPosts(topic, clientBrief, socialPlatforms);
            if (result.success && result.data) {
              contents.push(...result.data);
              await this.incrementCounter(result.data.length);
              for (const content of result.data) {
                this.updateStats(content.type);
              }
              console.log(`[Pipeline]   <- Social posts generated: ${result.data.length} pieces`);
            } else {
              console.error(`[Pipeline]   <- Social posts generation failed: ${result.error}`);
            }
          } catch (err: any) {
            console.error(`[Pipeline]   <- Social posts generation error: ${err.message}`);
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
          try {
            console.log(`[Pipeline]   -> Generating ad copy for: ${topic.title}`);
            const result = await generateAllAdCopy(topic, clientBrief);
            if (result.success && result.data) {
              contents.push(...result.data);
              await this.incrementCounter(result.data.length);
              for (const content of result.data) {
                this.updateStats(content.type);
              }
              console.log(`[Pipeline]   <- Ad copy generated: ${result.data.length} pieces`);
            } else {
              console.error(`[Pipeline]   <- Ad copy generation failed: ${result.error}`);
            }
          } catch (err: any) {
            console.error(`[Pipeline]   <- Ad copy generation error: ${err.message}`);
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
          try {
            console.log(`[Pipeline]   -> Generating video script for: ${topic.title}`);
            const result = await generateVideoScript(topic, clientBrief);
            if (result.success && result.data) {
              contents.push(result.data);
              await this.incrementCounter(1);
              this.updateStats("video_script");
              console.log(`[Pipeline]   <- Video script generated successfully`);
            } else {
              console.error(`[Pipeline]   <- Video script generation failed: ${result.error}`);
            }
          } catch (err: any) {
            console.error(`[Pipeline]   <- Video script generation error: ${err.message}`);
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
      const result = await reviewContent(content);
      if (result.success && result.data) {
        this.state.qaResults.set(content.id, result.data);
        
        if (result.data.passed) {
          content.status = "pending_review";
          this.state.stats.totalPassed++;
        } else {
          content.status = "draft";
          this.state.stats.totalFailed++;
        }
      }
    });

    await Promise.all(qaPromises);
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
}

export async function runContentPipeline(
  config: ContentRunConfig,
  options: {
    onProgress?: ProgressCallback;
    onContentCreated?: CounterCallback;
  } = {}
): Promise<ContentRunResult> {
  const pipeline = new ContentPipeline(config, options);
  return pipeline.run();
}
