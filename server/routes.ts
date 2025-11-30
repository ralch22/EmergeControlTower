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

  // Get approval queue items with optional status filter
  app.get("/api/approvals", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const approvals = await storage.getApprovalsByStatus(status);
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

  // ========== VIDEO PROJECTS ==========

  // Get all video projects with full data
  app.get("/api/video-projects", async (req, res) => {
    try {
      const projects = await storage.getAllVideoProjects();
      // Fetch full data for each project including scenes, clips, and audio
      const fullProjects = await Promise.all(
        projects.map(async (project) => {
          const fullProject = await storage.getFullVideoProject(project.projectId);
          return fullProject || { ...project, scenes: [], clips: [], audioTracks: [] };
        })
      );
      res.json(fullProjects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch video projects" });
    }
  });

  // Get video project by ID with all data
  app.get("/api/video-projects/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      const fullProject = await storage.getFullVideoProject(projectId);
      
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json(fullProject);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch video project" });
    }
  });

  // Create video project from video script
  app.post("/api/video-projects", async (req, res) => {
    try {
      const { contentId, clientId, title } = req.body;
      
      // Import scene parser
      const { parseVideoScript, calculateTotalDuration } = await import("../01-content-factory/utils/scene-parser");
      
      // Get the source video script content
      const allContent = await storage.getAllGeneratedContent();
      const sourceContent = allContent.find(c => c.contentId === contentId);
      
      if (!sourceContent) {
        return res.status(404).json({ error: "Source content not found" });
      }
      
      if (sourceContent.type !== 'video_script') {
        return res.status(400).json({ error: "Content is not a video script" });
      }

      // Parse the script into scenes
      const parsedScenes = parseVideoScript(sourceContent.content);
      const totalDuration = calculateTotalDuration(parsedScenes);

      // Generate project ID
      const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Create the project
      const project = await storage.createVideoProject({
        projectId,
        clientId: clientId || sourceContent.clientId,
        sourceContentId: contentId,
        title: title || sourceContent.title,
        description: `Video project from: ${sourceContent.title}`,
        totalDuration,
        status: 'draft',
      });

      // Create scenes
      for (const scene of parsedScenes) {
        const sceneId = `scene_${projectId}_${scene.sceneNumber}`;
        await storage.createVideoScene({
          sceneId,
          projectId,
          sceneNumber: scene.sceneNumber,
          title: scene.title,
          visualPrompt: scene.visualPrompt,
          voiceoverText: scene.voiceoverText,
          duration: scene.duration,
          startTime: scene.startTime,
          status: 'pending',
        });
      }

      const fullProject = await storage.getFullVideoProject(projectId);
      res.status(201).json(fullProject);
    } catch (error: any) {
      console.error('Failed to create video project:', error);
      res.status(500).json({ error: error.message || "Failed to create video project" });
    }
  });

  // Start video generation for a project (uses multi-provider fallback system)
  app.post("/api/video-projects/:projectId/generate", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { provider = null } = req.body; // Optional preferred provider (fallback system handles priority)
      
      const fullProject = await storage.getFullVideoProject(projectId);
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Update project status
      await storage.updateVideoProject(projectId, { status: 'generating' });

      // Start background generation process with fallback system
      generateVideoProjectAsync(projectId, provider, storage);

      res.json({ 
        success: true, 
        message: "Video generation started with automatic provider fallback",
        projectId,
        scenesToGenerate: fullProject.scenes.length,
      });
    } catch (error: any) {
      console.error('Failed to start video generation:', error);
      res.status(500).json({ error: error.message || "Failed to start generation" });
    }
  });

  // Regenerate failed video project (reset failed scenes and restart with fallback)
  app.post("/api/video-projects/:projectId/regenerate", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { provider = null } = req.body; // Optional preferred provider (fallback system handles priority)
      
      const fullProject = await storage.getFullVideoProject(projectId);
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Reset failed scenes to pending
      const failedScenes = fullProject.scenes.filter(s => s.status === 'failed');
      for (const scene of failedScenes) {
        await storage.updateVideoScene(scene.sceneId, { status: 'pending' });
      }

      // Reset failed clips
      const failedClips = fullProject.clips.filter(c => c.status === 'failed');
      for (const clip of failedClips) {
        await storage.updateVideoClip(clip.clipId, { status: 'pending', errorMessage: null });
      }

      // Reset failed audio tracks
      const failedAudio = fullProject.audioTracks.filter(a => a.status === 'failed');
      for (const audio of failedAudio) {
        await storage.updateAudioTrack(audio.trackId, { status: 'pending', errorMessage: null });
      }

      // Update project status
      await storage.updateVideoProject(projectId, { status: 'generating' });

      // Start background regeneration process with fallback system
      generateVideoProjectAsync(projectId, provider, storage);

      res.json({ 
        success: true, 
        message: "Video regeneration started with automatic provider fallback",
        projectId,
        scenesToRegenerate: failedScenes.length,
        clipsToRegenerate: failedClips.length,
        audioToRegenerate: failedAudio.length,
      });
    } catch (error: any) {
      console.error('Failed to regenerate video project:', error);
      res.status(500).json({ error: error.message || "Failed to regenerate" });
    }
  });

  // Export video project using Shotstack
  app.post("/api/video-projects/:projectId/export", async (req, res) => {
    try {
      const { projectId } = req.params;
      
      const fullProject = await storage.getFullVideoProject(projectId);
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Check all clips are ready
      const pendingClips = fullProject.clips.filter(c => c.status !== 'ready');
      if (pendingClips.length > 0) {
        return res.status(400).json({ 
          error: "Not all clips are ready",
          pendingClips: pendingClips.length,
        });
      }

      // Import Shotstack
      const { createMultiSceneVideo, renderVideo, waitForRender } = await import("../01-content-factory/integrations/shotstack");

      // Build scenes array for Shotstack
      const scenes = fullProject.scenes.map(scene => {
        const clip = fullProject.clips.find(c => c.sceneId === scene.sceneId);
        const audio = fullProject.audioTracks.find(a => a.sceneId === scene.sceneId);
        
        return {
          videoUrl: clip?.videoUrl || '',
          audioUrl: audio?.audioUrl || undefined,
          duration: scene.duration,
        };
      }).filter((s): s is { videoUrl: string; audioUrl: string | undefined; duration: number } => !!s.videoUrl);

      if (scenes.length === 0) {
        return res.status(400).json({ error: "No video clips available for export" });
      }

      // Create and render
      const edit = createMultiSceneVideo(scenes, { resolution: 'hd', transitions: true });
      const renderResult = await renderVideo(edit);

      if (!renderResult.success || !renderResult.renderId) {
        return res.status(500).json({ error: renderResult.error || "Failed to start export" });
      }

      // Wait for render (in background for long videos)
      waitForRender(renderResult.renderId, 600).then(async (result) => {
        if (result.success && result.videoUrl) {
          await storage.updateVideoProject(projectId, {
            status: 'exported',
            outputUrl: result.videoUrl,
          });
          console.log(`[VideoProject] Export complete: ${result.videoUrl}`);
        } else {
          await storage.updateVideoProject(projectId, { status: 'failed' });
          console.error(`[VideoProject] Export failed: ${result.error}`);
        }
      });

      res.json({
        success: true,
        message: "Export started",
        renderId: renderResult.renderId,
      });
    } catch (error: any) {
      console.error('Failed to export video project:', error);
      res.status(500).json({ error: error.message || "Failed to export" });
    }
  });

  // ==========================================
  // AI Providers API Routes
  // ==========================================

  // Initialize default providers on first load
  app.post("/api/providers/init", async (req, res) => {
    try {
      await storage.initializeDefaultProviders();
      const providers = await storage.getAiProviders();
      res.json({ success: true, providers });
    } catch (error: any) {
      console.error('Failed to initialize providers:', error);
      res.status(500).json({ error: error.message || "Failed to initialize providers" });
    }
  });

  // Get all providers
  app.get("/api/providers", async (req, res) => {
    try {
      let providers = await storage.getAiProviders();
      
      // Initialize defaults if empty
      if (providers.length === 0) {
        await storage.initializeDefaultProviders();
        providers = await storage.getAiProviders();
      }
      
      res.json(providers);
    } catch (error: any) {
      console.error('Failed to fetch providers:', error);
      res.status(500).json({ error: error.message || "Failed to fetch providers" });
    }
  });

  // Get providers by category
  app.get("/api/providers/category/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const providers = await storage.getAiProvidersByCategory(category);
      res.json(providers);
    } catch (error: any) {
      console.error('Failed to fetch providers:', error);
      res.status(500).json({ error: error.message || "Failed to fetch providers" });
    }
  });

  // Update provider settings (enable/disable, priority, etc.)
  app.patch("/api/providers/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { isEnabled, priority, config } = req.body;
      
      const updates: any = {};
      if (typeof isEnabled === 'boolean') updates.isEnabled = isEnabled;
      if (typeof priority === 'number') updates.priority = priority;
      if (config !== undefined) updates.config = JSON.stringify(config);
      
      const provider = await storage.updateAiProvider(id, updates);
      res.json(provider);
    } catch (error: any) {
      console.error('Failed to update provider:', error);
      res.status(500).json({ error: error.message || "Failed to update provider" });
    }
  });

  // Test provider connectivity
  app.post("/api/providers/:id/test", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const provider = await storage.getAiProvider(id);
      
      if (!provider) {
        return res.status(404).json({ error: "Provider not found" });
      }

      // Test the provider based on its type
      let status = 'unknown';
      let message = '';
      
      const testResults: Record<string, () => Promise<{ status: string; message: string }>> = {
        veo31: async () => {
          const key = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
          if (!key) return { status: 'error', message: 'GEMINI_API_KEY not configured' };
          try {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key);
            if (response.ok) {
              const data = await response.json();
              const hasVeo31 = data.models?.some((m: any) => 
                m.name?.includes('veo-3.1') || m.name?.includes('veo-3')
              );
              return { 
                status: 'working', 
                message: hasVeo31 ? 'Veo 3.1 Fast connected (Ultra tier)' : 'Gemini API connected (Veo 3.1 requires Ultra tier)' 
              };
            }
            return { status: 'error', message: `API error: ${response.status}` };
          } catch (e: any) {
            return { status: 'error', message: e.message || 'Connection failed' };
          }
        },
        veo2: async () => {
          const key = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
          if (!key) return { status: 'error', message: 'GEMINI_API_KEY not configured' };
          try {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key);
            if (response.ok) {
              const data = await response.json();
              const hasVeo2 = data.models?.some((m: any) => m.name?.includes('veo'));
              return { 
                status: 'working', 
                message: hasVeo2 ? 'Veo 2.0 connected' : 'Gemini API connected (Veo 2.0 may require access)' 
              };
            }
            return { status: 'error', message: `API error: ${response.status}` };
          } catch (e: any) {
            return { status: 'error', message: e.message || 'Connection failed' };
          }
        },
        runway: async () => {
          const key = process.env.RUNWAY_API_KEY;
          if (!key) return { status: 'error', message: 'API key not configured' };
          try {
            const response = await fetch('https://api.dev.runwayml.com/v1/tasks?limit=1', {
              headers: { 
                'Authorization': `Bearer ${key}`,
                'X-Runway-Version': '2024-11-06',
              },
            });
            if (response.ok) return { status: 'working', message: 'Connected successfully' };
            if (response.status === 401) return { status: 'error', message: 'Invalid API key' };
            return { status: 'error', message: `API error: ${response.status}` };
          } catch (e: any) {
            return { status: 'error', message: e.message || 'Connection failed' };
          }
        },
        wan: async () => {
          const key = process.env.DASHSCOPE_API_KEY;
          if (!key) return { status: 'error', message: 'API key not configured' };
          return { status: 'working', message: 'API key configured' };
        },
        pika: async () => {
          const key = process.env.PIKA_API_KEY;
          if (!key) return { status: 'error', message: 'API key not configured' };
          return { status: 'working', message: 'API key configured' };
        },
        luma: async () => {
          const key = process.env.LUMA_API_KEY;
          if (!key) return { status: 'error', message: 'API key not configured' };
          return { status: 'working', message: 'API key configured' };
        },
        kling: async () => {
          const key = process.env.KLING_API_KEY;
          if (!key) return { status: 'error', message: 'API key not configured' };
          return { status: 'working', message: 'API key configured' };
        },
        hailuo: async () => {
          const key = process.env.HAILUO_API_KEY;
          if (!key) return { status: 'error', message: 'API key not configured' };
          return { status: 'working', message: 'API key configured' };
        },
        nano_banana_pro: async () => {
          const key = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
          if (!key) return { status: 'error', message: 'GEMINI_API_KEY not configured' };
          try {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + key);
            if (response.ok) {
              const data = await response.json();
              const hasGemini3Pro = data.models?.some((m: any) => 
                m.name?.includes('gemini-3-pro') || m.name?.includes('gemini-2.5')
              );
              return { 
                status: 'working', 
                message: hasGemini3Pro ? 'Nano Banana Pro connected' : 'Gemini API connected (may require billing)' 
              };
            }
            return { status: 'error', message: `API error: ${response.status}` };
          } catch (e: any) {
            return { status: 'error', message: e.message || 'Connection failed' };
          }
        },
        gemini: async () => {
          const key = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
          if (!key) return { status: 'error', message: 'API key not configured' };
          return { status: 'working', message: 'API key configured' };
        },
        dalle: async () => {
          const key = process.env.OPENAI_API_KEY;
          if (!key) return { status: 'error', message: 'API key not configured' };
          return { status: 'working', message: 'API key configured' };
        },
        replicate: async () => {
          const key = process.env.REPLICATE_API_TOKEN;
          if (!key) return { status: 'error', message: 'API key not configured' };
          return { status: 'working', message: 'API key configured' };
        },
        elevenlabs: async () => {
          const key = process.env.ELEVENLABS_API_KEY;
          if (!key) return { status: 'error', message: 'API key not configured' };
          try {
            const response = await fetch('https://api.elevenlabs.io/v1/voices', {
              headers: { 'xi-api-key': key },
            });
            if (response.ok) return { status: 'working', message: 'Connected successfully' };
            if (response.status === 401) return { status: 'error', message: 'Invalid API key' };
            return { status: 'error', message: `API error: ${response.status}` };
          } catch (e: any) {
            return { status: 'error', message: e.message || 'Connection failed' };
          }
        },
        openai_tts: async () => {
          const key = process.env.OPENAI_API_KEY;
          if (!key) return { status: 'error', message: 'API key not configured' };
          return { status: 'working', message: 'API key configured' };
        },
        claude: async () => {
          const key = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
          if (!key) return { status: 'error', message: 'API key not configured' };
          return { status: 'working', message: 'API key configured' };
        },
        default: async () => ({ status: 'unknown', message: 'Provider test not implemented' }),
      };

      const testFn = testResults[provider.name] || testResults.default;
      const result = await testFn();
      
      // Update provider status
      await storage.updateAiProvider(id, {
        lastStatus: result.status,
        lastChecked: new Date(),
        apiKeyConfigured: result.status === 'working',
      });
      
      res.json({
        provider: provider.name,
        ...result,
      });
    } catch (error: any) {
      console.error('Failed to test provider:', error);
      res.status(500).json({ error: error.message || "Failed to test provider" });
    }
  });

  // Bulk update provider priorities (for drag-drop reordering)
  app.post("/api/providers/reorder", async (req, res) => {
    try {
      const { providers } = req.body; // Array of { id, priority }
      
      for (const p of providers) {
        await storage.updateAiProvider(p.id, { priority: p.priority });
      }
      
      const updated = await storage.getAiProviders();
      res.json(updated);
    } catch (error: any) {
      console.error('Failed to reorder providers:', error);
      res.status(500).json({ error: error.message || "Failed to reorder providers" });
    }
  });

  // Register video ingredients routes
  registerVideoIngredientsRoutes(app);

  return httpServer;
}

// Background video generation function with multi-provider fallback
async function generateVideoProjectAsync(
  projectId: string, 
  preferredProvider: string | null,
  storage: any
) {
  try {
    const fullProject = await storage.getFullVideoProject(projectId);
    if (!fullProject) return;

    // Get enabled video providers from database, sorted by priority
    const allProviders = await storage.getAiProvidersByCategory('video');
    let enabledProviders = allProviders
      .filter((p: { isEnabled: boolean }) => p.isEnabled)
      .sort((a: { priority: number }, b: { priority: number }) => a.priority - b.priority)
      .map((p: { name: string; priority: number; isEnabled: boolean }) => ({
        name: p.name as any,
        priority: p.priority,
        isEnabled: p.isEnabled,
      }));

    // If a preferred provider is specified and enabled, move it to the front
    if (preferredProvider) {
      const preferredIndex = enabledProviders.findIndex(
        (p: { name: string }) => p.name === preferredProvider
      );
      if (preferredIndex > 0) {
        const preferred = enabledProviders.splice(preferredIndex, 1)[0];
        enabledProviders.unshift(preferred);
        console.log(`[VideoProject] Moved preferred provider ${preferredProvider} to front`);
      }
    }

    console.log(`[VideoProject] Starting generation for ${projectId} with ${fullProject.scenes.length} scenes`);
    console.log(`[VideoProject] Enabled providers in priority order: ${enabledProviders.map((p: { name: string }) => p.name).join(' → ')}`);

    // Import the fallback system
    const { generateVideoWithFallback, waitForVideoWithProvider } = await import("../01-content-factory/integrations/video-provider");

    for (const scene of fullProject.scenes) {
      // Skip scenes that are already ready
      if (scene.status === 'ready') {
        console.log(`[VideoProject] Scene ${scene.sceneNumber} already ready, skipping`);
        continue;
      }

      try {
        // Refresh project state to get latest clip/audio status
        const currentProject = await storage.getFullVideoProject(projectId);
        if (!currentProject) continue;

        // Update scene status
        await storage.updateVideoScene(scene.sceneId, { status: 'generating' });

        // Check if clip already exists and is ready (using refreshed state)
        const existingClip = currentProject.clips.find((c: { sceneId: string; status: string; clipId: string }) => c.sceneId === scene.sceneId);
        const clipNeedsGeneration = !existingClip || existingClip.status === 'pending' || existingClip.status === 'failed';
        
        let clipId = existingClip?.clipId || `clip_${scene.sceneId}_${Date.now()}`;
        let clipResult;
        let successfulProvider: string | null = null;
        
        if (clipNeedsGeneration) {
          console.log(`[VideoProject] Generating clip for scene ${scene.sceneNumber} using fallback system`);
          
          // Try each provider in order until one succeeds
          for (const providerConfig of enabledProviders) {
            console.log(`[VideoProject] Trying provider: ${providerConfig.name}`);
            
            // Use the fallback system to generate video with this specific provider
            const singleProvider = [providerConfig];
            const taskResult = await generateVideoWithFallback(
              scene.visualPrompt,
              singleProvider,
              {
                duration: Math.min(scene.duration, 10),
                aspectRatio: '16:9',
              }
            );

            if (taskResult.success && taskResult.taskId && taskResult.provider) {
              const usedProvider = taskResult.provider;
              console.log(`[VideoProject] Task started with ${usedProvider}: ${taskResult.taskId}`);
              
              if (!existingClip) {
                await storage.createVideoClip({
                  clipId,
                  sceneId: scene.sceneId,
                  projectId,
                  provider: usedProvider,
                  taskId: taskResult.taskId,
                  status: 'generating',
                });
              } else {
                await storage.updateVideoClip(clipId, { 
                  taskId: taskResult.taskId, 
                  status: 'generating', 
                  provider: usedProvider 
                });
              }

              // Wait for completion using the provider that was used
              clipResult = await waitForVideoWithProvider(
                taskResult.taskId, 
                usedProvider as any,
                300, // max wait seconds
                10   // poll interval
              );
              
              // Check if we got a successful result
              if (clipResult?.success && clipResult.videoUrl) {
                successfulProvider = usedProvider;
                break; // Success - exit the provider loop
              } else if (clipResult?.status === 'failed' || (clipResult?.error && !clipResult?.status?.includes('processing'))) {
                console.log(`[VideoProject] Provider ${usedProvider} failed: ${clipResult?.error}, trying next provider...`);
                // Continue to next provider
                continue;
              } else {
                // Still processing after timeout - mark as failed and try next
                console.log(`[VideoProject] Provider ${usedProvider} timed out, trying next provider...`);
                continue;
              }
            } else {
              console.log(`[VideoProject] Provider ${providerConfig.name} failed to start: ${taskResult.error}`);
              // Continue to next provider
              continue;
            }
          }

          // Update clip with final result
          if (successfulProvider && clipResult?.success && clipResult.videoUrl) {
            await storage.updateVideoClip(clipId, {
              videoUrl: clipResult.videoUrl,
              status: 'ready',
            });
            await storage.updateVideoScene(scene.sceneId, { status: 'ready' });
            console.log(`[VideoProject] Scene ${scene.sceneNumber} clip ready (via ${successfulProvider})`);
          } else {
            await storage.updateVideoClip(clipId, {
              status: 'failed',
              errorMessage: clipResult?.error || 'All providers failed',
            });
            await storage.updateVideoScene(scene.sceneId, { status: 'failed' });
            console.error(`[VideoProject] All providers failed for scene ${scene.sceneNumber}`);
          }
        } else {
          console.log(`[VideoProject] Scene ${scene.sceneNumber} clip already ready, skipping`);
          await storage.updateVideoScene(scene.sceneId, { status: 'ready' });
        }

        // Check if audio already exists and is ready (use refreshed state)
        const latestProject = await storage.getFullVideoProject(projectId);
        const existingAudio = latestProject?.audioTracks.find((a: { sceneId: string; status: string; trackId: string }) => a.sceneId === scene.sceneId);
        const audioNeedsGeneration = !existingAudio || existingAudio.status === 'pending' || existingAudio.status === 'failed';

        // Generate audio (ElevenLabs)
        if (scene.voiceoverText && audioNeedsGeneration) {
          try {
            console.log(`[VideoProject] Generating audio for scene ${scene.sceneNumber}`);
            const { generateVoiceoverWithUrl } = await import("../01-content-factory/integrations/elevenlabs");
            const trackId = existingAudio?.trackId || `audio_${scene.sceneId}_${Date.now()}`;
            
            if (!existingAudio) {
              await storage.createAudioTrack({
                trackId,
                sceneId: scene.sceneId,
                projectId,
                type: 'voiceover',
                provider: 'elevenlabs',
                text: scene.voiceoverText,
                status: 'generating',
              });
            } else {
              await storage.updateAudioTrack(trackId, { status: 'generating' });
            }

            const audioResult = await generateVoiceoverWithUrl(scene.voiceoverText, {
              voiceStyle: 'professional_male',
            });

            if (audioResult.success && audioResult.audioUrl) {
              await storage.updateAudioTrack(trackId, {
                audioUrl: audioResult.audioUrl,
                duration: audioResult.duration,
                status: 'ready',
              });
              console.log(`[VideoProject] Scene ${scene.sceneNumber} audio ready`);
            } else {
              await storage.updateAudioTrack(trackId, {
                status: 'failed',
                errorMessage: audioResult.error,
              });
            }
          } catch (audioError) {
            console.error(`[VideoProject] Audio generation failed for scene ${scene.sceneNumber}:`, audioError);
          }
        } else if (scene.voiceoverText) {
          console.log(`[VideoProject] Scene ${scene.sceneNumber} audio already ready, skipping`);
        }

      } catch (sceneError) {
        console.error(`[VideoProject] Scene ${scene.sceneNumber} failed:`, sceneError);
        await storage.updateVideoScene(scene.sceneId, { status: 'failed' });
      }
    }

    // Check if all scenes are ready
    const updatedProject = await storage.getFullVideoProject(projectId);
    const allReady = updatedProject?.scenes.every((s: { status: string }) => s.status === 'ready');
    
    await storage.updateVideoProject(projectId, {
      status: allReady ? 'ready' : 'failed',
    });

    console.log(`[VideoProject] Generation complete for ${projectId}, status: ${allReady ? 'ready' : 'failed'}`);

  } catch (error) {
    console.error(`[VideoProject] Generation failed for ${projectId}:`, error);
    await storage.updateVideoProject(projectId, { status: 'failed' });
  }
}

// Register video ingredients routes
export function registerVideoIngredientsRoutes(app: Express) {
  // Get all video ingredients
  app.get("/api/video-ingredients", async (req, res) => {
    try {
      const ingredients = await storage.getAllVideoIngredients();
      res.json(ingredients);
    } catch (error: any) {
      console.error("Error fetching video ingredients:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get ingredients for a specific project
  app.get("/api/video-ingredients/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;
      const ingredients = await storage.getVideoIngredients(projectId);
      if (!ingredients) {
        return res.status(404).json({ error: "Ingredients not found" });
      }
      res.json(ingredients);
    } catch (error: any) {
      console.error("Error fetching video ingredients:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create new video ingredients bundle
  app.post("/api/video-ingredients", async (req, res) => {
    try {
      const ingredientId = `ing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const ingredients = await storage.createVideoIngredients({
        ingredientId,
        projectId,
        clientId: req.body.clientId || 1,
        title: req.body.title || "New Video",
        description: req.body.description,
        mode: req.body.mode || "ingredients_to_video",
        scenes: JSON.stringify(req.body.scenes || []),
        referenceImages: JSON.stringify(req.body.referenceImages || []),
        voiceoverScript: req.body.voiceoverScript,
        voiceId: req.body.voiceId,
        voiceStyle: req.body.voiceStyle || "professional_male",
        musicStyle: req.body.musicStyle,
        musicUrl: req.body.musicUrl,
        musicVolume: req.body.musicVolume || 30,
        textOverlays: JSON.stringify(req.body.textOverlays || []),
        brandColors: JSON.stringify(req.body.brandColors || []),
        logoUrl: req.body.logoUrl,
        watermarkPosition: req.body.watermarkPosition,
        aspectRatio: req.body.aspectRatio || "16:9",
        totalDuration: req.body.totalDuration,
        resolution: req.body.resolution || "1080p",
        status: "draft",
      });

      res.json(ingredients);
    } catch (error: any) {
      console.error("Error creating video ingredients:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update video ingredients
  app.patch("/api/video-ingredients/:ingredientId", async (req, res) => {
    try {
      const { ingredientId } = req.params;
      const updates: any = {};
      
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.mode !== undefined) updates.mode = req.body.mode;
      if (req.body.scenes !== undefined) updates.scenes = JSON.stringify(req.body.scenes);
      if (req.body.referenceImages !== undefined) updates.referenceImages = JSON.stringify(req.body.referenceImages);
      if (req.body.voiceoverScript !== undefined) updates.voiceoverScript = req.body.voiceoverScript;
      if (req.body.voiceId !== undefined) updates.voiceId = req.body.voiceId;
      if (req.body.voiceStyle !== undefined) updates.voiceStyle = req.body.voiceStyle;
      if (req.body.musicStyle !== undefined) updates.musicStyle = req.body.musicStyle;
      if (req.body.musicUrl !== undefined) updates.musicUrl = req.body.musicUrl;
      if (req.body.musicVolume !== undefined) updates.musicVolume = req.body.musicVolume;
      if (req.body.textOverlays !== undefined) updates.textOverlays = JSON.stringify(req.body.textOverlays);
      if (req.body.brandColors !== undefined) updates.brandColors = JSON.stringify(req.body.brandColors);
      if (req.body.logoUrl !== undefined) updates.logoUrl = req.body.logoUrl;
      if (req.body.aspectRatio !== undefined) updates.aspectRatio = req.body.aspectRatio;
      if (req.body.totalDuration !== undefined) updates.totalDuration = req.body.totalDuration;
      if (req.body.resolution !== undefined) updates.resolution = req.body.resolution;
      if (req.body.status !== undefined) updates.status = req.body.status;

      const ingredients = await storage.updateVideoIngredients(ingredientId, updates);
      res.json(ingredients);
    } catch (error: any) {
      console.error("Error updating video ingredients:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete video ingredients
  app.delete("/api/video-ingredients/:ingredientId", async (req, res) => {
    try {
      const { ingredientId } = req.params;
      await storage.deleteVideoIngredients(ingredientId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting video ingredients:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Process ingredients and generate video
  app.post("/api/video-ingredients/:ingredientId/generate", async (req, res) => {
    try {
      const { ingredientId } = req.params;
      
      // Get the ingredients
      const allIngredients = await storage.getAllVideoIngredients();
      const ingredients = allIngredients.find(i => i.ingredientId === ingredientId);
      
      if (!ingredients) {
        return res.status(404).json({ error: "Ingredients not found" });
      }

      // Update status to processing
      await storage.updateVideoIngredients(ingredientId, { status: "processing" });

      // Parse the scenes
      const scenes = JSON.parse(ingredients.scenes || "[]");
      
      // Create a video project from the ingredients
      const project = await storage.createVideoProject({
        projectId: ingredients.projectId,
        clientId: ingredients.clientId,
        title: ingredients.title,
        description: ingredients.description || undefined,
        status: "generating",
        totalDuration: ingredients.totalDuration || undefined,
        outputFormat: "mp4",
      });

      // Create scenes from ingredients
      let startTime = 0;
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const sceneId = `scene_${ingredients.projectId}_${i + 1}_${Date.now()}`;
        
        await storage.createVideoScene({
          sceneId,
          projectId: ingredients.projectId,
          sceneNumber: i + 1,
          title: scene.title || `Scene ${i + 1}`,
          visualPrompt: scene.prompt,
          voiceoverText: ingredients.voiceoverScript ? getSceneVoiceover(ingredients.voiceoverScript, i, scenes.length) : undefined,
          duration: scene.duration || 5,
          startTime,
          status: "pending",
        });

        startTime += scene.duration || 5;
      }

      // Start background generation
      generateFromIngredients(ingredients.projectId, ingredients);

      res.json({ 
        success: true, 
        projectId: ingredients.projectId,
        message: "Video generation started from ingredients" 
      });
    } catch (error: any) {
      console.error("Error generating from ingredients:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate video using Python LangGraph pipeline
  app.post("/api/video-ingredients/:ingredientId/generate-python", async (req, res) => {
    try {
      const { ingredientId } = req.params;
      
      // Get the ingredients from database
      const allIngredients = await storage.getAllVideoIngredients();
      const ingredients = allIngredients.find(i => i.ingredientId === ingredientId);
      
      if (!ingredients) {
        return res.status(404).json({ error: "Ingredients not found" });
      }

      // Parse scenes from JSON string
      let scenes;
      try {
        scenes = JSON.parse(ingredients.scenes || "[]");
      } catch (e) {
        return res.status(400).json({ error: "Invalid scenes data" });
      }

      if (!scenes || scenes.length === 0) {
        return res.status(400).json({ error: "No scenes defined in ingredients" });
      }

      // Import the Python bridge
      const { triggerIngredientGeneration } = await import("../01-content-factory/integrations/dashboard-bridge");

      // Build the ingredient bundle for Python API
      const bundle = {
        scenes: scenes.map((scene: any, index: number) => ({
          id: scene.id || `scene_${index}`,
          prompt: scene.prompt || "",
          duration: scene.duration || 5,
          imageUrl: scene.imageUrl || undefined,
          order: scene.order ?? index,
        })),
        voiceoverScript: ingredients.voiceoverScript || "",
        voiceStyle: ingredients.voiceStyle || "default",
        aspectRatio: ingredients.aspectRatio || "16:9",
        resolution: ingredients.resolution || "1080p",
      };

      // Call the Python API
      const result = await triggerIngredientGeneration(bundle);

      if (!result.success) {
        // Update status to failed
        await storage.updateVideoIngredients(ingredientId, { 
          status: "failed",
          errorMessage: result.error,
        });
        return res.status(500).json({ error: result.error });
      }

      // Update ingredients status to processing
      await storage.updateVideoIngredients(ingredientId, { status: "processing" });

      res.json({
        success: true,
        generationId: result.generationId,
        status: result.status,
        message: result.message,
        ingredientId,
      });
    } catch (error: any) {
      console.error("Error generating from ingredients via Python:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get generation status from Python API
  app.get("/api/video-ingredients/generation/:generationId", async (req, res) => {
    try {
      const { generationId } = req.params;
      
      // Import the Python bridge
      const { getGenerationStatus } = await import("../01-content-factory/integrations/dashboard-bridge");
      
      const result = await getGenerationStatus(generationId);

      if (!result.success) {
        return res.status(404).json({ error: result.error });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error getting generation status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check Python API health
  app.get("/api/python-api/health", async (req, res) => {
    try {
      const { checkPythonApiHealth, getPythonApiUrl } = await import("../01-content-factory/integrations/dashboard-bridge");
      
      const health = await checkPythonApiHealth();
      
      res.json({
        ...health,
        pythonApiUrl: getPythonApiUrl(),
      });
    } catch (error: any) {
      res.status(500).json({ 
        healthy: false, 
        error: error.message 
      });
    }
  });
}

// Helper to split voiceover script across scenes
function getSceneVoiceover(fullScript: string, sceneIndex: number, totalScenes: number): string {
  const sentences = fullScript.split(/[.!?]+/).filter(s => s.trim());
  const sentencesPerScene = Math.ceil(sentences.length / totalScenes);
  const start = sceneIndex * sentencesPerScene;
  const end = Math.min(start + sentencesPerScene, sentences.length);
  return sentences.slice(start, end).join('. ').trim() + '.';
}

// Background generation from ingredients
async function generateFromIngredients(projectId: string, ingredients: any) {
  try {
    console.log(`[IngredientsToVideo] Starting generation for ${projectId}`);
    
    const fullProject = await storage.getFullVideoProject(projectId);
    if (!fullProject) {
      throw new Error("Project not found");
    }

    // Import video and audio providers
    const { generateVideoWithFallback, waitForVideoWithProvider } = await import("../01-content-factory/integrations/video-provider");
    const { generateVoiceoverWithUrl } = await import("../01-content-factory/integrations/elevenlabs");
    
    // Get enabled video providers
    const enabledProviders = await storage.getEnabledProviders('video');
    const providerList = enabledProviders.map(p => ({ name: p.name as any, isEnabled: p.isEnabled, priority: p.priority }));

    // Parse reference images
    const referenceImages = JSON.parse(ingredients.referenceImages || "[]");

    // Process each scene
    for (const scene of fullProject.scenes) {
      try {
        await storage.updateVideoScene(scene.sceneId, { status: 'generating' });

        // Use reference image if available for this scene
        const sceneIndex = scene.sceneNumber - 1;
        const imageUrl = referenceImages[sceneIndex] || undefined;

        // Generate video clip
        const clipId = `clip_${scene.sceneId}_${Date.now()}`;
        await storage.createVideoClip({
          clipId,
          sceneId: scene.sceneId,
          projectId,
          provider: providerList[0]?.name || 'veo31',
          status: 'generating',
          duration: scene.duration,
          resolution: ingredients.resolution || '1080p',
        });

        const videoResult = await generateVideoWithFallback(
          scene.visualPrompt,
          providerList,
          {
            duration: scene.duration,
            aspectRatio: ingredients.aspectRatio === '9:16' ? '9:16' : '16:9',
            imageUrl,
          }
        );

        if (videoResult.success && videoResult.taskId) {
          await storage.updateVideoClip(clipId, {
            taskId: videoResult.taskId,
            provider: videoResult.provider || 'veo31',
          });

          // Wait for completion
          const providerName = (videoResult.provider || 'veo31') as 'veo31' | 'veo2' | 'runway' | 'pika' | 'luma' | 'kling' | 'hailuo' | 'wan';
          const completed = await waitForVideoWithProvider(videoResult.taskId, providerName);
          
          if (completed.success && completed.videoUrl) {
            await storage.updateVideoClip(clipId, {
              videoUrl: completed.videoUrl,
              status: 'ready',
            });
            await storage.updateVideoScene(scene.sceneId, { status: 'ready' });
          } else {
            await storage.updateVideoClip(clipId, {
              status: 'failed',
              errorMessage: completed.error,
            });
            await storage.updateVideoScene(scene.sceneId, { status: 'failed' });
          }
        }

        // Generate voiceover if scene has text
        if (scene.voiceoverText) {
          const trackId = `audio_${scene.sceneId}_${Date.now()}`;
          await storage.createAudioTrack({
            trackId,
            sceneId: scene.sceneId,
            projectId,
            type: 'voiceover',
            provider: 'elevenlabs',
            text: scene.voiceoverText,
            voiceId: ingredients.voiceId,
            status: 'generating',
          });

          const audioResult = await generateVoiceoverWithUrl(scene.voiceoverText, {
            voiceStyle: ingredients.voiceStyle || 'professional_male',
          });

          if (audioResult.success && audioResult.audioUrl) {
            await storage.updateAudioTrack(trackId, {
              audioUrl: audioResult.audioUrl,
              duration: audioResult.duration,
              status: 'ready',
            });
          } else {
            await storage.updateAudioTrack(trackId, {
              status: 'failed',
              errorMessage: audioResult.error,
            });
          }
        }

      } catch (sceneError) {
        console.error(`[IngredientsToVideo] Scene ${scene.sceneNumber} failed:`, sceneError);
        await storage.updateVideoScene(scene.sceneId, { status: 'failed' });
      }
    }

    // Update final status
    const updatedProject = await storage.getFullVideoProject(projectId);
    const allReady = updatedProject?.scenes.every((s: { status: string }) => s.status === 'ready');
    
    await storage.updateVideoProject(projectId, {
      status: allReady ? 'ready' : 'failed',
    });
    
    await storage.updateVideoIngredients(ingredients.ingredientId, {
      status: allReady ? 'ready' : 'failed',
    });

    console.log(`[IngredientsToVideo] Generation complete for ${projectId}`);

  } catch (error) {
    console.error(`[IngredientsToVideo] Generation failed:`, error);
    await storage.updateVideoProject(projectId, { status: 'failed' });
    await storage.updateVideoIngredients(ingredients.ingredientId, { 
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
