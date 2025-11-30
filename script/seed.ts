import { db } from "../server/db";
import { kpis, pods, phaseChanges, approvalQueue, alerts } from "@shared/schema";

async function seed() {
  console.log("Starting database seeding...");

  // Seed KPIs
  await db.insert(kpis).values({
    mrr: "342500.00",
    mrrChange: "12.40",
    profitToday: "8420.00",
    aiOutputToday: 14203,
    activePods: 3,
    totalPods: 5,
  });
  console.log("✓ Seeded KPIs");

  // Seed Pods
  await db.insert(pods).values([
    {
      name: "Alpha Pod",
      vertical: "SaaS / B2B",
      mrr: "125000.00",
      health: 98,
      margin: 85,
      isActive: true,
    },
    {
      name: "Beta Pod",
      vertical: "E-com",
      mrr: "85000.00",
      health: 92,
      margin: 65,
      isActive: true,
    },
    {
      name: "Gamma Pod",
      vertical: "FinTech",
      mrr: "132500.00",
      health: 100,
      margin: 90,
      isActive: true,
    },
  ]);
  console.log("✓ Seeded Pods");

  // Seed Phase Changes
  const today = new Date();
  await db.insert(phaseChanges).values([
    {
      client: "Nexus Corp",
      oldPrice: "5000.00",
      newPrice: "12000.00",
      changeDate: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      isCompleted: false,
    },
    {
      client: "Vanguard AI",
      oldPrice: "8000.00",
      newPrice: "15000.00",
      changeDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
      isCompleted: false,
    },
    {
      client: "Oasis Systems",
      oldPrice: "4000.00",
      newPrice: "9000.00",
      changeDate: new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
      isCompleted: false,
    },
  ]);
  console.log("✓ Seeded Phase Changes");

  // Seed Approval Queue
  await db.insert(approvalQueue).values([
    {
      client: "Stellar Dynamics",
      type: "LinkedIn Carousel",
      author: "Sarah AI",
      thumbnail: "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=100&h=100&fit=crop",
      status: "pending",
    },
    {
      client: "HyperLoop One",
      type: "Blog Post",
      author: "Davinci Model",
      thumbnail: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=100&h=100&fit=crop",
      status: "pending",
    },
    {
      client: "Quantum Leap",
      type: "Email Sequence",
      author: "Claude 3.5",
      thumbnail: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=100&h=100&fit=crop",
      status: "pending",
    },
  ]);
  console.log("✓ Seeded Approval Queue");

  // Seed Alerts
  await db.insert(alerts).values([
    {
      title: "Over-hours Alert",
      description: "Delta Pod is at 115% capacity utilization.",
      severity: "critical",
      isResolved: false,
    },
    {
      title: "Negative ROAS",
      description: "Campaign #442 (Solaris) dropped below 1.2x.",
      severity: "critical",
      isResolved: false,
    },
    {
      title: "SLA Breach Risk",
      description: "Ticket #9928 open for 1h 55m.",
      severity: "critical",
      isResolved: false,
    },
  ]);
  console.log("✓ Seeded Alerts");

  console.log("\n✅ Database seeding completed successfully!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
