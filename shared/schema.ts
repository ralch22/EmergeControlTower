import { pgTable, text, serial, integer, timestamp, boolean, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// KPI Metrics
export const kpis = pgTable("kpis", {
  id: serial("id").primaryKey(),
  mrr: decimal("mrr", { precision: 12, scale: 2 }).notNull(),
  mrrChange: decimal("mrr_change", { precision: 5, scale: 2 }).notNull(),
  profitToday: decimal("profit_today", { precision: 12, scale: 2 }).notNull(),
  aiOutputToday: integer("ai_output_today").notNull(),
  activePods: integer("active_pods").notNull(),
  totalPods: integer("total_pods").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertKpiSchema = createInsertSchema(kpis).omit({ id: true, updatedAt: true });
export type InsertKpi = z.infer<typeof insertKpiSchema>;
export type Kpi = typeof kpis.$inferSelect;

// Pods
export const pods = pgTable("pods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  vertical: text("vertical").notNull(),
  mrr: decimal("mrr", { precision: 12, scale: 2 }).notNull(),
  health: integer("health").notNull(),
  margin: integer("margin").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPodSchema = createInsertSchema(pods).omit({ id: true, createdAt: true });
export type InsertPod = z.infer<typeof insertPodSchema>;
export type Pod = typeof pods.$inferSelect;

// Phase Changes
export const phaseChanges = pgTable("phase_changes", {
  id: serial("id").primaryKey(),
  client: text("client").notNull(),
  oldPrice: decimal("old_price", { precision: 12, scale: 2 }).notNull(),
  newPrice: decimal("new_price", { precision: 12, scale: 2 }).notNull(),
  changeDate: timestamp("change_date").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPhaseChangeSchema = createInsertSchema(phaseChanges).omit({ id: true, createdAt: true });
export type InsertPhaseChange = z.infer<typeof insertPhaseChangeSchema>;
export type PhaseChange = typeof phaseChanges.$inferSelect;

// Approval Queue
export const approvalQueue = pgTable("approval_queue", {
  id: serial("id").primaryKey(),
  client: text("client").notNull(),
  type: text("type").notNull(),
  author: text("author").notNull(),
  thumbnail: text("thumbnail").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const insertApprovalQueueSchema = createInsertSchema(approvalQueue).omit({ id: true, createdAt: true, processedAt: true });
export type InsertApprovalQueue = z.infer<typeof insertApprovalQueueSchema>;
export type ApprovalQueue = typeof approvalQueue.$inferSelect;

// Alerts
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity").notNull().default("critical"),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, createdAt: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// Content Factory - Clients
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  brandVoice: text("brand_voice").notNull(),
  targetAudience: text("target_audience").notNull(),
  keywords: text("keywords").notNull(),
  contentGoals: text("content_goals").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true });
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// Content Factory - Runs
export const contentRuns = pgTable("content_runs", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull().unique(),
  clientId: integer("client_id").notNull(),
  status: text("status").notNull().default("pending"),
  totalPieces: integer("total_pieces").notNull().default(0),
  successfulPieces: integer("successful_pieces").notNull().default(0),
  failedPieces: integer("failed_pieces").notNull().default(0),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertContentRunSchema = createInsertSchema(contentRuns).omit({ id: true, startedAt: true });
export type InsertContentRun = z.infer<typeof insertContentRunSchema>;
export type ContentRun = typeof contentRuns.$inferSelect;

// Content Factory - Generated Content
export const generatedContent = pgTable("generated_content", {
  id: serial("id").primaryKey(),
  contentId: text("content_id").notNull().unique(),
  runId: text("run_id").notNull(),
  clientId: integer("client_id").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"),
  status: text("status").notNull().default("draft"),
  qaScore: integer("qa_score"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGeneratedContentSchema = createInsertSchema(generatedContent).omit({ id: true, createdAt: true });
export type InsertGeneratedContent = z.infer<typeof insertGeneratedContentSchema>;
export type GeneratedContentRecord = typeof generatedContent.$inferSelect;
