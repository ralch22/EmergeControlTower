import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertApprovalQueueSchema, insertKpiSchema, insertPodSchema, insertPhaseChangeSchema, insertAlertSchema, insertClientSchema, insertBrandAssetsSchema, insertBrandAssetFileSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { runContentPipeline } from "../01-content-factory/orchestrator";
import type { ClientBrief, ContentType } from "../01-content-factory/types";
import multer from "multer";
import path from "path";
import fs from "fs";

const BRAND_ASSETS_DIR = "attached_assets/brand";

const brandAssetStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const clientId = req.params.clientId || req.body.clientId;
    const category = req.body.category || "assets";
    const subcategory = req.body.subcategory || "";
    
    let uploadPath = path.join(BRAND_ASSETS_DIR, clientId, category);
    if (subcategory) {
      uploadPath = path.join(uploadPath, subcategory);
    }
    
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${baseName}_${uniqueSuffix}${ext}`);
  }
});

const FILE_SIZE_LIMITS: Record<string, number> = {
  text: 50 * 1024,       // 50KB for text files
  document: 5 * 1024 * 1024,  // 5MB for documents
  image: 10 * 1024 * 1024,    // 10MB for images
  video: 100 * 1024 * 1024,   // 100MB for videos
  archive: 50 * 1024 * 1024,  // 50MB for zip files
  font: 10 * 1024 * 1024,     // 10MB for font files
};

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  textual: [
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/json',
  ],
  visual: [
    'text/plain',
    'application/json',
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'application/zip',
    'font/otf',
    'font/ttf',
    'application/x-font-ttf',
    'application/x-font-otf',
  ],
  assets: [
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/jpg',
    'video/mp4',
    'video/webm',
    'application/zip',
  ],
};

function getFileSizeLimit(mimeType: string): number {
  if (mimeType.startsWith('text/') || mimeType === 'application/json') return FILE_SIZE_LIMITS.text;
  if (mimeType.includes('word') || mimeType === 'application/msword') return FILE_SIZE_LIMITS.document;
  if (mimeType.startsWith('image/')) return FILE_SIZE_LIMITS.image;
  if (mimeType.startsWith('video/')) return FILE_SIZE_LIMITS.video;
  if (mimeType === 'application/zip') return FILE_SIZE_LIMITS.archive;
  if (mimeType.includes('font')) return FILE_SIZE_LIMITS.font;
  return FILE_SIZE_LIMITS.document;
}

const uploadBrandAsset = multer({
  storage: brandAssetStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const category = req.body.category || "assets";
    const allowedTypes = ALLOWED_MIME_TYPES[category] || ALLOWED_MIME_TYPES.assets;
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed for category ${category}`));
    }
  }
});

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

  // Dismiss/resolve an alert via PATCH
  app.patch("/api/alerts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const alert = await storage.resolveAlert(id);
      res.json(alert);
    } catch (error) {
      res.status(500).json({ error: "Failed to dismiss alert" });
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

  // Get a single client with brand profile
  app.get("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClientWithBrandProfile(id);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  // Update a client
  app.put("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.updateClient(id, req.body);
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update client" });
    }
  });

  // Update client brand profile
  app.put("/api/clients/:id/brand-profile", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { brandProfile, logoUrl } = req.body;
      const client = await storage.updateClientBrandProfile(id, brandProfile, logoUrl);
      res.json(client);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to update brand profile" });
    }
  });

  // Delete a client (soft delete)
  app.delete("/api/clients/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteClient(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete client" });
    }
  });

  // ===== BRAND ASSET GENERATION ROUTES =====

  // Generate mood board for a client
  app.post("/api/clients/:id/generate/mood-board", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClientWithBrandProfile(id);
      if (!client || !client.brandProfile) {
        return res.status(400).json({ error: "Client brand profile not found" });
      }

      const { generateMoodBoard } = await import("../01-content-factory/services/brand-asset-generator");
      const result = await generateMoodBoard(client.brandProfile, id);
      res.json(result);
    } catch (error: any) {
      console.error("Mood board generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate mood board" });
    }
  });

  // Generate icon set for a client
  app.post("/api/clients/:id/generate/icons", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClientWithBrandProfile(id);
      if (!client || !client.brandProfile) {
        return res.status(400).json({ error: "Client brand profile not found" });
      }

      const iconNames = req.body.iconNames || ['lock', 'shield', 'flame', 'arrow', 'chain', 'wallet', 'chart', 'secure', 'yield', 'bridge'];
      const { generateIconSet } = await import("../01-content-factory/services/brand-asset-generator");
      const result = await generateIconSet(client.brandProfile, id, iconNames);
      res.json(result);
    } catch (error: any) {
      console.error("Icon set generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate icon set" });
    }
  });

  // Generate infographic for a client
  app.post("/api/clients/:id/generate/infographic", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClientWithBrandProfile(id);
      if (!client || !client.brandProfile) {
        return res.status(400).json({ error: "Client brand profile not found" });
      }

      const { type = 'tokenomics', data } = req.body;
      const { generateInfographic } = await import("../01-content-factory/services/brand-asset-generator");
      const result = await generateInfographic(client.brandProfile, id, type, data);
      res.json(result);
    } catch (error: any) {
      console.error("Infographic generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate infographic" });
    }
  });

  // Generate logo variant for a client
  app.post("/api/clients/:id/generate/logo-variant", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClientWithBrandProfile(id);
      if (!client || !client.brandProfile) {
        return res.status(400).json({ error: "Client brand profile not found" });
      }

      const { variantType = 'monochrome' } = req.body;
      const { generateLogoVariant } = await import("../01-content-factory/services/brand-asset-generator");
      const result = await generateLogoVariant(client.brandProfile, id, variantType, client.primaryLogoUrl || undefined);
      res.json(result);
    } catch (error: any) {
      console.error("Logo variant generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate logo variant" });
    }
  });

  // Generate social post image for a client
  app.post("/api/clients/:id/generate/social-image", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClientWithBrandProfile(id);
      if (!client || !client.brandProfile) {
        return res.status(400).json({ error: "Client brand profile not found" });
      }

      const { platform = 'linkedin', topic } = req.body;
      const { generateSocialPostImage } = await import("../01-content-factory/services/brand-asset-generator");
      const result = await generateSocialPostImage(client.brandProfile, id, platform, topic);
      res.json(result);
    } catch (error: any) {
      console.error("Social image generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate social image" });
    }
  });

  // Generate text content for a client
  app.post("/api/clients/:id/generate/text-content", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClientWithBrandProfile(id);
      if (!client || !client.brandProfile) {
        return res.status(400).json({ error: "Client brand profile not found" });
      }

      const { contentType = 'social_caption', topic } = req.body;
      if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
      }
      
      const { generateTextContent } = await import("../01-content-factory/services/brand-asset-generator");
      const result = await generateTextContent(client.brandProfile, id, contentType, topic);
      res.json(result);
    } catch (error: any) {
      console.error("Text content generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate text content" });
    }
  });

  // Generate promo video script for a client
  app.post("/api/clients/:id/generate/promo-script", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClientWithBrandProfile(id);
      if (!client || !client.brandProfile) {
        return res.status(400).json({ error: "Client brand profile not found" });
      }

      const { duration = 30 } = req.body;
      const { generatePromoVideoScript } = await import("../01-content-factory/services/brand-asset-generator");
      const result = await generatePromoVideoScript(client.brandProfile, id, duration);
      res.json(result);
    } catch (error: any) {
      console.error("Promo script generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate promo script" });
    }
  });

  // Generate complete brand package for a client
  app.post("/api/clients/:id/generate/complete-package", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const client = await storage.getClientWithBrandProfile(id);
      if (!client || !client.brandProfile) {
        return res.status(400).json({ error: "Client brand profile not found" });
      }

      const options = req.body.options || {};
      const { generateCompleteBrandPackage } = await import("../01-content-factory/services/brand-asset-generator");
      const result = await generateCompleteBrandPackage(client.brandProfile, id, {
        ...options,
        referenceLogoUrl: client.primaryLogoUrl || undefined,
      });
      res.json(result);
    } catch (error: any) {
      console.error("Complete package generation error:", error);
      res.status(500).json({ error: error.message || "Failed to generate complete package" });
    }
  });

  // ===== BRAND ASSETS ROUTES =====

  // Get all brand assets
  app.get("/api/brand-assets", async (req, res) => {
    try {
      const assets = await storage.getAllBrandAssets();
      res.json(assets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brand assets" });
    }
  });

  // Get brand assets for a specific client
  app.get("/api/brand-assets/:clientId", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const assets = await storage.getBrandAssets(clientId);
      if (!assets) {
        return res.status(404).json({ error: "Brand assets not found for this client" });
      }
      res.json(assets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brand assets" });
    }
  });

  // Create brand assets for a client
  app.post("/api/brand-assets", async (req, res) => {
    try {
      const validated = insertBrandAssetsSchema.parse(req.body);
      
      const existing = await storage.getBrandAssets(validated.clientId);
      if (existing) {
        return res.status(409).json({ error: "Brand assets already exist for this client. Use PUT to update." });
      }
      
      const assets = await storage.createBrandAssets(validated);
      res.status(201).json(assets);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: fromError(error).toString() });
      } else {
        res.status(500).json({ error: "Failed to create brand assets" });
      }
    }
  });

  // Update brand assets for a client
  app.put("/api/brand-assets/:clientId", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      
      const existing = await storage.getBrandAssets(clientId);
      if (!existing) {
        const validated = insertBrandAssetsSchema.parse({ ...req.body, clientId });
        const assets = await storage.createBrandAssets(validated);
        return res.status(201).json(assets);
      }
      
      const assets = await storage.updateBrandAssets(clientId, req.body);
      res.json(assets);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: fromError(error).toString() });
      } else {
        res.status(500).json({ error: "Failed to update brand assets" });
      }
    }
  });

  // Delete brand assets for a client
  app.delete("/api/brand-assets/:clientId", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      await storage.deleteBrandAssets(clientId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete brand assets" });
    }
  });

  // ===== Brand Asset Files =====

  // Get all brand asset files for a client
  app.get("/api/brand-asset-files/:clientId", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const { category } = req.query;
      
      if (category && typeof category === 'string') {
        const files = await storage.getBrandAssetFilesByCategory(clientId, category);
        return res.json(files);
      }
      
      const files = await storage.getBrandAssetFiles(clientId);
      res.json(files);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brand asset files" });
    }
  });

  // Get a specific brand asset file
  app.get("/api/brand-asset-files/file/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const file = await storage.getBrandAssetFile(id);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      res.json(file);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brand asset file" });
    }
  });

  // Upload a brand asset file
  app.post("/api/brand-asset-files/:clientId", uploadBrandAsset.single('file'), async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const maxSize = getFileSizeLimit(file.mimetype);
      if (file.size > maxSize) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ 
          error: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds limit of ${(maxSize / 1024 / 1024).toFixed(2)}MB for this file type` 
        });
      }
      
      const fileType = path.extname(file.originalname).slice(1).toLowerCase();
      
      let metadata: Record<string, unknown> = {};
      
      if (file.mimetype.startsWith('text/') || file.mimetype === 'application/json') {
        try {
          const content = fs.readFileSync(file.path, 'utf-8');
          metadata.textPreview = content.slice(0, 500);
          metadata.lineCount = content.split('\n').length;
          metadata.wordCount = content.split(/\s+/).filter(Boolean).length;
        } catch { }
      }
      
      const assetFile = await storage.createBrandAssetFile({
        clientId,
        category: req.body.category || 'assets',
        subcategory: req.body.subcategory || null,
        fileName: file.filename,
        originalName: file.originalname,
        filePath: file.path,
        fileType,
        mimeType: file.mimetype,
        fileSize: file.size,
        purpose: req.body.purpose || null,
        metadata,
      });
      
      res.status(201).json(assetFile);
    } catch (error: any) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch { }
      }
      res.status(500).json({ error: error.message || "Failed to upload brand asset file" });
    }
  });

  // Upload multiple brand asset files
  app.post("/api/brand-asset-files/:clientId/batch", uploadBrandAsset.array('files', 20), async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      
      const results: any[] = [];
      const errors: any[] = [];
      
      for (const file of files) {
        try {
          const maxSize = getFileSizeLimit(file.mimetype);
          if (file.size > maxSize) {
            fs.unlinkSync(file.path);
            errors.push({ 
              file: file.originalname, 
              error: `File size exceeds limit of ${(maxSize / 1024 / 1024).toFixed(2)}MB` 
            });
            continue;
          }
          
          const fileType = path.extname(file.originalname).slice(1).toLowerCase();
          
          let metadata: Record<string, unknown> = {};
          
          if (file.mimetype.startsWith('text/') || file.mimetype === 'application/json') {
            try {
              const content = fs.readFileSync(file.path, 'utf-8');
              metadata.textPreview = content.slice(0, 500);
              metadata.lineCount = content.split('\n').length;
              metadata.wordCount = content.split(/\s+/).filter(Boolean).length;
            } catch { }
          }
          
          const assetFile = await storage.createBrandAssetFile({
            clientId,
            category: req.body.category || 'assets',
            subcategory: req.body.subcategory || null,
            fileName: file.filename,
            originalName: file.originalname,
            filePath: file.path,
            fileType,
            mimeType: file.mimetype,
            fileSize: file.size,
            purpose: null,
            metadata,
          });
          
          results.push(assetFile);
        } catch (error: any) {
          try { fs.unlinkSync(file.path); } catch { }
          errors.push({ file: file.originalname, error: error.message });
        }
      }
      
      res.status(201).json({ uploaded: results, errors });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to upload brand asset files" });
    }
  });

  // Update brand asset file metadata
  app.patch("/api/brand-asset-files/file/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { purpose, subcategory, category } = req.body;
      
      const updates: any = {};
      if (purpose !== undefined) updates.purpose = purpose;
      if (subcategory !== undefined) updates.subcategory = subcategory;
      if (category !== undefined) updates.category = category;
      
      const file = await storage.updateBrandAssetFile(id, updates);
      res.json(file);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update brand asset file" });
    }
  });

  // Delete a brand asset file
  app.delete("/api/brand-asset-files/file/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      const file = await storage.getBrandAssetFile(id);
      if (file) {
        try { fs.unlinkSync(file.filePath); } catch { }
      }
      
      await storage.deleteBrandAssetFile(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete brand asset file" });
    }
  });

  // Delete all brand asset files for a client
  app.delete("/api/brand-asset-files/:clientId/all", async (req, res) => {
    try {
      const clientId = parseInt(req.params.clientId);
      
      const files = await storage.getBrandAssetFiles(clientId);
      for (const file of files) {
        try { fs.unlinkSync(file.filePath); } catch { }
      }
      
      const result = await storage.deleteBrandAssetFilesByClient(clientId);
      
      try {
        fs.rmSync(path.join(BRAND_ASSETS_DIR, clientId.toString()), { recursive: true, force: true });
      } catch { }
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to delete brand asset files" });
    }
  });

  // Serve brand asset files
  app.get("/api/brand-asset-files/download/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const file = await storage.getBrandAssetFile(id);
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      if (!fs.existsSync(file.filePath)) {
        return res.status(404).json({ error: "File not found on disk" });
      }
      
      res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
      res.sendFile(path.resolve(file.filePath));
    } catch (error) {
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Read text file content
  app.get("/api/brand-asset-files/content/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const file = await storage.getBrandAssetFile(id);
      
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      
      if (!file.mimeType?.startsWith('text/') && file.mimeType !== 'application/json') {
        return res.status(400).json({ error: "File is not a text file" });
      }
      
      if (!fs.existsSync(file.filePath)) {
        return res.status(404).json({ error: "File not found on disk" });
      }
      
      const content = fs.readFileSync(file.filePath, 'utf-8');
      res.json({ content, file });
    } catch (error) {
      res.status(500).json({ error: "Failed to read file content" });
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
          onActivityLog: async (log) => {
            await storage.createActivityLog(log);
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
          onActivityLog: async (log) => {
            await storage.createActivityLog(log);
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
  // Automatically creates a video project when a video script is approved
  app.post("/api/content/:contentId/approve", async (req, res) => {
    try {
      const { contentId } = req.params;
      const content = await storage.updateGeneratedContentStatus(contentId, 'approved');
      
      // If this is a video script, automatically create a video project
      if (content && content.type === 'video_script') {
        try {
          console.log(`[AutoVideoProject] Creating video project from approved script: ${contentId}`);
          
          // Import scene parser
          const { parseVideoScript, calculateTotalDuration } = await import("../01-content-factory/utils/scene-parser");
          
          // Parse the script into scenes
          const parsedScenes = parseVideoScript(content.content);
          const totalDuration = calculateTotalDuration(parsedScenes);
          
          // Generate project ID
          const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          // Create the project
          const project = await storage.createVideoProject({
            projectId,
            clientId: content.clientId,
            sourceContentId: contentId,
            title: content.title,
            description: `Video project from: ${content.title}`,
            totalDuration,
            status: 'draft',
          });
          
          // Create scenes (without generating images yet - that happens when user triggers generation)
          let startTime = 0;
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
              startTime,
              status: 'pending',
            });
            startTime += scene.duration;
          }
          
          // Log activity
          await storage.createActivityLog({
            runId: `video_proj_${projectId}`,
            eventType: 'video_project_auto_created',
            level: 'success',
            message: `Video project automatically created from approved script: ${content.title}`,
            metadata: JSON.stringify({ projectId, contentId, scenesCount: parsedScenes.length }),
          });
          
          console.log(`[AutoVideoProject] Created project ${projectId} with ${parsedScenes.length} scenes`);
          
          res.json({ 
            status: 'approved', 
            contentId, 
            content,
            videoProject: {
              projectId,
              title: project.title,
              scenesCount: parsedScenes.length,
              totalDuration,
              message: 'Video project automatically created from approved script'
            }
          });
          return;
        } catch (projectError: any) {
          console.error(`[AutoVideoProject] Failed to create video project: ${projectError.message}`);
          // Still return success for approval, but note the project creation failure
          res.json({ 
            status: 'approved', 
            contentId, 
            content,
            videoProjectError: projectError.message
          });
          return;
        }
      }
      
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

  // Proxy endpoint to serve Gemini-hosted videos with authentication and Range support
  app.get("/api/video-proxy", async (req, res) => {
    try {
      const { url } = req.query;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL parameter is required" });
      }

      // Only proxy Gemini API URLs for security
      if (!url.includes('generativelanguage.googleapis.com')) {
        return res.status(400).json({ error: "Only Gemini API URLs are allowed" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "Gemini API key not configured" });
      }

      // Add API key to the URL
      const separator = url.includes('?') ? '&' : '?';
      const authenticatedUrl = `${url}${separator}key=${apiKey}`;

      // Forward Range header if present
      const headers: Record<string, string> = {};
      const rangeHeader = req.headers.range;
      if (rangeHeader) {
        headers['Range'] = rangeHeader;
      }

      // Fetch the video from Gemini
      const response = await fetch(authenticatedUrl, { headers });
      
      if (!response.ok && response.status !== 206) {
        console.error(`[VideoProxy] Failed to fetch video: ${response.status} ${response.statusText}`);
        return res.status(response.status).json({ error: "Failed to fetch video" });
      }

      // Get content type and set appropriate headers
      const contentType = response.headers.get('content-type') || 'video/mp4';
      const contentLength = response.headers.get('content-length');
      const contentRange = response.headers.get('content-range');
      
      res.setHeader('Content-Type', contentType);
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      // Set status code (206 for partial content, 200 for full content)
      res.status(response.status);

      // Stream the video to the client using arrayBuffer (ESM compatible)
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error('[VideoProxy] Error:', error);
      res.status(500).json({ error: error.message || "Failed to proxy video" });
    }
  });

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

  // Create test video project for quick testing
  app.post("/api/video-projects/test", async (req, res) => {
    try {
      const projectId = `proj_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create test project with 3 sample scenes
      const project = await storage.createVideoProject({
        projectId,
        clientId: 1,
        title: "Test Video - AI Future",
        description: "Test video project with 3 sample scenes",
        totalDuration: 15,
        status: 'pending',
      });

      // Log activity
      await storage.createActivityLog({
        runId: `video_proj_${projectId}`,
        eventType: 'video_project_created',
        level: 'info',
        message: `Test video project created: ${project.title}`,
        metadata: JSON.stringify({ projectId, scenesCount: 3, totalDuration: 15, isTest: true }),
      });

      // Scene 1: AI concept intro
      const scene1Id = `scene_${projectId}_1`;
      await storage.createVideoScene({
        sceneId: scene1Id,
        projectId,
        sceneNumber: 1,
        title: "AI Future Vision",
        visualPrompt: "Futuristic AI interface with glowing holographic displays, digital matrix background, cyberpunk neon aesthetic, 4K quality",
        voiceoverText: "Artificial intelligence is transforming the world. Machines are learning to see, think, and create.",
        duration: 5,
        startTime: 0,
        status: 'pending',
      });

      // Scene 2: Human-AI collaboration
      const scene2Id = `scene_${projectId}_2`;
      await storage.createVideoScene({
        sceneId: scene2Id,
        projectId,
        sceneNumber: 2,
        title: "Collaboration Era",
        visualPrompt: "Humans and AI robots working together in harmony, split screen, modern office meets tech lab, minimalist design with blue accents",
        voiceoverText: "The future isn't about AI replacing humans. It's about humans and AI working together to solve problems.",
        duration: 5,
        startTime: 5,
        status: 'pending',
      });

      // Scene 3: Impact and growth
      const scene3Id = `scene_${projectId}_3`;
      await storage.createVideoScene({
        sceneId: scene3Id,
        projectId,
        sceneNumber: 3,
        title: "Growth Trajectory",
        visualPrompt: "Upward trending graphs and metrics, growth visualization, success indicators, digital evolution, tech-forward aesthetic",
        voiceoverText: "Together, we're creating a smarter, faster, better future. The possibilities are endless.",
        duration: 5,
        startTime: 10,
        status: 'pending',
      });

      const fullProject = await storage.getFullVideoProject(projectId);
      res.status(201).json(fullProject);
    } catch (error: any) {
      console.error('Failed to create test video project:', error);
      res.status(500).json({ error: error.message || "Failed to create test project" });
    }
  });

  // Create video project from video script
  app.post("/api/video-projects", async (req, res) => {
    try {
      const { contentId, clientId, title, generateImages = true } = req.body;
      
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
        status: 'pending',
      });

      // Log activity - project creation started
      await storage.createActivityLog({
        runId: `video_proj_${projectId}`,
        eventType: 'video_project_created',
        level: 'info',
        message: `Video project created: ${project.title}`,
        metadata: JSON.stringify({ projectId, scenesCount: parsedScenes.length, totalDuration }),
      });

      // Generate reference images for each scene in parallel (if enabled)
      let scenesWithImages = parsedScenes;
      if (generateImages) {
        try {
          const { generateVideoThumbnail } = await import("../01-content-factory/integrations/nano-banana-pro");
          const { generateImageWithFalFluxPro, isFalConfigured } = await import("../01-content-factory/integrations/fal-ai");
          const { generateSceneImageWithAlibaba, isAlibabaImageConfigured } = await import("../01-content-factory/integrations/alibaba-image");
          
          // Check if Gemini API key is available for image generation
          // Prefer GEMINI_API_KEY first as it's the validated key
          const geminiApiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
          const geminiAvailable = !!geminiApiKey;
          const primaryProvider = geminiAvailable ? 'gemini_image' : (isFalConfigured() ? 'fal_ai' : 'alibaba');
          
          await storage.createActivityLog({
            runId: `video_proj_${projectId}`,
            eventType: 'reference_image_generation_started',
            level: 'info',
            message: `Generating reference images for ${parsedScenes.length} scenes using ${primaryProvider}...`,
            metadata: JSON.stringify({ projectId, scenesCount: parsedScenes.length, primaryProvider }),
          });

          const imagePromises = parsedScenes.map(async (scene, index) => {
            try {
              let imageUrl: string | undefined;
              let provider: string = 'none';
              
              // Priority 1: Gemini Image Generation (GEMINI_API_KEY) - primary
              if (geminiAvailable) {
                try {
                  const geminiResult = await generateVideoThumbnail(scene.visualPrompt, { resolution: '2K' });
                  if (geminiResult.success && (geminiResult.imageUrl || geminiResult.imageDataUrl)) {
                    imageUrl = geminiResult.imageUrl || geminiResult.imageDataUrl;
                    provider = 'gemini_image';
                  } else if (geminiResult.error) {
                    console.log(`[VideoProject] Scene ${scene.sceneNumber}: Gemini failed: ${geminiResult.error}`);
                  }
                } catch (geminiError: any) {
                  console.log(`[VideoProject] Scene ${scene.sceneNumber}: Gemini error: ${geminiError.message}`);
                }
              }
              
              // Priority 2: Fal AI Flux Pro - first fallback
              if (!imageUrl && isFalConfigured()) {
                console.log(`[VideoProject] Scene ${scene.sceneNumber}: Trying Fal AI...`);
                const falResult = await generateImageWithFalFluxPro(
                  scene.visualPrompt,
                  { width: 1280, height: 720 }
                );
                if (falResult.success && falResult.imageUrl) {
                  imageUrl = falResult.imageUrl;
                  provider = 'fal_ai';
                }
              }
              
              // Priority 3: Alibaba Dashscope - second fallback
              if (!imageUrl && isAlibabaImageConfigured()) {
                console.log(`[VideoProject] Scene ${scene.sceneNumber}: Fal AI failed, trying Alibaba...`);
                const alibabaResult = await generateSceneImageWithAlibaba(scene.visualPrompt, '16:9');
                if (alibabaResult.success && alibabaResult.imageUrl) {
                  imageUrl = alibabaResult.imageUrl;
                  provider = 'alibaba';
                }
              }
              
              if (imageUrl) {
                await storage.createActivityLog({
                  runId: `video_proj_${projectId}`,
                  eventType: 'reference_image_generated',
                  level: 'success',
                  message: `Reference image generated for scene ${scene.sceneNumber}: ${scene.title || 'Untitled'} (${provider})`,
                  metadata: JSON.stringify({ sceneNumber: scene.sceneNumber, provider, imageUrl: imageUrl.substring(0, 100) }),
                });
              } else {
                console.log(`[VideoProject] Scene ${scene.sceneNumber}: All providers failed`);
                await storage.createActivityLog({
                  runId: `video_proj_${projectId}`,
                  eventType: 'reference_image_all_failed',
                  level: 'warning',
                  message: `All image providers failed for scene ${scene.sceneNumber}: ${scene.title || 'Untitled'}`,
                  metadata: JSON.stringify({ sceneNumber: scene.sceneNumber }),
                });
              }
              
              return { ...scene, imageUrl };
            } catch (error: any) {
              console.error(`[VideoProject] Failed to generate image for scene ${scene.sceneNumber}:`, error);
              await storage.createActivityLog({
                runId: `video_proj_${projectId}`,
                eventType: 'reference_image_failed',
                level: 'warning',
                message: `Failed to generate reference image for scene ${scene.sceneNumber}: ${error.message}`,
                metadata: JSON.stringify({ sceneNumber: scene.sceneNumber, error: error.message }),
              });
              return scene; // Return scene without image
            }
          });

          scenesWithImages = await Promise.all(imagePromises);
          
          const imagesGenerated = scenesWithImages.filter(s => s.imageUrl).length;
          await storage.createActivityLog({
            runId: `video_proj_${projectId}`,
            eventType: 'reference_image_generation_completed',
            level: imagesGenerated === parsedScenes.length ? 'success' : 'info',
            message: `Reference image generation completed: ${imagesGenerated}/${parsedScenes.length} images generated`,
            metadata: JSON.stringify({ projectId, imagesGenerated, totalScenes: parsedScenes.length }),
          });
        } catch (error: any) {
          console.error('[VideoProject] Image generation module error:', error);
          await storage.createActivityLog({
            runId: `video_proj_${projectId}`,
            eventType: 'reference_image_generation_error',
            level: 'error',
            message: `Reference image generation error: ${error.message}`,
            metadata: JSON.stringify({ projectId, error: error.message }),
          });
          // Continue without images
        }
      }

      // Create scenes with their reference images
      for (const scene of scenesWithImages) {
        const sceneId = `scene_${projectId}_${scene.sceneNumber}`;
        await storage.createVideoScene({
          sceneId,
          projectId,
          sceneNumber: scene.sceneNumber,
          title: scene.title,
          visualPrompt: scene.visualPrompt,
          voiceoverText: scene.voiceoverText,
          imageUrl: scene.imageUrl,
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

  // ==========================================
  // Unified Full Video Generation (Topic → Final Video)
  // ==========================================
  
  // Generate complete video from topic (script → scenes → clips → voiceover → assembly)
  app.post("/api/video/generate-full", async (req, res) => {
    try {
      const { generateFullVideoFromTopic } = await import("../01-content-factory/services/video-orchestrator");
      
      const {
        topic,
        clientName,
        brandVoice,
        targetAudience,
        duration = 60,
        format = 'short',
        style = 'mixed',
        aspectRatio = '16:9',
        voiceStyle = 'professional_male',
        enableAutoRetry = true,
        maxRetries = 3,
      } = req.body;

      if (!topic) {
        return res.status(400).json({ error: "topic is required" });
      }

      const result = await generateFullVideoFromTopic({
        topic,
        clientName,
        brandVoice,
        targetAudience,
        duration,
        format,
        style,
        aspectRatio,
        voiceStyle,
        enableAutoRetry,
        maxRetries,
      }, storage);

      if (result.success && result.projectId) {
        generateVideoProjectAsync(result.projectId, null, storage);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Failed to generate full video:', error);
      res.status(500).json({ error: error.message || "Failed to generate full video" });
    }
  });

  // Auto-retry failed scenes for a project
  app.post("/api/video-projects/:projectId/auto-retry", async (req, res) => {
    try {
      const { retryFailedScenes, checkAndAutoRetry } = await import("../01-content-factory/services/video-orchestrator");
      const { projectId } = req.params;
      const { rotateProviders = true, maxRetries = 3, autoMode = false } = req.body;

      let result;
      if (autoMode) {
        const triggered = await checkAndAutoRetry(projectId, storage);
        result = { success: true, autoRetryTriggered: triggered };
      } else {
        result = await retryFailedScenes(projectId, storage, { maxRetries, rotateProviders });
      }

      if (result.success && result.retriedScenes && result.retriedScenes > 0) {
        generateVideoProjectAsync(projectId, null, storage);
      }

      res.json(result);
    } catch (error: any) {
      console.error('Failed to retry failed scenes:', error);
      res.status(500).json({ error: error.message || "Failed to retry" });
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

      // Log activity
      await storage.createActivityLog({
        runId: `video_proj_${projectId}`,
        eventType: 'video_generation_started',
        level: 'info',
        message: `Video generation started for: ${fullProject.project.title}`,
        metadata: JSON.stringify({ projectId, scenesCount: fullProject.scenes.length, provider: provider || 'auto' }),
      });

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
  // Use force=true to regenerate ALL scenes, not just failed ones
  app.post("/api/video-projects/:projectId/regenerate", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { provider = null, force = false } = req.body; // force=true to reset ALL scenes
      
      const fullProject = await storage.getFullVideoProject(projectId);
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      let scenesToReset, clipsToReset, audioToReset;
      
      if (force) {
        // Force mode: Reset ALL scenes/clips/audio to pending
        scenesToReset = fullProject.scenes;
        clipsToReset = fullProject.clips;
        audioToReset = fullProject.audioTracks;
        console.log(`[VideoProject] Force regenerating ALL ${scenesToReset.length} scenes`);
      } else {
        // Normal mode: Only reset failed items
        scenesToReset = fullProject.scenes.filter(s => s.status === 'failed');
        clipsToReset = fullProject.clips.filter(c => c.status === 'failed');
        audioToReset = fullProject.audioTracks.filter(a => a.status === 'failed');
      }

      // Reset scenes to pending
      for (const scene of scenesToReset) {
        await storage.updateVideoScene(scene.sceneId, { status: 'pending' });
      }

      // Reset clips
      for (const clip of clipsToReset) {
        await storage.updateVideoClip(clip.clipId, { status: 'pending', errorMessage: null, videoUrl: force ? null : clip.videoUrl });
      }

      // Reset audio tracks
      for (const audio of audioToReset) {
        await storage.updateAudioTrack(audio.trackId, { status: 'pending', errorMessage: null, audioUrl: force ? null : audio.audioUrl });
      }

      // Update project status
      await storage.updateVideoProject(projectId, { status: 'generating' });

      // Start background regeneration process with fallback system
      generateVideoProjectAsync(projectId, provider, storage);

      res.json({ 
        success: true, 
        message: force ? "Full regeneration started (all scenes)" : "Video regeneration started with automatic provider fallback",
        projectId,
        scenesToRegenerate: scenesToReset.length,
        clipsToRegenerate: clipsToReset.length,
        audioToRegenerate: audioToReset.length,
        forceMode: force,
      });
    } catch (error: any) {
      console.error('Failed to regenerate video project:', error);
      res.status(500).json({ error: error.message || "Failed to regenerate" });
    }
  });

  // Transition project status (e.g., draft -> pending)
  app.post("/api/video-projects/:projectId/transition", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { status } = req.body;

      if (!["pending", "draft"].includes(status)) {
        return res.status(400).json({ error: "Invalid status transition" });
      }

      const fullProject = await storage.getFullVideoProject(projectId);
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Allow draft -> pending transition
      if (fullProject.project.status === "draft" && status === "pending") {
        await storage.updateVideoProject(projectId, { status: "pending" });
        
        // Log activity
        await storage.createActivityLog({
          runId: `video_proj_${projectId}`,
          eventType: 'video_project_ready',
          level: 'info',
          message: `Video project ready for generation: ${fullProject.project.title}`,
          metadata: JSON.stringify({ projectId, scenesCount: fullProject.scenes.length }),
        });
        
        const updated = await storage.getFullVideoProject(projectId);
        res.json({ success: true, message: "Project transitioned to pending", project: updated });
      } else {
        res.status(400).json({ error: `Cannot transition from ${fullProject.project.status} to ${status}` });
      }
    } catch (error: any) {
      console.error('Failed to transition project:', error);
      res.status(500).json({ error: error.message || "Failed to transition project" });
    }
  });

  // Cancel/Stop video generation for a project
  app.post("/api/video-projects/:projectId/cancel", async (req, res) => {
    try {
      const { projectId } = req.params;
      
      const fullProject = await storage.getFullVideoProject(projectId);
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (fullProject.project.status !== 'generating') {
        return res.status(400).json({ error: "Project is not currently generating" });
      }

      // Reset all in-progress scenes back to pending
      for (const scene of fullProject.scenes) {
        if (scene.status === 'generating') {
          await storage.updateVideoScene(scene.sceneId, { status: 'pending' });
        }
      }

      // Reset all in-progress clips back to pending
      for (const clip of fullProject.clips) {
        if (clip.status === 'generating') {
          await storage.updateVideoClip(clip.clipId, { status: 'pending', errorMessage: null });
        }
      }

      // Reset all in-progress audio back to pending
      for (const audio of fullProject.audioTracks) {
        if (audio.status === 'generating') {
          await storage.updateAudioTrack(audio.trackId, { status: 'pending', errorMessage: null });
        }
      }

      // Set project status to 'pending' (stopped)
      await storage.updateVideoProject(projectId, { status: 'pending' });

      console.log(`[VideoProject] Generation cancelled for project ${projectId}`);

      res.json({ 
        success: true, 
        message: "Video generation cancelled",
        projectId,
      });
    } catch (error: any) {
      console.error('Failed to cancel video generation:', error);
      res.status(500).json({ error: error.message || "Failed to cancel generation" });
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

  // Force Assembly - assemble with available clips only, skip failed/pending
  app.post("/api/video-projects/:projectId/force-assemble", async (req, res) => {
    try {
      const { projectId } = req.params;
      
      const fullProject = await storage.getFullVideoProject(projectId);
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get only ready clips (prefer permanentVideoUrl, fall back to videoUrl)
      const readyClips = fullProject.clips.filter((c: any) => 
        c.status === 'ready' && (c.permanentVideoUrl || c.videoUrl)
      );
      const readyAudio = fullProject.audioTracks.filter(a => a.status === 'ready' && a.audioUrl);
      
      if (readyClips.length === 0) {
        return res.status(400).json({ 
          error: "No ready clips available for assembly",
          message: "At least one video clip must be ready before assembly",
        });
      }

      // Get scenes that have ready clips
      const readySceneIds = new Set(readyClips.map((c: any) => c.sceneId));
      const scenesToAssemble = fullProject.scenes
        .filter(s => readySceneIds.has(s.sceneId))
        .sort((a, b) => a.sceneNumber - b.sceneNumber);

      const skippedScenes = fullProject.scenes.filter(s => !readySceneIds.has(s.sceneId));

      console.log(`[ForceAssembly] Project ${projectId}: ${readyClips.length} ready clips, ${skippedScenes.length} skipped scenes`);

      // Update project status
      await storage.updateVideoProject(projectId, { status: 'assembling' });

      // Import Shotstack
      const { createMultiSceneVideo, renderVideo, waitForRender, isGoogleAuthenticatedUrl } = await import("../01-content-factory/integrations/shotstack");

      // Build scenes array using permanentVideoUrl when available (no preprocessing needed for cached videos)
      const scenes: { videoUrl: string; audioUrl: string | undefined; duration: number }[] = [];
      const expiredClips: { sceneNumber: number; clipId: string }[] = [];
      
      for (const scene of scenesToAssemble) {
        const clip = readyClips.find((c: any) => c.sceneId === scene.sceneId);
        const audio = readyAudio.find(a => a.sceneId === scene.sceneId);
        
        if (!clip) continue;
        
        // Use permanentVideoUrl if available (cached), otherwise use videoUrl
        let videoUrl = (clip as any).permanentVideoUrl || clip.videoUrl;
        
        // If no permanent URL and original URL is a Google auth URL, it's likely expired
        if (!videoUrl) {
          console.log(`[ForceAssembly] Skipping scene ${scene.sceneNumber}: no video URL available`);
          expiredClips.push({ sceneNumber: scene.sceneNumber, clipId: clip.clipId });
          continue;
        }
        
        // If using original Google URL without permanent cache, warn about potential expiration
        if (!(clip as any).permanentVideoUrl && isGoogleAuthenticatedUrl(videoUrl)) {
          console.log(`[ForceAssembly] Warning: Scene ${scene.sceneNumber} using uncached Google URL (may be expired)`);
        }
        
        scenes.push({
          videoUrl,
          audioUrl: audio?.audioUrl || undefined,
          duration: clip.duration || scene.duration || 5,
        });
      }

      if (scenes.length === 0) {
        await storage.updateVideoProject(projectId, { status: 'failed' });
        return res.status(500).json({ 
          error: "No clips could be processed for assembly",
          expiredClips,
          message: expiredClips.length > 0 ? "Video clips may have expired. Please regenerate them." : undefined,
        });
      }

      // Create and render
      const edit = createMultiSceneVideo(scenes, { resolution: 'hd', transitions: true });
      const renderResult = await renderVideo(edit);

      if (!renderResult.success || !renderResult.renderId) {
        await storage.updateVideoProject(projectId, { status: 'failed' });
        return res.status(500).json({ error: renderResult.error || "Failed to start assembly" });
      }

      // Wait for render in background
      waitForRender(renderResult.renderId, 600).then(async (result) => {
        if (result.success && result.videoUrl) {
          await storage.updateVideoProject(projectId, {
            status: 'completed',
            outputUrl: result.videoUrl,
          });
          console.log(`[ForceAssembly] Complete: ${result.videoUrl}`);
        } else {
          await storage.updateVideoProject(projectId, { status: 'failed' });
          console.error(`[ForceAssembly] Failed: ${result.error}`);
        }
      });

      const cachedClipsCount = readyClips.filter((c: any) => c.permanentVideoUrl).length;
      
      res.json({
        success: true,
        message: `Force assembly started with ${scenes.length} clips (${skippedScenes.length} scenes skipped)`,
        renderId: renderResult.renderId,
        assembledScenes: scenes.length,
        cachedClips: cachedClipsCount,
        uncachedClips: scenes.length - cachedClipsCount,
        skippedScenes: skippedScenes.map(s => ({
          sceneNumber: s.sceneNumber,
          status: fullProject.clips.find((c: any) => c.sceneId === s.sceneId)?.status || 'no_clip',
        })),
        expiredClips,
        estimatedDuration: scenes.reduce((sum, s) => sum + s.duration, 0),
      });
    } catch (error: any) {
      console.error('Failed to force assemble video project:', error);
      res.status(500).json({ error: error.message || "Failed to force assemble" });
    }
  });

  // Get assembly status with detailed clip info
  app.get("/api/video-projects/:projectId/assembly-status", async (req, res) => {
    try {
      const { projectId } = req.params;
      
      const fullProject = await storage.getFullVideoProject(projectId);
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      const clipStatus = fullProject.scenes.map(scene => {
        const clip = fullProject.clips.find(c => c.sceneId === scene.sceneId);
        const audio = fullProject.audioTracks.find(a => a.sceneId === scene.sceneId);
        
        return {
          sceneNumber: scene.sceneNumber,
          sceneId: scene.sceneId,
          duration: scene.duration,
          visualDescription: scene.visualPrompt,
          voiceoverText: scene.voiceoverText,
          referenceImageUrl: scene.imageUrl,
          clip: clip ? {
            status: clip.status,
            provider: clip.provider,
            videoUrl: clip.videoUrl,
            errorMessage: clip.errorMessage,
          } : null,
          audio: audio ? {
            status: audio.status,
            provider: audio.provider,
            audioUrl: audio.audioUrl,
            errorMessage: audio.errorMessage,
          } : null,
          isReady: clip?.status === 'ready' && clip?.videoUrl,
        };
      });

      const readyCount = clipStatus.filter(c => c.isReady).length;
      const failedCount = clipStatus.filter(c => c.clip?.status === 'failed').length;
      const pendingCount = clipStatus.filter(c => c.clip?.status === 'pending' || c.clip?.status === 'generating').length;

      res.json({
        projectId,
        projectTitle: fullProject.project.title,
        projectStatus: fullProject.project.status,
        outputUrl: fullProject.project.outputUrl,
        totalScenes: clipStatus.length,
        readyCount,
        failedCount,
        pendingCount,
        canForceAssemble: readyCount > 0,
        estimatedDuration: clipStatus.filter(c => c.isReady).reduce((sum, c) => sum + (c.duration || 5), 0),
        scenes: clipStatus,
      });
    } catch (error: any) {
      console.error('Failed to get assembly status:', error);
      res.status(500).json({ error: error.message || "Failed to get assembly status" });
    }
  });

  // ==========================================
  // Shotstack Studio SDK Integration Routes
  // ==========================================

  // Get timeline JSON for Studio SDK editor
  app.get("/api/video-projects/:projectId/studio-timeline", async (req, res) => {
    try {
      const { projectId } = req.params;
      
      const fullProject = await storage.getFullVideoProject(projectId);
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      // If we have a saved timeline draft, return it
      if (fullProject.project.timelineDraft) {
        return res.json({
          projectId,
          timeline: fullProject.project.timelineDraft,
          version: fullProject.project.timelineVersion || 1,
          lastEditedAt: fullProject.project.lastEditedAt,
          source: 'saved_draft',
        });
      }

      // Otherwise, generate a timeline from the project's clips and audio
      const readyClips = fullProject.clips.filter((c: any) => 
        c.status === 'ready' && (c.permanentVideoUrl || c.videoUrl)
      );
      const readyAudio = fullProject.audioTracks.filter(a => a.status === 'ready' && a.audioUrl);

      if (readyClips.length === 0) {
        return res.status(400).json({ 
          error: "No ready clips available",
          message: "At least one video clip must be ready before opening the editor",
        });
      }

      // Build Shotstack Edit timeline JSON
      const tracks: any[] = [];
      
      // Video track
      const videoClips: any[] = [];
      let currentTime = 0;
      
      for (const scene of fullProject.scenes.sort((a, b) => a.sceneNumber - b.sceneNumber)) {
        const clip = readyClips.find((c: any) => c.sceneId === scene.sceneId);
        if (!clip) continue;
        
        const videoUrl = (clip as any).permanentVideoUrl || clip.videoUrl;
        const duration = scene.duration || 5;
        
        videoClips.push({
          asset: {
            type: "video",
            src: videoUrl,
            volume: 0.3, // Lower video volume if there's voiceover
          },
          start: currentTime,
          length: duration,
          fit: "cover",
        });
        
        currentTime += duration;
      }
      
      if (videoClips.length > 0) {
        tracks.push({ clips: videoClips });
      }

      // Audio track (voiceovers)
      const audioClips: any[] = [];
      currentTime = 0;
      
      for (const scene of fullProject.scenes.sort((a, b) => a.sceneNumber - b.sceneNumber)) {
        const audio = readyAudio.find(a => a.sceneId === scene.sceneId);
        const duration = scene.duration || 5;
        
        if (audio?.audioUrl) {
          audioClips.push({
            asset: {
              type: "audio",
              src: audio.audioUrl,
              volume: 1,
            },
            start: currentTime,
            length: duration,
          });
        }
        
        currentTime += duration;
      }
      
      if (audioClips.length > 0) {
        tracks.push({ clips: audioClips });
      }

      // Build complete Shotstack Edit JSON
      const timeline = {
        timeline: {
          tracks,
          background: "#000000",
        },
        output: {
          format: "mp4",
          size: {
            width: 1920,
            height: 1080,
          },
          fps: 30,
        },
      };

      res.json({
        projectId,
        timeline,
        version: fullProject.project.timelineVersion || 1,
        lastEditedAt: fullProject.project.lastEditedAt,
        source: 'generated',
        sceneCount: videoClips.length,
        totalDuration: currentTime,
      });
    } catch (error: any) {
      console.error('Failed to get studio timeline:', error);
      res.status(500).json({ error: error.message || "Failed to get studio timeline" });
    }
  });

  // Save timeline from Studio SDK editor
  app.put("/api/video-projects/:projectId/studio-timeline", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { timeline } = req.body;
      
      if (!timeline) {
        return res.status(400).json({ error: "Timeline data is required" });
      }

      const fullProject = await storage.getFullVideoProject(projectId);
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Get current version and increment
      const currentVersion = fullProject.project.timelineVersion || 1;
      const newVersion = currentVersion + 1;

      // Save the timeline draft
      await storage.updateVideoProject(projectId, {
        timelineDraft: timeline,
        timelineVersion: newVersion,
        lastEditedAt: new Date(),
      });

      console.log(`[StudioSDK] Timeline saved for project ${projectId}, version ${newVersion}`);

      res.json({
        success: true,
        projectId,
        version: newVersion,
        savedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Failed to save studio timeline:', error);
      res.status(500).json({ error: error.message || "Failed to save timeline" });
    }
  });

  // Render video from Studio SDK edited timeline
  app.post("/api/video-projects/:projectId/render-from-timeline", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { timeline: customTimeline } = req.body;
      
      const fullProject = await storage.getFullVideoProject(projectId);
      if (!fullProject) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Use provided timeline or saved draft
      const timeline = customTimeline || fullProject.project.timelineDraft;
      
      if (!timeline) {
        return res.status(400).json({ 
          error: "No timeline available",
          message: "Either save a timeline in the editor or provide one in the request",
        });
      }

      // Update status
      await storage.updateVideoProject(projectId, { status: 'rendering' });

      // Import Shotstack render function
      const { renderVideo, waitForRender } = await import("../01-content-factory/integrations/shotstack");

      // Render the edited timeline
      const renderResult = await renderVideo(timeline);

      if (!renderResult.success || !renderResult.renderId) {
        await storage.updateVideoProject(projectId, { status: 'failed' });
        return res.status(500).json({ error: renderResult.error || "Failed to start render" });
      }

      // Wait for render in background
      waitForRender(renderResult.renderId, 600).then(async (result) => {
        if (result.success && result.videoUrl) {
          await storage.updateVideoProject(projectId, {
            status: 'completed',
            outputUrl: result.videoUrl,
          });
          console.log(`[StudioSDK] Render complete for ${projectId}: ${result.videoUrl}`);
        } else {
          await storage.updateVideoProject(projectId, { status: 'failed' });
          console.error(`[StudioSDK] Render failed for ${projectId}: ${result.error}`);
        }
      });

      res.json({
        success: true,
        message: "Render started from edited timeline",
        renderId: renderResult.renderId,
        projectId,
      });
    } catch (error: any) {
      console.error('Failed to render from timeline:', error);
      res.status(500).json({ error: error.message || "Failed to render from timeline" });
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

  // ========== CONTROL CENTER ROUTES ==========
  
  // Initialize default control entities on startup
  await storage.initializeDefaultControlEntities();

  // Get all control entities
  app.get("/api/control-center", async (req, res) => {
    try {
      const entities = await storage.getControlEntities();
      const events = await storage.getControlEvents(20);
      res.json({ entities, recentEvents: events });
    } catch (error: any) {
      console.error('Failed to fetch control center:', error);
      res.status(500).json({ error: "Failed to fetch control center" });
    }
  });

  // Get control entities by category
  app.get("/api/control-center/category/:category", async (req, res) => {
    try {
      const { category } = req.params;
      const entities = await storage.getControlEntitiesByCategory(category);
      res.json(entities);
    } catch (error: any) {
      console.error('Failed to fetch control entities by category:', error);
      res.status(500).json({ error: "Failed to fetch control entities" });
    }
  });

  // Get single control entity
  app.get("/api/control-center/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const entity = await storage.getControlEntity(slug);
      if (!entity) {
        return res.status(404).json({ error: "Control entity not found" });
      }
      res.json(entity);
    } catch (error: any) {
      console.error('Failed to fetch control entity:', error);
      res.status(500).json({ error: "Failed to fetch control entity" });
    }
  });

  // Toggle a control entity
  app.post("/api/control-center/:slug/toggle", async (req, res) => {
    try {
      const { slug } = req.params;
      const { isEnabled, triggeredBy, reason } = req.body;
      
      if (typeof isEnabled !== 'boolean') {
        return res.status(400).json({ error: "isEnabled must be a boolean" });
      }
      
      const entity = await storage.toggleControlEntity(
        slug, 
        isEnabled, 
        triggeredBy || 'user'
      );
      
      res.json(entity);
    } catch (error: any) {
      console.error('Failed to toggle control entity:', error);
      res.status(500).json({ error: error.message || "Failed to toggle control entity" });
    }
  });

  // Master kill switch - disable ALL services
  app.post("/api/control-center/global/kill", async (req, res) => {
    try {
      const { triggeredBy } = req.body;
      await storage.killAllServices(triggeredBy || 'user');
      
      // Cancel any in-flight video generation including scenes and clips
      const projects = await storage.getAllVideoProjects();
      const generatingProjects = projects.filter(p => p.status === 'generating');
      
      for (const project of generatingProjects) {
        // Cancel all in-flight scenes and clips
        const fullProject = await storage.getFullVideoProject(project.projectId);
        if (fullProject) {
          for (const scene of fullProject.scenes) {
            if (scene.status !== 'ready') {
              await storage.updateVideoScene(scene.sceneId, { status: 'failed' });
            }
          }
          for (const clip of fullProject.clips) {
            if (clip.status !== 'ready') {
              await storage.updateVideoClip(clip.clipId, { 
                status: 'failed',
                errorMessage: 'Cancelled by master kill switch'
              });
            }
          }
        }
        await storage.updateVideoProject(project.projectId, { status: 'cancelled' });
      }
      
      const entities = await storage.getControlEntities();
      res.json({ 
        success: true, 
        message: `All ${entities.length} services disabled`,
        cancelledProjects: generatingProjects.length,
        entities 
      });
    } catch (error: any) {
      console.error('Failed to execute kill switch:', error);
      res.status(500).json({ error: error.message || "Failed to execute kill switch" });
    }
  });

  // Reset all services - enable everything
  app.post("/api/control-center/global/reset", async (req, res) => {
    try {
      const { triggeredBy, reason } = req.body;
      await storage.resetAllServices(triggeredBy || 'user');
      
      const entities = await storage.getControlEntities();
      res.json({ 
        success: true, 
        message: `All ${entities.length} services enabled`,
        entities 
      });
    } catch (error: any) {
      console.error('Failed to reset services:', error);
      res.status(500).json({ error: error.message || "Failed to reset services" });
    }
  });

  // Get recent control events (audit log)
  app.get("/api/control-center/events", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await storage.getControlEvents(limit);
      res.json(events);
    } catch (error: any) {
      console.error('Failed to fetch control events:', error);
      res.status(500).json({ error: "Failed to fetch control events" });
    }
  });

  // Check if system is operational (quick health check)
  app.get("/api/control-center/status", async (req, res) => {
    try {
      const masterSwitch = await storage.getControlEntity('master-kill-switch');
      const entities = await storage.getControlEntities();
      
      const categoryStatus = {
        master: masterSwitch?.isEnabled ?? true,
        video: entities.filter(e => e.category === 'video').some(e => e.isEnabled),
        audio: entities.filter(e => e.category === 'audio').some(e => e.isEnabled),
        content: entities.filter(e => e.category === 'content').some(e => e.isEnabled),
        image: entities.filter(e => e.category === 'image').some(e => e.isEnabled),
      };
      
      const operational = categoryStatus.master;
      
      res.json({
        operational,
        masterEnabled: categoryStatus.master,
        categoryStatus,
        totalEntities: entities.length,
        enabledEntities: entities.filter(e => e.isEnabled).length,
        disabledEntities: entities.filter(e => !e.isEnabled).length,
      });
    } catch (error: any) {
      console.error('Failed to check control status:', error);
      res.status(500).json({ error: "Failed to check control status", operational: false });
    }
  });

  // ========== ML MONITORING & SELF-HEALING ROUTES ==========

  // Record a single agent metric
  app.post("/api/metrics", async (req, res) => {
    try {
      const { agentSlug, metricType, value, unit, context } = req.body;
      
      if (!agentSlug || !metricType || value === undefined) {
        return res.status(400).json({ error: "agentSlug, metricType, and value are required" });
      }
      
      const metric = await storage.recordAgentMetric({
        agentSlug,
        metricType,
        value: String(value),
        unit: unit || null,
        context: context ? JSON.stringify(context) : null,
      });
      
      res.status(201).json(metric);
    } catch (error: any) {
      console.error('Failed to record metric:', error);
      res.status(500).json({ error: error.message || "Failed to record metric" });
    }
  });

  // Record multiple metrics in batch
  app.post("/api/metrics/batch", async (req, res) => {
    try {
      const { metrics } = req.body;
      
      if (!Array.isArray(metrics) || metrics.length === 0) {
        return res.status(400).json({ error: "metrics must be a non-empty array" });
      }
      
      const formattedMetrics = metrics.map((m: any) => ({
        agentSlug: m.agentSlug,
        metricType: m.metricType,
        value: String(m.value),
        unit: m.unit || null,
        context: m.context ? JSON.stringify(m.context) : null,
      }));
      
      const recorded = await storage.recordAgentMetrics(formattedMetrics);
      res.status(201).json({ recorded: recorded.length, metrics: recorded });
    } catch (error: any) {
      console.error('Failed to record batch metrics:', error);
      res.status(500).json({ error: error.message || "Failed to record batch metrics" });
    }
  });

  // Get metrics for an agent
  app.get("/api/metrics/:agentSlug", async (req, res) => {
    try {
      const { agentSlug } = req.params;
      const { metricType, startDate, endDate, limit } = req.query;
      
      const options: any = {};
      if (metricType) options.metricType = metricType as string;
      if (startDate) options.startDate = new Date(startDate as string);
      if (endDate) options.endDate = new Date(endDate as string);
      if (limit) options.limit = parseInt(limit as string);
      
      const metrics = await storage.getAgentMetrics(agentSlug, options);
      res.json(metrics);
    } catch (error: any) {
      console.error('Failed to fetch metrics:', error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  // Get latest metrics for all agents (for dashboard)
  app.get("/api/metrics", async (req, res) => {
    try {
      const entities = await storage.getControlEntities();
      const latestMetrics: Record<string, any> = {};
      
      for (const entity of entities.slice(0, 20)) {
        const metrics = await storage.getLatestAgentMetrics(entity.slug);
        if (metrics.length > 0) {
          latestMetrics[entity.slug] = metrics;
        }
      }
      
      res.json(latestMetrics);
    } catch (error: any) {
      console.error('Failed to fetch all metrics:', error);
      res.status(500).json({ error: "Failed to fetch metrics" });
    }
  });

  // Get metrics for anomaly detection analysis
  app.get("/api/metrics/analysis/anomaly", async (req, res) => {
    try {
      const { metricTypes, hours } = req.query;
      
      const types = metricTypes 
        ? (metricTypes as string).split(',') 
        : ['qa_score', 'api_failure_rate', 'response_time', 'cost', 'throughput'];
      const hoursNum = hours ? parseInt(hours as string) : 24;
      
      const metrics = await storage.getMetricsForAnomalyDetection(types, hoursNum);
      res.json({ 
        metricTypes: types, 
        hours: hoursNum, 
        count: metrics.length, 
        metrics 
      });
    } catch (error: any) {
      console.error('Failed to fetch analysis metrics:', error);
      res.status(500).json({ error: "Failed to fetch analysis metrics" });
    }
  });

  // ========== HEALING ALERTS ROUTES ==========

  // Get all healing alerts
  app.get("/api/healing-alerts", async (req, res) => {
    try {
      const { status, agentSlug, limit } = req.query;
      
      const options: any = {};
      if (status) options.status = status as string;
      if (agentSlug) options.agentSlug = agentSlug as string;
      if (limit) options.limit = parseInt(limit as string);
      
      const alerts = await storage.getHealingAlerts(options);
      res.json(alerts);
    } catch (error: any) {
      console.error('Failed to fetch healing alerts:', error);
      res.status(500).json({ error: "Failed to fetch healing alerts" });
    }
  });

  // Get active healing alerts (for dashboard)
  app.get("/api/healing-alerts/active", async (req, res) => {
    try {
      const alerts = await storage.getActiveHealingAlerts();
      res.json(alerts);
    } catch (error: any) {
      console.error('Failed to fetch active healing alerts:', error);
      res.status(500).json({ error: "Failed to fetch active healing alerts" });
    }
  });

  // Create a new healing alert (from ML detection service)
  app.post("/api/healing-alerts", async (req, res) => {
    try {
      const alert = await storage.createHealingAlert(req.body);
      res.status(201).json(alert);
    } catch (error: any) {
      console.error('Failed to create healing alert:', error);
      res.status(500).json({ error: error.message || "Failed to create healing alert" });
    }
  });

  // Acknowledge a healing alert
  app.post("/api/healing-alerts/:id/acknowledge", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { acknowledgedBy } = req.body;
      
      const alert = await storage.acknowledgeHealingAlert(id, acknowledgedBy || 'user');
      res.json(alert);
    } catch (error: any) {
      console.error('Failed to acknowledge healing alert:', error);
      res.status(500).json({ error: error.message || "Failed to acknowledge healing alert" });
    }
  });

  // Resolve a healing alert
  app.post("/api/healing-alerts/:id/resolve", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { resolvedBy } = req.body;
      
      const alert = await storage.resolveHealingAlert(id, resolvedBy || 'user');
      res.json(alert);
    } catch (error: any) {
      console.error('Failed to resolve healing alert:', error);
      res.status(500).json({ error: error.message || "Failed to resolve healing alert" });
    }
  });

  // Dismiss a healing alert
  app.post("/api/healing-alerts/:id/dismiss", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { dismissedBy } = req.body;
      
      const alert = await storage.dismissHealingAlert(id, dismissedBy || 'user');
      res.json(alert);
    } catch (error: any) {
      console.error('Failed to dismiss healing alert:', error);
      res.status(500).json({ error: error.message || "Failed to dismiss healing alert" });
    }
  });

  // Execute healing action for an alert
  app.post("/api/healing-alerts/:id/execute", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const alerts = await storage.getHealingAlerts({ limit: 100 });
      const alert = alerts.find(a => a.id === id);
      
      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }
      
      // Execute the suggested action
      const action = alert.suggestedAction;
      let actionResult: any = { success: false };
      
      switch (action) {
        case 'restart':
          // Restart the agent by toggling off and on
          await storage.toggleControlEntity(alert.agentSlug, false, 'healing_engine');
          await new Promise(resolve => setTimeout(resolve, 1000));
          await storage.toggleControlEntity(alert.agentSlug, true, 'healing_engine');
          actionResult = { success: true, action: 'restart', message: `${alert.agentSlug} restarted` };
          break;
          
        case 'scale_down':
        case 'scale_up':
          // Log the action - scaling would be handled by infrastructure
          actionResult = { 
            success: true, 
            action, 
            message: `${action} requested for ${alert.agentSlug}`,
            note: 'Scaling actions require infrastructure support'
          };
          break;
          
        case 'investigate':
          // Mark for investigation - generate detailed report
          actionResult = {
            success: true,
            action: 'investigate',
            message: `Investigation triggered for ${alert.agentSlug}`,
            metrics: await storage.getAgentMetrics(alert.agentSlug, { limit: 50 })
          };
          break;
          
        case 'retrain':
          // Trigger model retraining
          actionResult = {
            success: true,
            action: 'retrain',
            message: 'Model retraining scheduled',
            note: 'ML model will be retrained with latest data'
          };
          break;
          
        default:
          actionResult = { success: false, error: `Unknown action: ${action}` };
      }
      
      // Resolve the alert after executing the action
      if (actionResult.success) {
        await storage.resolveHealingAlert(id, 'healing_engine');
      }
      
      res.json(actionResult);
    } catch (error: any) {
      console.error('Failed to execute healing action:', error);
      res.status(500).json({ error: error.message || "Failed to execute healing action" });
    }
  });

  // ========== ANOMALY MODELS ROUTES ==========

  // Get all anomaly detection models
  app.get("/api/anomaly-models", async (req, res) => {
    try {
      const models = await storage.getAnomalyModels();
      res.json(models);
    } catch (error: any) {
      console.error('Failed to fetch anomaly models:', error);
      res.status(500).json({ error: "Failed to fetch anomaly models" });
    }
  });

  // Get active model for a metric type
  app.get("/api/anomaly-models/active/:metricType", async (req, res) => {
    try {
      const { metricType } = req.params;
      const model = await storage.getActiveAnomalyModel(metricType);
      res.json(model || null);
    } catch (error: any) {
      console.error('Failed to fetch active model:', error);
      res.status(500).json({ error: "Failed to fetch active model" });
    }
  });

  // Create a new anomaly model
  app.post("/api/anomaly-models", async (req, res) => {
    try {
      const model = await storage.createAnomalyModel(req.body);
      res.status(201).json(model);
    } catch (error: any) {
      console.error('Failed to create anomaly model:', error);
      res.status(500).json({ error: error.message || "Failed to create anomaly model" });
    }
  });

  // Update an anomaly model
  app.patch("/api/anomaly-models/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const model = await storage.updateAnomalyModel(id, req.body);
      res.json(model);
    } catch (error: any) {
      console.error('Failed to update anomaly model:', error);
      res.status(500).json({ error: error.message || "Failed to update anomaly model" });
    }
  });

  // Trigger anomaly detection scan
  app.post("/api/anomaly-detection/scan", async (req, res) => {
    try {
      const { hours = 24 } = req.body;
      
      // Get all recent metrics for analysis
      const metricTypes = ['qa_score', 'api_failure_rate', 'response_time', 'cost', 'throughput'];
      const metrics = await storage.getMetricsForAnomalyDetection(metricTypes, hours);
      
      if (metrics.length < 10) {
        return res.json({ 
          success: true, 
          message: 'Insufficient data for anomaly detection',
          metricsAnalyzed: metrics.length,
          alertsGenerated: 0,
          alerts: []
        });
      }
      
      // Group metrics by agent and analyze
      const alertsGenerated: any[] = [];
      const metricsByAgent: Record<string, typeof metrics> = {};
      
      for (const metric of metrics) {
        if (!metricsByAgent[metric.agentSlug]) {
          metricsByAgent[metric.agentSlug] = [];
        }
        metricsByAgent[metric.agentSlug].push(metric);
      }
      
      // Simple threshold-based anomaly detection for now
      // (Full ML detection would be done by the Python service)
      for (const [agentSlug, agentMetrics] of Object.entries(metricsByAgent)) {
        const byType: Record<string, number[]> = {};
        
        for (const m of agentMetrics) {
          if (!byType[m.metricType]) byType[m.metricType] = [];
          byType[m.metricType].push(parseFloat(m.value));
        }
        
        for (const [metricType, values] of Object.entries(byType)) {
          if (values.length < 3) continue;
          
          const mean = values.reduce((a, b) => a + b, 0) / values.length;
          const std = Math.sqrt(values.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / values.length);
          const latest = values[values.length - 1];
          
          // Check for anomalies (>2 std deviations)
          if (std > 0 && Math.abs(latest - mean) > 2 * std) {
            const anomalyScore = Math.min(1, Math.abs(latest - mean) / (3 * std));
            const isHigh = latest > mean;
            
            let suggestedAction: string;
            let severity: string;
            
            if (metricType === 'api_failure_rate' && isHigh) {
              suggestedAction = 'restart';
              severity = anomalyScore > 0.8 ? 'critical' : 'warning';
            } else if (metricType === 'response_time' && isHigh) {
              suggestedAction = 'investigate';
              severity = anomalyScore > 0.7 ? 'warning' : 'info';
            } else if (metricType === 'cost' && isHigh) {
              suggestedAction = 'scale_down';
              severity = 'warning';
            } else if (metricType === 'qa_score' && !isHigh) {
              suggestedAction = 'retrain';
              severity = anomalyScore > 0.6 ? 'warning' : 'info';
            } else {
              suggestedAction = 'investigate';
              severity = 'info';
            }
            
            const alert = await storage.createHealingAlert({
              agentSlug,
              alertType: 'anomaly',
              severity,
              title: `${metricType} anomaly detected for ${agentSlug}`,
              description: `${metricType} is ${isHigh ? 'unusually high' : 'unusually low'}: ${latest.toFixed(2)} vs expected ${mean.toFixed(2)} (±${std.toFixed(2)})`,
              metricType,
              currentValue: String(latest),
              expectedValue: String(mean),
              anomalyScore: String(anomalyScore),
              suggestedAction,
              actionDetails: JSON.stringify({ mean, std, deviation: Math.abs(latest - mean) / std }),
              status: 'active',
            });
            
            alertsGenerated.push(alert);
          }
        }
      }
      
      res.json({
        success: true,
        message: `Anomaly detection complete`,
        metricsAnalyzed: metrics.length,
        agentsAnalyzed: Object.keys(metricsByAgent).length,
        alertsGenerated: alertsGenerated.length,
        alerts: alertsGenerated,
      });
    } catch (error: any) {
      console.error('Failed to run anomaly detection:', error);
      res.status(500).json({ error: error.message || "Failed to run anomaly detection" });
    }
  });

  return httpServer;
}

// Helper function to build enhanced video prompts with voiceover context
function buildEnhancedVideoPrompt(
  scene: { 
    sceneNumber: number; 
    title: string; 
    visualPrompt: string; 
    voiceoverText?: string | null;
    duration: number;
  },
  allScenes: Array<{ sceneNumber: number; title: string; voiceoverText?: string | null }>
): string {
  const parts: string[] = [];
  
  // Add visual description as the foundation
  parts.push(scene.visualPrompt);
  
  // Add voiceover context - this is critical for alignment
  if (scene.voiceoverText) {
    parts.push(`The narrator is saying: "${scene.voiceoverText}"`);
  }
  
  // Add scene context for narrative flow
  const scenePosition = scene.sceneNumber === 1 ? 'opening' : 
                        scene.sceneNumber === allScenes.length ? 'closing' : 'middle';
  parts.push(`This is the ${scenePosition} scene (${scene.sceneNumber} of ${allScenes.length})`);
  
  // Add title context if meaningful
  if (scene.title && scene.title !== `Scene ${scene.sceneNumber}`) {
    parts.push(`Scene purpose: ${scene.title}`);
  }
  
  // Add production quality cues
  parts.push('Professional quality, smooth motion, cinematic lighting');
  
  // Combine into a coherent prompt
  return parts.join('. ') + '.';
}

// Helper to check if system is operational via control center (full hierarchy check)
async function isSystemOperational(storage: any, category: string = 'video'): Promise<{ operational: boolean; reason?: string }> {
  try {
    // Check master kill switch first
    const masterSwitch = await storage.getControlEntity('master-kill-switch');
    if (!masterSwitch?.isEnabled) {
      return { operational: false, reason: 'Master kill switch is disabled' };
    }
    
    // Check category pipeline
    const pipelineSlug = `${category}-pipeline`;
    const pipeline = await storage.getControlEntity(pipelineSlug);
    if (pipeline && !pipeline.isEnabled) {
      return { operational: false, reason: `${category} pipeline is disabled` };
    }
    
    // Check if at least one provider in the category is enabled
    const categoryEntities = await storage.getControlEntitiesByCategory(category);
    const providers = categoryEntities.filter((e: any) => e.type === 'provider');
    const hasEnabledProvider = providers.some((p: any) => p.isEnabled);
    
    if (providers.length > 0 && !hasEnabledProvider) {
      return { operational: false, reason: `No ${category} providers are enabled in Control Tower` };
    }
    
    return { operational: true };
  } catch (error) {
    console.warn('[ControlCheck] Error checking control status, assuming operational:', error);
    return { operational: true };
  }
}

// Cancel all in-flight scenes and clips for a project
async function cancelProjectInFlight(storage: any, projectId: string): Promise<void> {
  try {
    const fullProject = await storage.getFullVideoProject(projectId);
    if (!fullProject) return;
    
    // Update all non-ready scenes to cancelled
    for (const scene of fullProject.scenes) {
      if (scene.status !== 'ready') {
        await storage.updateVideoScene(scene.sceneId, { status: 'failed' });
      }
    }
    
    // Update all non-ready clips to failed
    for (const clip of fullProject.clips) {
      if (clip.status !== 'ready') {
        await storage.updateVideoClip(clip.clipId, { 
          status: 'failed',
          errorMessage: 'Cancelled by Control Tower'
        });
      }
    }
    
    console.log(`[ControlTower] Cancelled in-flight items for project ${projectId}`);
  } catch (error) {
    console.error('[ControlTower] Error cancelling in-flight items:', error);
  }
}

// Background video generation function with multi-provider fallback
async function generateVideoProjectAsync(
  projectId: string, 
  preferredProvider: string | null,
  storage: any
) {
  try {
    // Check if system is operational before starting
    const systemCheck = await isSystemOperational(storage);
    if (!systemCheck.operational) {
      console.log(`[VideoProject] Generation blocked: ${systemCheck.reason}`);
      await storage.updateVideoProject(projectId, { 
        status: 'cancelled',
      });
      return;
    }

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

    // Import the fallback system and image generation
    const { generateVideoWithFallback, waitForVideoWithProvider, generateUniqueSceneImage } = await import("../01-content-factory/integrations/video-provider");

    for (const scene of fullProject.scenes) {
      // Check if system is still operational before each scene
      const sceneCheck = await isSystemOperational(storage, 'video');
      if (!sceneCheck.operational) {
        console.log(`[VideoProject] Generation stopped mid-process: ${sceneCheck.reason}`);
        await cancelProjectInFlight(storage, projectId);
        await storage.updateVideoProject(projectId, { status: 'cancelled' });
        return;
      }

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
          
          // Build enhanced prompt with voiceover context and scene narrative
          const enhancedPrompt = buildEnhancedVideoPrompt(scene, fullProject.scenes);
          console.log(`[VideoProject] Enhanced prompt: ${enhancedPrompt.substring(0, 150)}...`);
          
          // Generate unique DALL-E image for this scene (for image-to-video providers)
          let sceneImageBase64: string | undefined;
          console.log(`[VideoProject] Generating unique DALL-E image for scene ${scene.sceneNumber}...`);
          const imageResult = await generateUniqueSceneImage(scene.visualPrompt || enhancedPrompt);
          if (imageResult.success && imageResult.imageBase64) {
            sceneImageBase64 = imageResult.imageBase64;
            console.log(`[VideoProject] DALL-E image generated for scene ${scene.sceneNumber}`);
          } else {
            console.log(`[VideoProject] DALL-E image generation failed: ${imageResult.error}, continuing without image`);
          }
          
          // Try each provider in order until one succeeds
          for (const providerConfig of enabledProviders) {
            console.log(`[VideoProject] Trying provider: ${providerConfig.name}`);
            
            // Use the fallback system to generate video with this specific provider
            const singleProvider = [providerConfig];
            const taskResult = await generateVideoWithFallback(
              enhancedPrompt,
              singleProvider,
              {
                duration: Math.min(scene.duration, 10),
                aspectRatio: '16:9',
                imageBase64: sceneImageBase64,
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
                await storage.createActivityLog({
                  runId: `video_proj_${projectId}`,
                  eventType: 'video_provider_failed',
                  level: 'warning',
                  message: `Scene ${scene.sceneNumber}: ${usedProvider} failed - ${clipResult?.error}`,
                  metadata: JSON.stringify({ sceneNumber: scene.sceneNumber, provider: usedProvider }),
                });
                continue;
              } else {
                // Still processing after timeout - mark as failed and try next
                console.log(`[VideoProject] Provider ${usedProvider} timed out, trying next provider...`);
                await storage.createActivityLog({
                  runId: `video_proj_${projectId}`,
                  eventType: 'video_provider_timeout',
                  level: 'warning',
                  message: `Scene ${scene.sceneNumber}: ${usedProvider} timed out, retrying...`,
                  metadata: JSON.stringify({ sceneNumber: scene.sceneNumber, provider: usedProvider }),
                });
                continue;
              }
            } else {
              console.log(`[VideoProject] Provider ${providerConfig.name} failed to start: ${taskResult.error}`);
              await storage.createActivityLog({
                runId: `video_proj_${projectId}`,
                eventType: 'video_provider_error',
                level: 'warning',
                message: `Scene ${scene.sceneNumber}: ${providerConfig.name} startup failed`,
                metadata: JSON.stringify({ sceneNumber: scene.sceneNumber, provider: providerConfig.name, error: taskResult.error }),
              });
              continue;
            }
          }

          // Update clip with final result
          if (successfulProvider && clipResult?.success && clipResult.videoUrl) {
            await storage.updateVideoClip(clipId, {
              videoUrl: clipResult.videoUrl,
              status: 'ready',
            });
            
            // Proactively cache Google authenticated URLs to prevent expiration
            const { isGoogleAuthenticatedUrl, preprocessVideoUrl } = await import("../01-content-factory/integrations/shotstack");
            if (isGoogleAuthenticatedUrl(clipResult.videoUrl)) {
              console.log(`[VideoProject] Scene ${scene.sceneNumber}: Caching Veo 3.1 video to prevent expiration...`);
              try {
                const permanentUrl = await preprocessVideoUrl(clipResult.videoUrl, scene.sceneId);
                await storage.updateVideoClip(clipId, { permanentVideoUrl: permanentUrl });
                console.log(`[VideoProject] Scene ${scene.sceneNumber}: Video cached successfully`);
              } catch (cacheError: any) {
                console.error(`[VideoProject] Scene ${scene.sceneNumber}: Failed to cache video - ${cacheError.message}`);
                await storage.createActivityLog({
                  runId: `video_proj_${projectId}`,
                  eventType: 'video_cache_failed',
                  level: 'warning',
                  message: `Scene ${scene.sceneNumber}: Failed to cache video for permanent storage`,
                  metadata: JSON.stringify({ sceneNumber: scene.sceneNumber, error: cacheError.message }),
                });
              }
            } else {
              // For non-Google URLs (Runway, etc.), they're already public - store as permanent
              await storage.updateVideoClip(clipId, { permanentVideoUrl: clipResult.videoUrl });
            }
            
            await storage.updateVideoScene(scene.sceneId, { status: 'ready' });
            await storage.createActivityLog({
              runId: `video_proj_${projectId}`,
              eventType: 'video_scene_ready',
              level: 'success',
              message: `Scene ${scene.sceneNumber} video ready via ${successfulProvider}`,
              metadata: JSON.stringify({ sceneNumber: scene.sceneNumber, provider: successfulProvider }),
            });
            console.log(`[VideoProject] Scene ${scene.sceneNumber} clip ready (via ${successfulProvider})`);
          } else {
            await storage.updateVideoClip(clipId, {
              status: 'failed',
              errorMessage: clipResult?.error || 'All providers failed',
            });
            await storage.updateVideoScene(scene.sceneId, { status: 'failed' });
            await storage.createActivityLog({
              runId: `video_proj_${projectId}`,
              eventType: 'video_scene_failed',
              level: 'error',
              message: `Scene ${scene.sceneNumber} video generation failed: ${clipResult?.error || 'All providers failed'}`,
              metadata: JSON.stringify({ sceneNumber: scene.sceneNumber, error: clipResult?.error }),
            });
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

        // Generate audio (ElevenLabs with OpenAI TTS fallback)
        if (scene.voiceoverText && audioNeedsGeneration) {
          try {
            console.log(`[VideoProject] Generating audio for scene ${scene.sceneNumber}`);
            const { generateVoiceoverWithHostedUrl } = await import("../01-content-factory/integrations/elevenlabs");
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

            const audioResult = await generateVoiceoverWithHostedUrl(scene.voiceoverText, {
              voiceStyle: 'professional_male',
              sceneId: scene.sceneId,
            });

            if (audioResult.success && audioResult.audioUrl) {
              await storage.updateAudioTrack(trackId, {
                audioUrl: audioResult.audioUrl,
                duration: audioResult.duration,
                status: 'ready',
                provider: audioResult.provider || 'elevenlabs',
              });
              await storage.createActivityLog({
                runId: `video_proj_${projectId}`,
                eventType: 'audio_ready',
                level: 'success',
                message: `Scene ${scene.sceneNumber} audio ready via ${audioResult.provider}`,
                metadata: JSON.stringify({ sceneNumber: scene.sceneNumber, provider: audioResult.provider }),
              });
              console.log(`[VideoProject] Scene ${scene.sceneNumber} audio ready (via ${audioResult.provider})`);
            } else {
              const errorMsg = audioResult.error || 'Unknown error';
              await storage.updateAudioTrack(trackId, {
                status: 'failed',
                errorMessage: errorMsg,
              });
              await storage.createActivityLog({
                runId: `video_proj_${projectId}`,
                eventType: 'audio_generation_failed',
                level: 'error',
                message: `Scene ${scene.sceneNumber} audio generation failed: ${errorMsg}`,
                metadata: JSON.stringify({ sceneNumber: scene.sceneNumber, error: errorMsg }),
              });
              console.error(`[VideoProject] Audio generation failed for scene ${scene.sceneNumber}: ${errorMsg}`);
            }
          } catch (audioError) {
            console.error(`[VideoProject] Audio generation failed for scene ${scene.sceneNumber}:`, audioError);
            await storage.createActivityLog({
              runId: `video_proj_${projectId}`,
              eventType: 'audio_error',
              level: 'error',
              message: `Scene ${scene.sceneNumber} audio processing error: ${audioError instanceof Error ? audioError.message : 'Unknown error'}`,
              metadata: JSON.stringify({ sceneNumber: scene.sceneNumber }),
            });
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
    const allScenesReady = updatedProject?.scenes.every((s: { status: string }) => s.status === 'ready');
    const allClipsReady = updatedProject?.clips.every((c: { status: string }) => c.status === 'ready');
    const allAudioReady = updatedProject?.audioTracks.every((a: { status: string }) => a.status === 'ready');
    
    const allReady = allScenesReady && allClipsReady && allAudioReady;
    
    if (allReady && updatedProject) {
      console.log(`[VideoProject] All assets ready, triggering Shotstack assembly for ${projectId}`);
      await storage.updateVideoProject(projectId, { status: 'assembling' });
      
      // Trigger Shotstack assembly
      try {
        const { assembleFinalVideo } = await import("../01-content-factory/integrations/shotstack");
        
        const assemblyResult = await assembleFinalVideo(
          updatedProject.project,
          updatedProject.scenes,
          updatedProject.clips,
          updatedProject.audioTracks,
          {
            resolution: 'hd',
            aspectRatio: '16:9',
            transitions: 'fade',
            voiceoverVolume: 1.0,
            backgroundMusicVolume: 0.3,
          }
        );
        
        if (assemblyResult.success && assemblyResult.videoUrl) {
          await storage.updateVideoProject(projectId, {
            status: 'completed',
            outputUrl: assemblyResult.videoUrl,
          });
          console.log(`[VideoProject] Assembly complete for ${projectId}: ${assemblyResult.videoUrl}`);
        } else if (assemblyResult.renderId) {
          // Shotstack is processing - poll for completion
          console.log(`[VideoProject] Shotstack render started: ${assemblyResult.renderId}`);
          
          const { waitForRender } = await import("../01-content-factory/integrations/shotstack");
          const finalResult = await waitForRender(assemblyResult.renderId, 600, 15);
          
          if (finalResult.success && finalResult.videoUrl) {
            await storage.updateVideoProject(projectId, {
              status: 'completed',
              outputUrl: finalResult.videoUrl,
            });
            console.log(`[VideoProject] Final video ready: ${finalResult.videoUrl}`);
          } else {
            throw new Error(finalResult.error || 'Shotstack render failed');
          }
        } else {
          throw new Error(assemblyResult.error || 'Assembly failed');
        }
      } catch (assemblyError: any) {
        console.error(`[VideoProject] Assembly failed for ${projectId}:`, assemblyError);
        await storage.updateVideoProject(projectId, {
          status: 'failed',
        });
      }
    } else {
      await storage.updateVideoProject(projectId, {
        status: allReady ? 'ready' : 'failed',
      });
      console.log(`[VideoProject] Generation complete for ${projectId}, status: ${allReady ? 'ready' : 'failed'}`);
    }

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

  // Test Alibaba image generation
  app.post("/api/test-image", async (req, res) => {
    try {
      const { prompt = "A serene mountain landscape at sunset", provider = "alibaba" } = req.body;
      
      if (provider === "alibaba") {
        const { generateSceneImageWithAlibaba } = await import("../01-content-factory/integrations/alibaba-image");
        console.log("[Test] Testing Alibaba image generation...");
        const result = await generateSceneImageWithAlibaba(prompt, "16:9");
        return res.json({
          provider: "alibaba",
          ...result,
        });
      } else if (provider === "gemini") {
        const { generateImageWithNanoBananaPro } = await import("../01-content-factory/integrations/nano-banana-pro");
        console.log("[Test] Testing Gemini image generation...");
        const result = await generateImageWithNanoBananaPro(prompt, { resolution: "2K" });
        return res.json({
          provider: "gemini",
          ...result,
        });
      } else if (provider === "fal") {
        const { generateImageWithFalFluxPro } = await import("../01-content-factory/integrations/fal-ai");
        console.log("[Test] Testing Fal AI Flux Pro image generation...");
        const result = await generateImageWithFalFluxPro(prompt, { width: 1280, height: 720 });
        return res.json({
          provider: "fal",
          ...result,
        });
      }
      
      res.status(400).json({ error: "Invalid provider. Use 'alibaba', 'gemini', or 'fal'" });
    } catch (error: any) {
      console.error("[Test] Image generation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Test Shotstack audio hosting
  app.post("/api/test-audio-hosting", async (req, res) => {
    try {
      const { uploadAudioToShotstack } = await import("../01-content-factory/integrations/shotstack");
      
      console.log("[Test] Testing Shotstack audio ingest...");
      
      // Create a small test audio buffer (silent MP3 header)
      const testBuffer = Buffer.alloc(1024, 0);
      
      const result = await uploadAudioToShotstack(testBuffer, 'test-audio.mp3');
      
      res.json({
        provider: "shotstack_ingest",
        ...result,
      });
    } catch (error: any) {
      console.error("[Test] Audio hosting error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // OpenRouter API Routes (Unified AI Gateway)
  // ==========================================

  // Test OpenRouter connection
  app.get("/api/openrouter/test", async (req, res) => {
    try {
      const { openRouterClient } = await import("../01-content-factory/integrations/openrouter");
      const result = await openRouterClient.testConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // List available OpenRouter models
  app.get("/api/openrouter/models", async (req, res) => {
    try {
      const { openRouterClient, OPENROUTER_MODELS } = await import("../01-content-factory/integrations/openrouter");
      res.json({
        available: openRouterClient.isAvailable(),
        models: Object.entries(OPENROUTER_MODELS).map(([key, model]) => ({
          key,
          ...model,
        })),
        freeModels: openRouterClient.getFreeModels(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate text with OpenRouter
  app.post("/api/openrouter/generate", async (req, res) => {
    try {
      const { openRouterClient } = await import("../01-content-factory/integrations/openrouter");
      const { modelKey, messages, temperature, maxTokens, preferFree } = req.body;

      let result;
      if (modelKey) {
        result = await openRouterClient.generateText({
          modelKey,
          messages,
          temperature,
          maxTokens,
        });
      } else {
        result = await openRouterClient.generateWithFallback({
          messages,
          preferFree: preferFree !== false,
          temperature,
          maxTokens,
        });
      }

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Generate blog content with OpenRouter
  app.post("/api/openrouter/blog", async (req, res) => {
    try {
      const { openRouterClient } = await import("../01-content-factory/integrations/openrouter");
      const { topic, keywords } = req.body;

      if (!topic) {
        return res.status(400).json({ error: "topic is required" });
      }

      const result = await openRouterClient.generateBlogContent(
        topic,
        keywords || []
      );

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Generate social content with OpenRouter
  app.post("/api/openrouter/social", async (req, res) => {
    try {
      const { openRouterClient } = await import("../01-content-factory/integrations/openrouter");
      const { topic, platform } = req.body;

      if (!topic || !platform) {
        return res.status(400).json({ error: "topic and platform are required" });
      }

      if (!['linkedin', 'twitter', 'instagram'].includes(platform)) {
        return res.status(400).json({ error: "platform must be linkedin, twitter, or instagram" });
      }

      const result = await openRouterClient.generateSocialContent(topic, platform);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Analyze content with OpenRouter
  app.post("/api/openrouter/analyze", async (req, res) => {
    try {
      const { openRouterClient } = await import("../01-content-factory/integrations/openrouter");
      const { content, analysisType } = req.body;

      if (!content || !analysisType) {
        return res.status(400).json({ error: "content and analysisType are required" });
      }

      if (!['seo', 'readability', 'sentiment'].includes(analysisType)) {
        return res.status(400).json({ error: "analysisType must be seo, readability, or sentiment" });
      }

      const result = await openRouterClient.analyzeContent(content, analysisType);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================
  // Adobe Firefly API Routes
  // ==========================================

  // Test Adobe Firefly connection
  app.get("/api/adobe-firefly/test", async (req, res) => {
    try {
      const { adobeFirefly } = await import("../01-content-factory/integrations/adobe-firefly");
      const result = await adobeFirefly.testConnection();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // List Adobe Firefly custom models
  app.get("/api/adobe-firefly/models", async (req, res) => {
    try {
      const { adobeFirefly } = await import("../01-content-factory/integrations/adobe-firefly");
      const models = await adobeFirefly.listCustomModels();
      res.json({ models });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate image with Adobe Firefly
  app.post("/api/adobe-firefly/generate", async (req, res) => {
    try {
      const { adobeFirefly } = await import("../01-content-factory/integrations/adobe-firefly");
      const { prompt, negativePrompt, width, height, numImages, contentClass, style } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "prompt is required" });
      }

      const result = await adobeFirefly.generateImage({
        prompt,
        negativePrompt,
        width: width || 1024,
        height: height || 1024,
        numImages: numImages || 1,
        contentClass: contentClass || 'art',
        style,
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Generate with Firefly custom model
  app.post("/api/adobe-firefly/generate-custom", async (req, res) => {
    try {
      const { adobeFirefly } = await import("../01-content-factory/integrations/adobe-firefly");
      const { modelId, prompt, numImages, width, height } = req.body;
      
      if (!modelId || !prompt) {
        return res.status(400).json({ error: "modelId and prompt are required" });
      }

      const result = await adobeFirefly.generateWithCustomModel({
        modelId,
        prompt,
        numImages: numImages || 1,
        width: width || 1024,
        height: height || 1024,
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Comprehensive provider status endpoint
  app.get("/api/providers/status", async (req, res) => {
    try {
      const providerStatus: Record<string, { 
        configured: boolean; 
        status: 'working' | 'error' | 'not_configured' | 'limited';
        message: string;
        remediation?: string;
      }> = {};

      // Check Alibaba Dashscope (Image)
      const alibabaConfigured = !!process.env.DASHSCOPE_API_KEY;
      const alibabaRegion = process.env.DASHSCOPE_REGION || 'beijing';
      providerStatus['alibaba_image'] = {
        configured: alibabaConfigured,
        status: alibabaConfigured ? 'working' : 'not_configured',
        message: alibabaConfigured 
          ? `Alibaba Dashscope configured (${alibabaRegion})`
          : 'DASHSCOPE_API_KEY not set',
        remediation: alibabaConfigured ? undefined : 
          'Get API key from https://modelstudio.alibabacloud.com/ and enable Wan 2.5 or Qwen Image models',
      };

      // Check Gemini (Image)
      const geminiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
      providerStatus['gemini_image'] = {
        configured: !!geminiKey,
        status: geminiKey ? 'working' : 'not_configured',
        message: geminiKey 
          ? 'Gemini Image Generation configured'
          : 'GEMINI_API_KEY not set',
        remediation: geminiKey ? undefined :
          'Enable Generative Language API and billing at https://console.cloud.google.com',
      };

      // Check ElevenLabs (Audio)
      const elevenlabsKey = process.env.ELEVENLABS_API_KEY;
      providerStatus['elevenlabs'] = {
        configured: !!elevenlabsKey,
        status: elevenlabsKey ? 'limited' : 'not_configured',
        message: elevenlabsKey 
          ? 'ElevenLabs configured (check quota)'
          : 'ELEVENLABS_API_KEY not set',
        remediation: elevenlabsKey 
          ? 'Purchase additional credits at https://elevenlabs.io/subscription'
          : 'Get API key from https://elevenlabs.io',
      };

      // Check Runway (Video/Image/Audio)
      const runwayKey = process.env.RUNWAY_API_KEY;
      providerStatus['runway'] = {
        configured: !!runwayKey,
        status: runwayKey ? 'working' : 'not_configured',
        message: runwayKey 
          ? 'Runway configured - Gen-4 Turbo/Aleph, Veo 3/3.1, Upscaling, Image Gen, ElevenLabs Audio'
          : 'RUNWAY_API_KEY not set',
        remediation: runwayKey ? undefined :
          'Get API key from https://dev.runwayml.com - Full model list at /api/runway/models',
      };

      // Check Shotstack (Video Assembly)
      const shotstackKey = process.env.SHOTSTACK_API_KEY;
      providerStatus['shotstack'] = {
        configured: !!shotstackKey,
        status: shotstackKey ? 'working' : 'not_configured',
        message: shotstackKey 
          ? 'Shotstack configured for video assembly & audio hosting'
          : 'SHOTSTACK_API_KEY not set',
        remediation: shotstackKey ? undefined :
          'Get API key from https://shotstack.io',
      };

      // Check Fal AI (Video/Image)
      const falKey = process.env.FAL_API_KEY;
      providerStatus['fal_ai'] = {
        configured: !!falKey,
        status: falKey ? 'working' : 'not_configured',
        message: falKey 
          ? 'Fal AI configured (Veo 2, Kling, Flux Pro)'
          : 'FAL_API_KEY not set',
        remediation: falKey ? undefined :
          'Get API key from https://fal.ai/dashboard',
      };

      // Check Adobe Firefly (Image)
      const adobeClientId = process.env.ADOBE_CLIENT_ID;
      const adobeClientSecret = process.env.ADOBE_CLIENT_SECRET;
      const adobeConfigured = !!(adobeClientId && adobeClientSecret);
      providerStatus['adobe_firefly'] = {
        configured: adobeConfigured,
        status: adobeConfigured ? 'working' : 'not_configured',
        message: adobeConfigured 
          ? 'Adobe Firefly configured (Image Generation, Expand, Fill, Custom Models)'
          : 'ADOBE_CLIENT_ID or ADOBE_CLIENT_SECRET not set',
        remediation: adobeConfigured ? undefined :
          'Get credentials from https://developer.adobe.com/console - Create project with Firefly API',
      };

      // Check Anthropic (Content Generation)
      const anthropicKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
      providerStatus['anthropic'] = {
        configured: !!anthropicKey,
        status: anthropicKey ? 'working' : 'not_configured',
        message: anthropicKey 
          ? 'Claude Sonnet configured for content generation'
          : 'ANTHROPIC_API_KEY not set',
        remediation: anthropicKey ? undefined :
          'Get API key from https://console.anthropic.com',
      };

      // Check OpenRouter (Unified AI Gateway)
      const openrouterKey = process.env.OPENROUTER_API_KEY;
      providerStatus['openrouter'] = {
        configured: !!openrouterKey,
        status: openrouterKey ? 'working' : 'not_configured',
        message: openrouterKey 
          ? 'OpenRouter configured (DeepSeek R1, Llama 4, Qwen 3, Mistral - many FREE models)'
          : 'OPENROUTER_API_KEY not set',
        remediation: openrouterKey ? undefined :
          'Get API key from https://openrouter.ai - Provides access to 100+ models with many free options',
      };

      // Summary
      const workingCount = Object.values(providerStatus).filter(p => p.status === 'working').length;
      const limitedCount = Object.values(providerStatus).filter(p => p.status === 'limited').length;
      const errorCount = Object.values(providerStatus).filter(p => p.status === 'error').length;
      const notConfiguredCount = Object.values(providerStatus).filter(p => p.status === 'not_configured').length;

      res.json({
        providers: providerStatus,
        summary: {
          total: Object.keys(providerStatus).length,
          working: workingCount,
          limited: limitedCount,
          error: errorCount,
          notConfigured: notConfiguredCount,
        },
        recommendations: [
          ...(notConfiguredCount > 0 ? ['Configure missing providers for full functionality'] : []),
          ...(limitedCount > 0 ? ['Check quota/credits for limited providers'] : []),
          ...(workingCount === Object.keys(providerStatus).length ? ['All providers operational'] : []),
        ],
      });
    } catch (error: any) {
      console.error("[Providers] Status check error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Provider Health Monitoring - ML Self-Healing System
  app.get("/api/providers/health", async (req, res) => {
    try {
      const { healthMonitor } = await import("../01-content-factory/services/provider-health-monitor");
      
      const allStatus = await healthMonitor.getAllProviderStatus();
      const healingActions = await healthMonitor.getRecentHealingActions(10);
      
      const byType: Record<string, typeof allStatus> = {};
      for (const provider of allStatus) {
        if (!byType[provider.serviceType]) {
          byType[provider.serviceType] = [];
        }
        byType[provider.serviceType].push(provider);
      }
      
      const healthyCount = allStatus.filter(p => p.isHealthy).length;
      const unhealthyCount = allStatus.filter(p => !p.isHealthy).length;
      const rateLimitedCount = allStatus.filter(p => p.rateLimitActive).length;
      const freeProviderCount = allStatus.filter(p => p.isFreeProvider && p.isHealthy).length;
      
      res.json({
        providers: allStatus,
        byServiceType: byType,
        summary: {
          total: allStatus.length,
          healthy: healthyCount,
          unhealthy: unhealthyCount,
          rateLimited: rateLimitedCount,
          freeProvidersAvailable: freeProviderCount,
          avgHealthScore: allStatus.reduce((acc, p) => acc + p.healthScore, 0) / allStatus.length,
        },
        recentHealingActions: healingActions,
        selfHealingStatus: {
          isActive: true,
          lastCheck: new Date().toISOString(),
          freeProvidersFallback: freeProviderCount > 0,
        },
      });
    } catch (error: any) {
      console.error("[ProviderHealth] Error fetching health status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get smart provider order for a service type
  app.get("/api/providers/smart-order/:serviceType", async (req, res) => {
    try {
      const { healthMonitor } = await import("../01-content-factory/services/provider-health-monitor");
      const { serviceType } = req.params;
      const { freeOnly, duration } = req.query;
      
      const order = await healthMonitor.getSmartProviderOrder(serviceType, {
        freeOnly: freeOnly === 'true',
        requestParams: duration ? { duration: parseInt(duration as string) } : undefined,
      });
      
      res.json({
        serviceType,
        providers: order,
        options: {
          freeOnly: freeOnly === 'true',
          duration: duration ? parseInt(duration as string) : undefined,
        },
      });
    } catch (error: any) {
      console.error("[ProviderHealth] Error getting smart order:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Initialize provider metrics
  app.post("/api/providers/initialize", async (req, res) => {
    try {
      const { healthMonitor } = await import("../01-content-factory/services/provider-health-monitor");
      
      await healthMonitor.initializeProviders();
      
      res.json({
        success: true,
        message: "Provider metrics initialized",
      });
    } catch (error: any) {
      console.error("[ProviderHealth] Error initializing providers:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reset rate limits
  app.post("/api/providers/reset-rate-limits", async (req, res) => {
    try {
      const { healthMonitor } = await import("../01-content-factory/services/provider-health-monitor");
      
      await healthMonitor.resetRateLimits();
      
      res.json({
        success: true,
        message: "Rate limits reset for all providers",
      });
    } catch (error: any) {
      console.error("[ProviderHealth] Error resetting rate limits:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get quarantine status for all providers
  app.get("/api/providers/quarantine", async (req, res) => {
    try {
      const { healthMonitor } = await import("../01-content-factory/services/provider-health-monitor");
      
      const quarantineStatus = healthMonitor.getQuarantineStatus();
      const allStatus = await healthMonitor.getAllProviderStatus();
      
      const quarantinedProviders = quarantineStatus.map(q => ({
        ...q,
        minutesRemaining: Math.max(0, Math.round((new Date(q.until).getTime() - Date.now()) / 60000)),
      }));
      
      res.json({
        quarantined: quarantinedProviders,
        activeProviders: allStatus.filter(p => p.isHealthy).map(p => p.providerName),
        summary: {
          quarantinedCount: quarantinedProviders.length,
          activeCount: allStatus.filter(p => p.isHealthy).length,
          totalProviders: allStatus.length,
        },
      });
    } catch (error: any) {
      console.error("[ProviderHealth] Error fetching quarantine status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Release a provider from quarantine manually
  app.post("/api/providers/quarantine/:providerName/release", async (req, res) => {
    try {
      const { healthMonitor } = await import("../01-content-factory/services/provider-health-monitor");
      const { providerName } = req.params;
      
      const released = await healthMonitor.releaseFromQuarantine(providerName);
      
      if (released) {
        res.json({
          success: true,
          message: `Provider ${providerName} released from quarantine`,
          provider: providerName,
        });
      } else {
        res.status(404).json({
          success: false,
          message: `Provider ${providerName} was not in quarantine`,
        });
      }
    } catch (error: any) {
      console.error("[ProviderHealth] Error releasing from quarantine:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear all quarantines (emergency reset)
  app.post("/api/providers/quarantine/clear-all", async (req, res) => {
    try {
      const { healthMonitor } = await import("../01-content-factory/services/provider-health-monitor");
      
      const currentQuarantine = healthMonitor.getQuarantineStatus();
      let releasedCount = 0;
      
      for (const q of currentQuarantine) {
        const released = await healthMonitor.releaseFromQuarantine(q.provider);
        if (released) releasedCount++;
      }
      
      res.json({
        success: true,
        message: `Released ${releasedCount} providers from quarantine`,
        releasedCount,
      });
    } catch (error: any) {
      console.error("[ProviderHealth] Error clearing quarantines:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Recalculate all provider priorities
  app.post("/api/providers/recalculate-priorities", async (req, res) => {
    try {
      const { healthMonitor } = await import("../01-content-factory/services/provider-health-monitor");
      
      await healthMonitor.recalculateAllPriorities();
      
      res.json({
        success: true,
        message: "Provider priorities recalculated",
      });
    } catch (error: any) {
      console.error("[ProviderHealth] Error recalculating priorities:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get recent healing actions
  app.get("/api/providers/healing-actions", async (req, res) => {
    try {
      const { healthMonitor } = await import("../01-content-factory/services/provider-health-monitor");
      const limit = parseInt(req.query.limit as string) || 20;
      const actions = await healthMonitor.getRecentHealingActions(limit);
      res.json(actions);
    } catch (error: any) {
      console.error("[ProviderHealth] Error getting healing actions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get smart order for all service types
  app.get("/api/providers/smart-order", async (req, res) => {
    try {
      const { healthMonitor, PROVIDER_CONFIG } = await import("../01-content-factory/services/provider-health-monitor");
      
      // Get unique service types from provider config
      const serviceTypes = Array.from(new Set(Object.values(PROVIDER_CONFIG).map(p => p.serviceType)));
      const orders: Record<string, string[]> = {};
      
      for (const type of serviceTypes) {
        try {
          orders[type] = await healthMonitor.getSmartProviderOrder(type);
        } catch {
          orders[type] = [];
        }
      }
      
      res.json(orders);
    } catch (error: any) {
      console.error("[ProviderHealth] Error getting smart orders:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear all content library items
  app.delete("/api/content/clear-all", async (req, res) => {
    try {
      console.log("[Clear] Clearing all content library items...");
      const result = await storage.clearAllGeneratedContent();
      res.json({ 
        success: true, 
        message: `Cleared all content library items`,
        deletedCount: result.deletedCount 
      });
    } catch (error: any) {
      console.error("[Clear] Error clearing content:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear all video projects
  app.delete("/api/video-projects/clear", async (req, res) => {
    try {
      console.log("[Clear] Clearing all video projects...");
      const result = await storage.clearAllVideoProjects();
      res.json({ 
        success: true, 
        message: `Cleared all video projects`,
        deletedCount: result.deletedCount 
      });
    } catch (error: any) {
      console.error("[Clear] Error clearing video projects:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear all approval queue items
  app.delete("/api/approvals/clear", async (req, res) => {
    try {
      console.log("[Clear] Clearing all approval queue items...");
      const result = await storage.clearAllApprovalQueue();
      res.json({ 
        success: true, 
        message: `Cleared all approval queue items`,
        deletedCount: result.deletedCount 
      });
    } catch (error: any) {
      console.error("[Clear] Error clearing approval queue:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Activity Logs - Get recent activity
  app.get("/api/activity-logs", async (req, res) => {
    try {
      const { runId, limit } = req.query;
      const logs = await storage.getActivityLogs({
        runId: runId as string | undefined,
        limit: limit ? parseInt(limit as string) : 50,
      });
      res.json(logs);
    } catch (error: any) {
      console.error("[Activity] Error fetching logs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Activity Logs - Get pipeline status with active runs
  app.get("/api/pipeline-status", async (req, res) => {
    try {
      const runs = await storage.getContentRuns();
      const activeRuns = runs.filter(r => r.status === 'running');
      const recentLogs = await storage.getRecentActivityLogs(20);
      
      res.json({
        isActive: activeRuns.length > 0,
        activeRuns: activeRuns.map(run => ({
          runId: run.runId,
          clientId: run.clientId,
          status: run.status,
          totalPieces: run.totalPieces,
          successfulPieces: run.successfulPieces,
          failedPieces: run.failedPieces,
          progress: run.totalPieces > 0 
            ? Math.round(((run.successfulPieces + run.failedPieces) / run.totalPieces) * 100)
            : 0,
          startedAt: run.startedAt,
        })),
        recentActivity: recentLogs,
      });
    } catch (error: any) {
      console.error("[Pipeline] Error fetching status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Clear activity logs
  app.delete("/api/activity-logs/clear", async (req, res) => {
    try {
      const { runId } = req.query;
      const result = await storage.clearActivityLogs(runId as string | undefined);
      res.json({ 
        success: true, 
        message: runId ? `Cleared logs for run ${runId}` : 'Cleared all activity logs',
        deletedCount: result.deletedCount 
      });
    } catch (error: any) {
      console.error("[Activity] Error clearing logs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== QUALITY METRICS & OPTIMIZATION ROUTES =====

  // Initialize quality system on startup
  app.post("/api/quality/initialize", async (req, res) => {
    try {
      await storage.initializeProviderQualityScores();
      await storage.initializeDefaultQualityTiers();
      res.json({ success: true, message: "Quality system initialized" });
    } catch (error: any) {
      console.error("[Quality] Initialization error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quality Reviews - Submit a new quality review
  app.post("/api/quality/reviews", async (req, res) => {
    try {
      const { 
        contentType, 
        contentId, 
        overallRating, 
        isAccepted,
        rejectionReason,
        visualQuality,
        audioQuality,
        brandAlignment,
        scriptCoherence,
        cinematicAppeal,
        qualityTags,
        reviewedBy,
        reviewerNotes,
        providerUsed,
        generationParams 
      } = req.body;

      if (!contentType || !contentId) {
        return res.status(400).json({ error: "contentType and contentId are required" });
      }

      const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const review = await storage.createQualityReview({
        reviewId,
        contentType,
        contentId,
        overallRating,
        isAccepted,
        rejectionReason,
        visualQuality,
        audioQuality,
        brandAlignment,
        scriptCoherence,
        cinematicAppeal,
        qualityTags,
        reviewedBy,
        reviewerNotes,
        providerUsed,
        generationParams: generationParams ? JSON.stringify(generationParams) : undefined,
      });

      // Update provider quality scores if provider is known
      if (providerUsed && isAccepted !== undefined) {
        try {
          const qualityScore = await storage.getProviderQualityScore(providerUsed, contentType === 'video_clip' ? 'video' : 'image');
          if (qualityScore) {
            const newTotalReviews = qualityScore.totalReviews + 1;
            const newTotalAccepted = isAccepted ? qualityScore.totalAccepted + 1 : qualityScore.totalAccepted;
            const newTotalRejected = !isAccepted ? qualityScore.totalRejected + 1 : qualityScore.totalRejected;
            const newAcceptanceRate = ((newTotalAccepted / newTotalReviews) * 100).toFixed(2);
            
            // Calculate new average rating
            const currentAvgRating = parseFloat(qualityScore.avgUserRating || "0");
            const newAvgRating = overallRating 
              ? ((currentAvgRating * qualityScore.totalReviews + overallRating) / newTotalReviews).toFixed(2)
              : qualityScore.avgUserRating;

            await storage.updateProviderQualityScore(providerUsed, contentType === 'video_clip' ? 'video' : 'image', {
              totalReviews: newTotalReviews,
              totalAccepted: newTotalAccepted,
              totalRejected: newTotalRejected,
              acceptanceRate: newAcceptanceRate,
              avgUserRating: newAvgRating,
            });
          }
        } catch (scoreError) {
          console.warn("[Quality] Could not update provider score:", scoreError);
        }
      }

      res.status(201).json(review);
    } catch (error: any) {
      console.error("[Quality] Review submission error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quality Reviews - Get reviews for specific content
  app.get("/api/quality/reviews/content/:contentType/:contentId", async (req, res) => {
    try {
      const { contentType, contentId } = req.params;
      const reviews = await storage.getQualityReviewsForContent(contentType, contentId);
      res.json(reviews);
    } catch (error: any) {
      console.error("[Quality] Error fetching reviews:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quality Reviews - Get recent reviews
  app.get("/api/quality/reviews", async (req, res) => {
    try {
      const { limit, provider } = req.query;
      if (provider && typeof provider === 'string') {
        const reviews = await storage.getQualityReviewsByProvider(provider, parseInt(limit as string) || 50);
        return res.json(reviews);
      }
      const reviews = await storage.getRecentQualityReviews(parseInt(limit as string) || 50);
      res.json(reviews);
    } catch (error: any) {
      console.error("[Quality] Error fetching reviews:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quality Metrics - Submit objective quality metrics
  app.post("/api/quality/metrics", async (req, res) => {
    try {
      const metricId = `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const metric = await storage.createQualityMetric({
        metricId,
        ...req.body,
      });
      res.status(201).json(metric);
    } catch (error: any) {
      console.error("[Quality] Metric submission error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quality Metrics - Get metrics for content
  app.get("/api/quality/metrics/content/:contentType/:contentId", async (req, res) => {
    try {
      const { contentType, contentId } = req.params;
      const metrics = await storage.getQualityMetricsForContent(contentType, contentId);
      res.json(metrics);
    } catch (error: any) {
      console.error("[Quality] Error fetching metrics:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Provider Quality Scores - Get all provider quality scores
  app.get("/api/quality/provider-scores", async (req, res) => {
    try {
      const scores = await storage.getAllProviderQualityScores();
      res.json(scores);
    } catch (error: any) {
      console.error("[Quality] Error fetching provider scores:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Provider Quality Scores - Get specific provider score
  app.get("/api/quality/provider-scores/:providerName/:serviceType", async (req, res) => {
    try {
      const { providerName, serviceType } = req.params;
      const score = await storage.getProviderQualityScore(providerName, serviceType);
      if (!score) {
        return res.status(404).json({ error: "Provider quality score not found" });
      }
      res.json(score);
    } catch (error: any) {
      console.error("[Quality] Error fetching provider score:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quality Tier Configs - Get all tier configurations
  app.get("/api/quality/tiers", async (req, res) => {
    try {
      const tiers = await storage.getAllQualityTierConfigs();
      res.json(tiers);
    } catch (error: any) {
      console.error("[Quality] Error fetching tiers:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quality Tier Configs - Get specific tier
  app.get("/api/quality/tiers/:tierName", async (req, res) => {
    try {
      const tier = await storage.getQualityTierConfig(req.params.tierName);
      if (!tier) {
        return res.status(404).json({ error: "Quality tier not found" });
      }
      res.json(tier);
    } catch (error: any) {
      console.error("[Quality] Error fetching tier:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quality Tier Configs - Update tier settings
  app.patch("/api/quality/tiers/:tierName", async (req, res) => {
    try {
      const tier = await storage.updateQualityTierConfig(req.params.tierName, req.body);
      res.json(tier);
    } catch (error: any) {
      console.error("[Quality] Error updating tier:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quality Feedback Loop - Get recent feedback actions
  app.get("/api/quality/feedback", async (req, res) => {
    try {
      const { limit, provider } = req.query;
      if (provider && typeof provider === 'string') {
        const feedback = await storage.getQualityFeedbackByProvider(provider, parseInt(limit as string) || 50);
        return res.json(feedback);
      }
      const feedback = await storage.getRecentQualityFeedback(parseInt(limit as string) || 50);
      res.json(feedback);
    } catch (error: any) {
      console.error("[Quality] Error fetching feedback:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Quick accept/reject endpoint for video projects
  app.post("/api/video-projects/:projectId/quality-review", async (req, res) => {
    try {
      const { projectId } = req.params;
      const { isAccepted, overallRating, rejectionReason, reviewedBy } = req.body;

      const project = await storage.getVideoProject(projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const review = await storage.createQualityReview({
        reviewId,
        contentType: 'video_project',
        contentId: projectId,
        overallRating,
        isAccepted,
        rejectionReason,
        reviewedBy: reviewedBy || 'user',
      });

      // Update project quality status
      await storage.updateVideoProject(projectId, {
        isQualityApproved: isAccepted,
        qualityReviewedAt: new Date(),
      });

      res.json({ 
        review, 
        message: isAccepted ? 'Project approved' : 'Project rejected',
        projectId,
      });
    } catch (error: any) {
      console.error("[Quality] Project review error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Comprehensive quality dashboard endpoint
  app.get("/api/quality/dashboard", async (req, res) => {
    try {
      const [
        providerScores,
        qualityTiers,
        recentReviews,
        recentFeedback
      ] = await Promise.all([
        storage.getAllProviderQualityScores(),
        storage.getAllQualityTierConfigs(),
        storage.getRecentQualityReviews(20),
        storage.getRecentQualityFeedback(20),
      ]);

      // Calculate summary statistics
      const totalReviews = recentReviews.length;
      const acceptedReviews = recentReviews.filter(r => r.isAccepted).length;
      const avgRating = recentReviews.filter(r => r.overallRating).reduce((sum, r) => sum + (r.overallRating || 0), 0) / (recentReviews.filter(r => r.overallRating).length || 1);

      res.json({
        summary: {
          totalReviews,
          acceptedReviews,
          rejectedReviews: totalReviews - acceptedReviews,
          acceptanceRate: totalReviews > 0 ? ((acceptedReviews / totalReviews) * 100).toFixed(1) : 100,
          averageRating: avgRating.toFixed(1),
        },
        providerScores,
        qualityTiers,
        recentReviews,
        recentFeedback,
      });
    } catch (error: any) {
      console.error("[Quality] Dashboard error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get quality-aware provider status (combines operational health + quality metrics)
  app.get("/api/quality/provider-status", async (req, res) => {
    try {
      const { healthMonitor } = await import("../01-content-factory/services/provider-health-monitor");
      const allStatus = await healthMonitor.getAllProviderQualityStatus();
      
      res.json({
        providers: allStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[Quality] Provider status error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get quality-aware routing order for a service type
  app.get("/api/quality/routing/:serviceType", async (req, res) => {
    try {
      const { serviceType } = req.params;
      const { tier = 'production', freeOnly, minQualityScore } = req.query;
      
      const { healthMonitor } = await import("../01-content-factory/services/provider-health-monitor");
      const providerOrder = await healthMonitor.getQualityAwareProviderOrder(serviceType, {
        qualityTier: tier as any,
        freeOnly: freeOnly === 'true',
        minQualityScore: minQualityScore ? parseFloat(minQualityScore as string) : undefined,
      });
      
      res.json({
        serviceType,
        tier,
        providerOrder,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error("[Quality] Routing error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update provider quality from review feedback
  app.post("/api/quality/provider-feedback", async (req, res) => {
    try {
      const { providerName, serviceType, isAccepted, rating } = req.body;
      
      if (!providerName || !serviceType || typeof isAccepted !== 'boolean') {
        return res.status(400).json({ error: "providerName, serviceType, and isAccepted are required" });
      }
      
      const { healthMonitor } = await import("../01-content-factory/services/provider-health-monitor");
      await healthMonitor.updateProviderQualityFromReview(
        providerName,
        serviceType,
        isAccepted,
        rating
      );
      
      res.json({
        success: true,
        message: `Quality score updated for ${providerName}`,
        providerName,
        serviceType,
        isAccepted,
        rating,
      });
    } catch (error: any) {
      console.error("[Quality] Provider feedback error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get recommended quality tier based on requirements
  app.post("/api/quality/recommend-tier", async (req, res) => {
    try {
      const { targetResolution, isPremiumClient, isHighVisibility, budget } = req.body;
      
      const { healthMonitor } = await import("../01-content-factory/services/provider-health-monitor");
      const recommendedTier = healthMonitor.getRecommendedTier({
        targetResolution,
        isPremiumClient,
        isHighVisibility,
        budget,
      });
      
      res.json({
        recommendedTier,
        factors: {
          targetResolution: targetResolution || 'not specified',
          isPremiumClient: isPremiumClient || false,
          isHighVisibility: isHighVisibility || false,
          budget: budget || 'not specified',
        },
      });
    } catch (error: any) {
      console.error("[Quality] Recommend tier error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== RUNWAY API ENDPOINTS ====================
  // Full Runway API integration with all available models

  // Get all available Runway models and pricing
  app.get("/api/runway/models", async (req, res) => {
    try {
      const { getRunwayModels, RUNWAY_PRICING } = await import("../01-content-factory/integrations/runway");
      const isConfigured = !!process.env.RUNWAY_API_KEY;
      
      res.json({
        configured: isConfigured,
        models: getRunwayModels(),
        pricing: RUNWAY_PRICING,
        documentation: 'https://docs.dev.runwayml.com/guides/models/',
      });
    } catch (error: any) {
      console.error("[Runway] Models error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate video with specific Runway model
  app.post("/api/runway/video/generate", async (req, res) => {
    try {
      const { prompt, model = 'gen4_turbo', duration = 5, aspectRatio = '16:9', imageUrl, imageBase64 } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "prompt is required" });
      }
      
      const { generateVideoWithRunway } = await import("../01-content-factory/integrations/runway");
      const result = await generateVideoWithRunway(prompt, {
        model,
        duration,
        aspectRatio,
        imageUrl,
        imageBase64,
      });
      
      res.json(result);
    } catch (error: any) {
      console.error("[Runway] Video generate error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Video-to-video with Gen-4 Aleph
  app.post("/api/runway/video/video-to-video", async (req, res) => {
    try {
      const { sourceVideoUrl, prompt, referenceImageUrl } = req.body;
      
      if (!sourceVideoUrl || !prompt) {
        return res.status(400).json({ error: "sourceVideoUrl and prompt are required" });
      }
      
      const { generateVideoToVideoWithRunway } = await import("../01-content-factory/integrations/runway");
      const result = await generateVideoToVideoWithRunway(sourceVideoUrl, prompt, { referenceImageUrl });
      
      res.json(result);
    } catch (error: any) {
      console.error("[Runway] Video-to-video error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upscale video
  app.post("/api/runway/video/upscale", async (req, res) => {
    try {
      const { videoUrl } = req.body;
      
      if (!videoUrl) {
        return res.status(400).json({ error: "videoUrl is required" });
      }
      
      const { upscaleVideoWithRunway } = await import("../01-content-factory/integrations/runway");
      const result = await upscaleVideoWithRunway(videoUrl);
      
      res.json(result);
    } catch (error: any) {
      console.error("[Runway] Upscale error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Character performance (Act Two)
  app.post("/api/runway/video/character-performance", async (req, res) => {
    try {
      const { referenceMediaUrl, driverVideoUrl, resolution = '720p' } = req.body;
      
      if (!referenceMediaUrl || !driverVideoUrl) {
        return res.status(400).json({ error: "referenceMediaUrl and driverVideoUrl are required" });
      }
      
      const { generateCharacterPerformance } = await import("../01-content-factory/integrations/runway");
      const result = await generateCharacterPerformance(referenceMediaUrl, driverVideoUrl, { resolution });
      
      res.json(result);
    } catch (error: any) {
      console.error("[Runway] Character performance error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate image with Runway
  app.post("/api/runway/image/generate", async (req, res) => {
    try {
      const { prompt, model = 'gen4_image_turbo', resolution = '720p', referenceImages } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "prompt is required" });
      }
      
      const { generateImageWithRunway } = await import("../01-content-factory/integrations/runway");
      const result = await generateImageWithRunway(prompt, { model, resolution, referenceImages });
      
      res.json(result);
    } catch (error: any) {
      console.error("[Runway] Image generate error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Text-to-speech with ElevenLabs via Runway
  app.post("/api/runway/audio/speech", async (req, res) => {
    try {
      const { text, voiceId, modelId } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "text is required" });
      }
      
      const { generateSpeechWithRunway } = await import("../01-content-factory/integrations/runway");
      const result = await generateSpeechWithRunway(text, { voiceId, modelId });
      
      res.json(result);
    } catch (error: any) {
      console.error("[Runway] Speech error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Generate sound effects
  app.post("/api/runway/audio/sound-effect", async (req, res) => {
    try {
      const { prompt, durationSeconds } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "prompt is required" });
      }
      
      const { generateSoundEffectWithRunway } = await import("../01-content-factory/integrations/runway");
      const result = await generateSoundEffectWithRunway(prompt, { durationSeconds });
      
      res.json(result);
    } catch (error: any) {
      console.error("[Runway] Sound effect error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Voice isolation
  app.post("/api/runway/audio/voice-isolation", async (req, res) => {
    try {
      const { audioUrl } = req.body;
      
      if (!audioUrl) {
        return res.status(400).json({ error: "audioUrl is required" });
      }
      
      const { isolateVoiceWithRunway } = await import("../01-content-factory/integrations/runway");
      const result = await isolateVoiceWithRunway(audioUrl);
      
      res.json(result);
    } catch (error: any) {
      console.error("[Runway] Voice isolation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Voice dubbing
  app.post("/api/runway/audio/dubbing", async (req, res) => {
    try {
      const { sourceAudioUrl, targetLanguage, numSpeakers = 1 } = req.body;
      
      if (!sourceAudioUrl || !targetLanguage) {
        return res.status(400).json({ error: "sourceAudioUrl and targetLanguage are required" });
      }
      
      const { dubVoiceWithRunway } = await import("../01-content-factory/integrations/runway");
      const result = await dubVoiceWithRunway(sourceAudioUrl, targetLanguage, { numSpeakers });
      
      res.json(result);
    } catch (error: any) {
      console.error("[Runway] Voice dubbing error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Speech-to-speech transformation
  app.post("/api/runway/audio/speech-to-speech", async (req, res) => {
    try {
      const { audioUrl, targetVoiceId } = req.body;
      
      if (!audioUrl || !targetVoiceId) {
        return res.status(400).json({ error: "audioUrl and targetVoiceId are required" });
      }
      
      const { transformSpeechWithRunway } = await import("../01-content-factory/integrations/runway");
      const result = await transformSpeechWithRunway(audioUrl, targetVoiceId);
      
      res.json(result);
    } catch (error: any) {
      console.error("[Runway] Speech-to-speech error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Check task status (works for video, image, and audio tasks)
  app.get("/api/runway/tasks/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const { type = 'video' } = req.query;
      
      const { checkVideoStatus, checkImageStatus, checkAudioStatus } = await import("../01-content-factory/integrations/runway");
      
      let result;
      if (type === 'image') {
        result = await checkImageStatus(taskId);
      } else if (type === 'audio') {
        result = await checkAudioStatus(taskId);
      } else {
        result = await checkVideoStatus(taskId);
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("[Runway] Task status error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Wait for task completion with polling
  app.post("/api/runway/tasks/:taskId/wait", async (req, res) => {
    try {
      const { taskId } = req.params;
      const { maxWaitSeconds = 120, pollIntervalSeconds = 5 } = req.body;
      
      const { waitForVideoCompletion } = await import("../01-content-factory/integrations/runway");
      const result = await waitForVideoCompletion(taskId, maxWaitSeconds, pollIntervalSeconds);
      
      res.json(result);
    } catch (error: any) {
      console.error("[Runway] Task wait error:", error);
      res.status(500).json({ error: error.message });
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
    const { generateVoiceoverWithHostedUrl } = await import("../01-content-factory/integrations/elevenlabs");
    
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
            // Video completion failed - try static image fallback
            console.log(`[IngredientsToVideo] Video completion failed for scene ${scene.sceneNumber}, trying static image fallback...`);
            if (imageUrl) {
              // Mark as ready with static image - Shotstack can use images as clips
              await storage.updateVideoClip(clipId, {
                status: 'ready',
                videoUrl: imageUrl, // Shotstack supports image URLs as clip sources
                provider: 'static_image_fallback',
                errorMessage: `Static image fallback (original error: ${completed.error})`,
              });
              await storage.updateVideoScene(scene.sceneId, { 
                status: 'ready',
              });
              console.log(`[IngredientsToVideo] Scene ${scene.sceneNumber} using static image fallback - Shotstack will render as image clip`);
            } else {
              await storage.updateVideoClip(clipId, {
                status: 'failed',
                errorMessage: completed.error,
              });
              await storage.updateVideoScene(scene.sceneId, { status: 'failed' });
            }
          }
        } else {
          // Video generation failed - try static image fallback
          console.log(`[IngredientsToVideo] Video generation failed for scene ${scene.sceneNumber}: ${videoResult.error}`);
          if (imageUrl) {
            // Mark as ready with static image - Shotstack can use images as clips
            // Store as videoUrl with isStaticImage flag in metadata for assembly
            await storage.updateVideoClip(clipId, {
              status: 'ready',
              videoUrl: imageUrl, // Shotstack supports image URLs as clip sources
              provider: 'static_image_fallback',
              errorMessage: `Static image fallback (original error: ${videoResult.error})`,
            });
            await storage.updateVideoScene(scene.sceneId, { 
              status: 'ready',
            });
            console.log(`[IngredientsToVideo] Scene ${scene.sceneNumber} using static image fallback - Shotstack will render as image clip`);
          } else {
            await storage.updateVideoClip(clipId, {
              status: 'failed',
              errorMessage: videoResult.error,
            });
            await storage.updateVideoScene(scene.sceneId, { status: 'failed' });
          }
        }

        // Generate voiceover if scene has text (with ElevenLabs/OpenAI TTS fallback)
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

          const audioResult = await generateVoiceoverWithHostedUrl(scene.voiceoverText, {
            voiceStyle: ingredients.voiceStyle || 'professional_male',
            sceneId: scene.sceneId,
          });

          if (audioResult.success && audioResult.audioUrl) {
            await storage.updateAudioTrack(trackId, {
              audioUrl: audioResult.audioUrl,
              duration: audioResult.duration,
              status: 'ready',
              provider: audioResult.provider || 'elevenlabs',
            });
            console.log(`[IngredientsToVideo] Scene ${scene.sceneNumber} audio ready (via ${audioResult.provider})`);
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
