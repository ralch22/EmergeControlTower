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

  return httpServer;
}
