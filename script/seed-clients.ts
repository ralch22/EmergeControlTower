import { db } from "../server/db";
import { clients } from "@shared/schema";

async function seedClients() {
  console.log("Seeding clients...");

  await db.insert(clients).values([
    {
      name: "Nexus Corp",
      industry: "Enterprise SaaS",
      brandVoice: "Professional, innovative, results-driven. We speak to CTOs and tech leaders who need scalable solutions.",
      targetAudience: "CTOs, VPs of Engineering, and technical decision-makers at companies with 500+ employees",
      keywords: "enterprise software, digital transformation, cloud infrastructure, API integration, scalability",
      contentGoals: "Generate qualified leads, establish thought leadership, drive demo requests",
      isActive: true,
    },
    {
      name: "Stellar Dynamics",
      industry: "FinTech",
      brandVoice: "Trustworthy, modern, secure. We help financial institutions embrace the future while maintaining compliance.",
      targetAudience: "CFOs, Finance Directors, and compliance officers at mid-size financial companies",
      keywords: "fintech, payment processing, fraud prevention, regulatory compliance, digital banking",
      contentGoals: "Build trust, educate on compliance, drive free trial signups",
      isActive: true,
    },
    {
      name: "HyperLoop One",
      industry: "E-commerce",
      brandVoice: "Bold, customer-obsessed, data-driven. We help brands scale their online presence with AI-powered insights.",
      targetAudience: "E-commerce managers, DTC brand founders, and marketing directors",
      keywords: "e-commerce optimization, conversion rate, customer analytics, personalization, AI recommendations",
      contentGoals: "Drive platform signups, increase engagement, showcase case studies",
      isActive: true,
    },
    {
      name: "Quantum Leap",
      industry: "AI/ML Services",
      brandVoice: "Cutting-edge, accessible, transformative. We make enterprise AI achievable for growing companies.",
      targetAudience: "Startup founders, product managers, and innovation leads exploring AI integration",
      keywords: "machine learning, AI implementation, predictive analytics, automation, custom AI models",
      contentGoals: "Book strategy calls, demonstrate expertise, build community",
      isActive: true,
    },
    {
      name: "Oasis Systems",
      industry: "Healthcare Tech",
      brandVoice: "Compassionate, secure, compliant. We put patient outcomes first while enabling healthcare innovation.",
      targetAudience: "Healthcare administrators, clinic owners, and health IT directors",
      keywords: "HIPAA compliance, patient portal, telehealth, EHR integration, healthcare automation",
      contentGoals: "Drive demo requests, build credibility, educate on compliance benefits",
      isActive: true,
    },
  ]);

  console.log("✓ Seeded 5 clients");
  console.log("\n✅ Client seeding completed!");
  process.exit(0);
}

seedClients().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
