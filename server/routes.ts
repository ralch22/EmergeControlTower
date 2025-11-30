import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertApprovalQueueSchema, insertKpiSchema, insertPodSchema, insertPhaseChangeSchema, insertAlertSchema, insertClientSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { runContentPipeline } from "../01-content-factory/orchestrator";
import type { ClientBrief, ContentType } from "../01-content-factory/types";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Get latest KPIs
  app.get("/api/kpis", async (req, res) => {
    try {
      const kpi = await storage.getLatestKpi();
      res.json(kpi || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch KPIs" });
    }
  });

  // Update KPIs
  app.post("/api/kpis", async (req, res) => {
    try {
      const validated = insertKpiSchema.parse(req.body);
      const kpi = await storage.updateKpi(validated);
      res.json(kpi);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: fromError(error).toString() });
      } else {
        res.status(500).json({ error: "Failed to update KPIs" });
      }
    }
  });

  // Get all active pods
  app.get("/api/pods", async (req, res) => {
    try {
      const pods = await storage.getActivePods();
      res.json(pods);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch pods" });
    }
  });

  // Create a new pod
  app.post("/api/pods", async (req, res) => {
    try {
      const validated = insertPodSchema.parse(req.body);
      const pod = await storage.createPod(validated);
      res.status(201).json(pod);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: fromError(error).toString() });
      } else {
        res.status(500).json({ error: "Failed to create pod" });
      }
    }
  });

  // Update a pod
  app.patch("/api/pods/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const pod = await storage.updatePod(id, req.body);
      res.json(pod);
    } catch (error) {
      res.status(500).json({ error: "Failed to update pod" });
    }
  });

  // Get upcoming phase changes
  app.get("/api/phase-changes", async (req, res) => {
    try {
      const phaseChanges = await storage.getUpcomingPhaseChanges();
      res.json(phaseChanges);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch phase changes" });
    }
  });

  // Create a phase change
  app.post("/api/phase-changes", async (req, res) => {
    try {
      const validated = insertPhaseChangeSchema.parse(req.body);
      const phaseChange = await storage.createPhaseChange(validated);
      res.status(201).json(phaseChange);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: fromError(error).toString() });
      } else {
        res.status(500).json({ error: "Failed to create phase change" });
      }
    }
  });

  // Get pending approval queue items
  app.get("/api/approvals", async (req, res) => {
    try {
      const approvals = await storage.getPendingApprovals();
      res.json(approvals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch approvals" });
    }
  });

  // Create an approval item
  app.post("/api/approvals", async (req, res) => {
    try {
      const validated = insertApprovalQueueSchema.parse(req.body);
      const approval = await storage.createApprovalItem(validated);
      res.status(201).json(approval);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: fromError(error).toString() });
      } else {
        res.status(500).json({ error: "Failed to create approval item" });
      }
    }
  });

  // Approve an item
  app.post("/api/approvals/:id/approve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const approval = await storage.updateApprovalStatus(id, "approved");
      res.json(approval);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve item" });
    }
  });

  // Reject an item
  app.post("/api/approvals/:id/reject", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const approval = await storage.updateApprovalStatus(id, "rejected");
      res.json(approval);
    } catch (error) {
      res.status(500).json({ error: "Failed to reject item" });
    }
  });

  // Get active alerts
  app.get("/api/alerts", async (req, res) => {
    try {
      const alerts = await storage.getActiveAlerts();
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  // Create an alert
  app.post("/api/alerts", async (req, res) => {
    try {
      const validated = insertAlertSchema.parse(req.body);
      const alert = await storage.createAlert(validated);
      res.status(201).json(alert);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: fromError(error).toString() });
      } else {
        res.status(500).json({ error: "Failed to create alert" });
      }
    }
  });

  // Resolve an alert
  app.post("/api/alerts/:id/resolve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const alert = await storage.resolveAlert(id);
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve alert" });
    }
  });

  // ===== CONTENT FACTORY ROUTES =====

  // Get all clients
  app.get("/api/clients", async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  // Create a client
  app.post("/api/clients", async (req, res) => {
    try {
      const validated = insertClientSchema.parse(req.body);
      const client = await storage.createClient(validated);
      res.status(201).json(client);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: fromError(error).toString() });
      } else {
        res.status(500).json({ error: "Failed to create client" });
      }
    }
  });

  // Get content runs
  app.get("/api/content-runs", async (req, res) => {
    try {
      const runs = await storage.getContentRuns();
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content runs" });
    }
  });

  // Run content factory for a client
  app.post("/api/content-factory/run", async (req, res) => {
    try {
      const { clientId, topicCount = 5, contentTypes = ['blog', 'linkedin', 'twitter'] } = req.body;
      
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const clientBrief: ClientBrief = {
        clientId: client.id.toString(),
        clientName: client.name,
        industry: client.industry,
        brandVoice: client.brandVoice,
        targetAudience: client.targetAudience,
        keywords: client.keywords.split(',').map(k => k.trim()),
        contentGoals: client.contentGoals.split(',').map(g => g.trim()),
      };

      const runId = `run_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await storage.createContentRun({
        runId,
        clientId: client.id,
        status: 'running',
        totalPieces: 0,
        successfulPieces: 0,
        failedPieces: 0,
      });

      res.json({ 
        message: "Content run started", 
        runId,
        status: 'running'
      });

      runContentPipeline(
        {
          clientId: client.id.toString(),
          clientBrief,
          topicCount,
          contentTypes: contentTypes as ContentType[],
          runType: 'single',
        },
        {
          onContentCreated: async (count) => {
            await storage.incrementAiOutput(count);
          },
          onProgress: async (state) => {
            await storage.updateContentRun(runId, {
              status: state.status,
              totalPieces: state.stats.totalGenerated,
              successfulPieces: state.stats.totalPassed,
              failedPieces: state.stats.totalFailed,
              completedAt: state.completedAt,
            });

            // Only save content when run is completed
            if (state.status === 'completed') {
              for (const content of state.contents) {
                try {
                  await storage.createGeneratedContent({
                    contentId: content.id,
                    runId,
                    clientId: client.id,
                    type: content.type,
                    title: content.title,
                    content: content.content,
                    metadata: JSON.stringify(content.metadata),
                    status: content.status,
                    qaScore: state.qaResults.get(content.id)?.score || null,
                  });

                  if (content.status === 'pending_review') {
                    await storage.createApprovalItem({
                      client: client.name,
                      type: content.type,
                      author: 'Content Factory AI',
                      thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=100&h=100&fit=crop',
                      status: 'pending',
                    });
                  }
                } catch {
                  // Content may already exist, skip duplicates
                }
              }
            }
          },
        }
      ).catch(console.error);

    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to start content run" });
    }
  });

  // Run week for client (generates 7 days of content)
  app.post("/api/content-factory/run-week", async (req, res) => {
    try {
      const { clientId } = req.body;
      
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const clientBrief: ClientBrief = {
        clientId: client.id.toString(),
        clientName: client.name,
        industry: client.industry,
        brandVoice: client.brandVoice,
        targetAudience: client.targetAudience,
        keywords: client.keywords.split(',').map(k => k.trim()),
        contentGoals: client.contentGoals.split(',').map(g => g.trim()),
      };

      const runId = `week_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await storage.createContentRun({
        runId,
        clientId: client.id,
        status: 'running',
        totalPieces: 0,
        successfulPieces: 0,
        failedPieces: 0,
      });

      res.json({ 
        message: "Weekly content run started", 
        runId,
        status: 'running',
        estimatedPieces: 42
      });

      runContentPipeline(
        {
          clientId: client.id.toString(),
          clientBrief,
          topicCount: 7,
          contentTypes: ['blog', 'linkedin', 'twitter', 'instagram', 'facebook_ad', 'video_script'],
          runType: 'weekly',
        },
        {
          onContentCreated: async (count) => {
            await storage.incrementAiOutput(count);
          },
          onProgress: async (state) => {
            await storage.updateContentRun(runId, {
              status: state.status,
              totalPieces: state.stats.totalGenerated,
              successfulPieces: state.stats.totalPassed,
              failedPieces: state.stats.totalFailed,
              completedAt: state.completedAt,
            });

            // Only save content when run is completed
            if (state.status === 'completed') {
              for (const content of state.contents) {
                try {
                  await storage.createGeneratedContent({
                    contentId: content.id,
                    runId,
                    clientId: client.id,
                    type: content.type,
                    title: content.title,
                    content: content.content,
                    metadata: JSON.stringify(content.metadata),
                    status: content.status,
                    qaScore: state.qaResults.get(content.id)?.score || null,
                  });

                  // Add to approval queue if pending review
                  if (content.status === 'pending_review') {
                    await storage.createApprovalItem({
                      client: client.name,
                      type: content.type,
                      author: 'Content Factory AI',
                      thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=100&h=100&fit=crop',
                      status: 'pending',
                    });
                  }
                } catch (err) {
                  // Content may already exist, skip duplicates
                }
              }
            }
          },
        }
      ).catch(console.error);

    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to start weekly content run" });
    }
  });

  // Increment AI output counter
  app.post("/api/kpis/increment-ai-output", async (req, res) => {
    try {
      const { count = 1 } = req.body;
      const kpi = await storage.incrementAiOutput(count);
      res.json(kpi);
    } catch (error) {
      res.status(500).json({ error: "Failed to increment AI output" });
    }
  });

  // Get all generated content
  app.get("/api/content", async (req, res) => {
    try {
      const { clientId } = req.query;
      let content;
      if (clientId) {
        content = await storage.getGeneratedContentByClient(Number(clientId));
      } else {
        content = await storage.getAllGeneratedContent();
      }
      
      // Parse metadata and extract media URLs
      const enrichedContent = content.map(item => {
        let metadata: any = {};
        if (item.metadata) {
          try {
            metadata = JSON.parse(item.metadata);
          } catch (e) {
            // Not valid JSON, keep as-is
          }
        }
        
        return {
          ...item,
          videoUrl: metadata.videoUrl || null,
          imageDataUrl: metadata.imageDataUrl || metadata.imageUrl || null,
          videoTaskId: metadata.videoTaskId || null,
        };
      });
      
      res.json(enrichedContent);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content" });
    }
  });

  // Update content status (approve/reject)
  app.patch("/api/content/:contentId/status", async (req, res) => {
    try {
      const { contentId } = req.params;
      const { status } = req.body;
      if (!['approved', 'rejected', 'draft', 'pending_review'].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const content = await storage.updateGeneratedContentStatus(contentId, status);
      res.json(content);
    } catch (error) {
      res.status(500).json({ error: "Failed to update content status" });
    }
  });

  // ===== PYTHON CONTENT FACTORY BRIDGE ROUTES =====
  // These endpoints allow the Python service to push updates to the dashboard

  // Push generated content from Python service
  app.post("/api/generated-content", async (req, res) => {
    try {
      const { id, runId, clientId, topicId, contentType, title, content, metadata, status, qaScore, qaFeedback, mediaUrls } = req.body;
      
      const result = await storage.createGeneratedContent({
        contentId: id,
        runId,
        clientId: typeof clientId === 'string' ? parseInt(clientId) : clientId,
        type: contentType,
        title,
        content,
        metadata: typeof metadata === 'object' ? JSON.stringify(metadata) : metadata,
        status,
        qaScore,
      });
      
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Failed to save generated content:', error);
      res.status(500).json({ error: "Failed to save generated content" });
    }
  });

  // Update content status by contentId
  app.patch("/api/generated-content/:contentId", async (req, res) => {
    try {
      const { contentId } = req.params;
      const { status } = req.body;
      const content = await storage.updateGeneratedContentStatus(contentId, status);
      res.json(content);
    } catch (error) {
      res.status(500).json({ error: "Failed to update content" });
    }
  });

  // Push content run summary from Python service
  app.post("/api/content-runs", async (req, res) => {
    try {
      const { id, clientId, status, totalPieces, passedPieces, failedPieces, errors, startedAt, completedAt } = req.body;
      
      const result = await storage.createContentRun({
        runId: id,
        clientId: typeof clientId === 'string' ? parseInt(clientId) : clientId,
        status,
        totalPieces: totalPieces || 0,
        successfulPieces: passedPieces || 0,
        failedPieces: failedPieces || 0,
        completedAt: completedAt ? new Date(completedAt) : null,
      });
      
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Failed to create content run:', error);
      res.status(500).json({ error: "Failed to create content run" });
    }
  });

  // Add item to approval queue from Python service
  app.post("/api/approval-queue", async (req, res) => {
    try {
      const { type, description, client, impact, contentId } = req.body;
      
      const result = await storage.createApprovalItem({
        type,
        client,
        author: 'Content Factory AI',
        thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=100&h=100&fit=crop',
        status: 'pending',
      });
      
      res.status(201).json(result);
    } catch (error: any) {
      console.error('Failed to add to approval queue:', error);
      res.status(500).json({ error: "Failed to add to approval queue" });
    }
  });

  // Approve content by content ID (for Slack buttons)
  app.post("/api/content/:contentId/approve", async (req, res) => {
    try {
      const { contentId } = req.params;
      const content = await storage.updateGeneratedContentStatus(contentId, 'approved');
      res.json({ status: 'approved', contentId, content });
    } catch (error) {
      res.status(500).json({ error: "Failed to approve content" });
    }
  });

  // Reject content by content ID (for Slack buttons)
  app.post("/api/content/:contentId/reject", async (req, res) => {
    try {
      const { contentId } = req.params;
      const content = await storage.updateGeneratedContentStatus(contentId, 'rejected');
      res.json({ status: 'rejected', contentId, content });
    } catch (error) {
      res.status(500).json({ error: "Failed to reject content" });
    }
  });

  // Generate video for existing video script
  app.post("/api/content/:contentId/generate-video", async (req, res) => {
    try {
      const { contentId } = req.params;
      
      // Get the content
      const allContent = await storage.getAllGeneratedContent();
      const content = allContent.find(c => c.contentId === contentId);
      
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }
      
      if (content.type !== 'video_script') {
        return res.status(400).json({ error: "Content is not a video script" });
      }
      
      // Import Runway functions
      const { generateVideoFromText, waitForVideoCompletion } = await import("../01-content-factory/integrations/runway");
      
      // Parse the script content
      let scriptData;
      try {
        scriptData = JSON.parse(content.content);
      } catch (e) {
        return res.status(400).json({ error: "Invalid video script format" });
      }
      
      // Generate video prompt from scenes
      const videoPrompt = scriptData.scenes
        ?.map((s: any) => s.visualDescription)
        .slice(0, 2)
        .join('. ') || scriptData.voiceoverText?.substring(0, 200) || content.title;
      
      console.log(`[API] Starting video generation for ${contentId}`);
      
      // Start video generation
      const videoResult = await generateVideoFromText(videoPrompt, 'cinematic, professional');
      
      if (!videoResult.success || !videoResult.taskId) {
        return res.status(500).json({ error: videoResult.error || "Failed to start video generation" });
      }
      
      console.log(`[API] Video task started: ${videoResult.taskId}`);
      
      // Wait for completion (with timeout)
      const completedVideo = await waitForVideoCompletion(videoResult.taskId, 180, 10);
      
      if (completedVideo.success && completedVideo.videoUrl) {
        // Update the content metadata
        const existingMetadata = content.metadata ? JSON.parse(content.metadata) : {};
        const newMetadata = {
          ...existingMetadata,
          videoTaskId: videoResult.taskId,
          videoUrl: completedVideo.videoUrl,
        };
        
        await storage.updateGeneratedContentMetadata(contentId, JSON.stringify(newMetadata));
        
        console.log(`[API] Video generated successfully: ${completedVideo.videoUrl}`);
        res.json({ 
          success: true, 
          videoUrl: completedVideo.videoUrl,
          taskId: videoResult.taskId,
        });
      } else if (completedVideo.status === 'processing') {
        // Still processing - save task ID for later
        const existingMetadata = content.metadata ? JSON.parse(content.metadata) : {};
        const newMetadata = {
          ...existingMetadata,
          videoTaskId: videoResult.taskId,
          videoStatus: 'processing',
        };
        await storage.updateGeneratedContentMetadata(contentId, JSON.stringify(newMetadata));
        
        res.json({ 
          success: true, 
          status: 'processing',
          taskId: videoResult.taskId,
          message: "Video is still being generated. Check back in a few minutes.",
        });
      } else {
        res.status(500).json({ 
          error: completedVideo.error || "Video generation failed",
          taskId: videoResult.taskId,
        });
      }
    } catch (error: any) {
      console.error('[API] Video generation error:', error);
      res.status(500).json({ error: error.message || "Failed to generate video" });
    }
  });

  // Get preview content (last 10 pieces)
  app.get("/api/preview", async (req, res) => {
    try {
      const content = await storage.getAllGeneratedContent();
      const preview = content.slice(0, 10).map(c => ({
        id: c.contentId,
        clientId: c.clientId,
        type: c.type,
        title: c.title,
        preview: c.content?.substring(0, 200) + (c.content?.length > 200 ? '...' : ''),
        status: c.status,
        qaScore: c.qaScore,
        createdAt: c.createdAt,
      }));
      res.json(preview);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch preview" });
    }
  });

  return httpServer;
}
