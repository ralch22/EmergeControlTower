import { 
  type Kpi, 
  type InsertKpi, 
  type Pod, 
  type InsertPod,
  type PhaseChange,
  type InsertPhaseChange,
  type ApprovalQueue,
  type InsertApprovalQueue,
  type Alert,
  type InsertAlert,
  type Client,
  type InsertClient,
  type ContentRun,
  type InsertContentRun,
  type GeneratedContentRecord,
  type InsertGeneratedContent,
  kpis,
  pods,
  phaseChanges,
  approvalQueue,
  alerts,
  clients,
  contentRuns,
  generatedContent
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // KPIs
  getLatestKpi(): Promise<Kpi | undefined>;
  updateKpi(kpi: InsertKpi): Promise<Kpi>;
  incrementAiOutput(count: number): Promise<Kpi>;
  
  // Pods
  getActivePods(): Promise<Pod[]>;
  getPod(id: number): Promise<Pod | undefined>;
  createPod(pod: InsertPod): Promise<Pod>;
  updatePod(id: number, pod: Partial<InsertPod>): Promise<Pod>;
  
  // Phase Changes
  getUpcomingPhaseChanges(): Promise<PhaseChange[]>;
  createPhaseChange(phaseChange: InsertPhaseChange): Promise<PhaseChange>;
  
  // Approval Queue
  getPendingApprovals(): Promise<ApprovalQueue[]>;
  getApprovalItem(id: number): Promise<ApprovalQueue | undefined>;
  createApprovalItem(item: InsertApprovalQueue): Promise<ApprovalQueue>;
  updateApprovalStatus(id: number, status: string): Promise<ApprovalQueue>;
  
  // Alerts
  getActiveAlerts(): Promise<Alert[]>;
  createAlert(alert: InsertAlert): Promise<Alert>;
  resolveAlert(id: number): Promise<Alert>;

  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: number): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;

  // Content Runs
  getContentRuns(): Promise<ContentRun[]>;
  getContentRun(runId: string): Promise<ContentRun | undefined>;
  createContentRun(run: InsertContentRun): Promise<ContentRun>;
  updateContentRun(runId: string, updates: Partial<InsertContentRun>): Promise<ContentRun>;

  // Generated Content
  getGeneratedContent(runId: string): Promise<GeneratedContentRecord[]>;
  createGeneratedContent(content: InsertGeneratedContent): Promise<GeneratedContentRecord>;
}

export class DatabaseStorage implements IStorage {
  // KPIs
  async getLatestKpi(): Promise<Kpi | undefined> {
    const [kpi] = await db.select().from(kpis).orderBy(desc(kpis.updatedAt)).limit(1);
    return kpi || undefined;
  }

  async updateKpi(insertKpi: InsertKpi): Promise<Kpi> {
    const [kpi] = await db.insert(kpis).values(insertKpi).returning();
    return kpi;
  }

  // Pods
  async getActivePods(): Promise<Pod[]> {
    return await db.select().from(pods).where(eq(pods.isActive, true));
  }

  async getPod(id: number): Promise<Pod | undefined> {
    const [pod] = await db.select().from(pods).where(eq(pods.id, id));
    return pod || undefined;
  }

  async createPod(insertPod: InsertPod): Promise<Pod> {
    const [pod] = await db.insert(pods).values(insertPod).returning();
    return pod;
  }

  async updatePod(id: number, updateData: Partial<InsertPod>): Promise<Pod> {
    const [pod] = await db.update(pods).set(updateData).where(eq(pods.id, id)).returning();
    return pod;
  }

  // Phase Changes
  async getUpcomingPhaseChanges(): Promise<PhaseChange[]> {
    const now = new Date();
    return await db
      .select()
      .from(phaseChanges)
      .where(and(eq(phaseChanges.isCompleted, false)))
      .orderBy(phaseChanges.changeDate);
  }

  async createPhaseChange(insertPhaseChange: InsertPhaseChange): Promise<PhaseChange> {
    const [phaseChange] = await db.insert(phaseChanges).values(insertPhaseChange).returning();
    return phaseChange;
  }

  // Approval Queue
  async getPendingApprovals(): Promise<ApprovalQueue[]> {
    return await db
      .select()
      .from(approvalQueue)
      .where(eq(approvalQueue.status, "pending"))
      .orderBy(desc(approvalQueue.createdAt));
  }

  async getApprovalItem(id: number): Promise<ApprovalQueue | undefined> {
    const [item] = await db.select().from(approvalQueue).where(eq(approvalQueue.id, id));
    return item || undefined;
  }

  async createApprovalItem(insertItem: InsertApprovalQueue): Promise<ApprovalQueue> {
    const [item] = await db.insert(approvalQueue).values(insertItem).returning();
    return item;
  }

  async updateApprovalStatus(id: number, status: string): Promise<ApprovalQueue> {
    const [item] = await db
      .update(approvalQueue)
      .set({ status, processedAt: new Date() })
      .where(eq(approvalQueue.id, id))
      .returning();
    return item;
  }

  // Alerts
  async getActiveAlerts(): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.isResolved, false))
      .orderBy(desc(alerts.createdAt));
  }

  async createAlert(insertAlert: InsertAlert): Promise<Alert> {
    const [alert] = await db.insert(alerts).values(insertAlert).returning();
    return alert;
  }

  async resolveAlert(id: number): Promise<Alert> {
    const [alert] = await db
      .update(alerts)
      .set({ isResolved: true })
      .where(eq(alerts.id, id))
      .returning();
    return alert;
  }

  async incrementAiOutput(count: number): Promise<Kpi> {
    const latestKpi = await this.getLatestKpi();
    if (!latestKpi) {
      throw new Error("No KPI record found");
    }
    
    const [kpi] = await db
      .update(kpis)
      .set({ 
        aiOutputToday: latestKpi.aiOutputToday + count,
        updatedAt: new Date()
      })
      .where(eq(kpis.id, latestKpi.id))
      .returning();
    return kpi;
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.isActive, true));
  }

  async getClient(id: number): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(insertClient).returning();
    return client;
  }

  // Content Runs
  async getContentRuns(): Promise<ContentRun[]> {
    return await db.select().from(contentRuns).orderBy(desc(contentRuns.startedAt));
  }

  async getContentRun(runId: string): Promise<ContentRun | undefined> {
    const [run] = await db.select().from(contentRuns).where(eq(contentRuns.runId, runId));
    return run || undefined;
  }

  async createContentRun(insertRun: InsertContentRun): Promise<ContentRun> {
    const [run] = await db.insert(contentRuns).values(insertRun).returning();
    return run;
  }

  async updateContentRun(runId: string, updates: Partial<InsertContentRun>): Promise<ContentRun> {
    const [run] = await db
      .update(contentRuns)
      .set(updates)
      .where(eq(contentRuns.runId, runId))
      .returning();
    return run;
  }

  // Generated Content
  async getGeneratedContent(runId: string): Promise<GeneratedContentRecord[]> {
    return await db
      .select()
      .from(generatedContent)
      .where(eq(generatedContent.runId, runId))
      .orderBy(desc(generatedContent.createdAt));
  }

  async createGeneratedContent(insertContent: InsertGeneratedContent): Promise<GeneratedContentRecord> {
    const [content] = await db.insert(generatedContent).values(insertContent).returning();
    return content;
  }
}

export const storage = new DatabaseStorage();
