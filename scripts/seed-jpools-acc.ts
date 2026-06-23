/**
 * Seed two REAL tenants so the chassis has production clients (not just the
 * prototype's test rows):
 *   - J Pools (vertical: pools) — the v1 reference customer.
 *   - Acc Demo (vertical: real_estate) — proves the real-estate onboarding
 *     shape: bilingual EN+AR + RERA/DLD compliance footer.
 *
 * This script IS the "Acc onboarding playbook" in executable form: creating a
 * new real-estate client = copy the Acc block, swap names/permits/email, run.
 *
 * Idempotent: upserts by name (skips if a client with that name exists).
 *
 * Usage:
 *   DATABASE_URL=$(cat ~/.cache/neon_db_url) npx tsx scripts/seed-jpools-acc.ts
 */
import pkg from "pg";
import type { BrandProfileJSON } from "../shared/schema";
const { Pool } = pkg;

interface SeedClient {
  name: string;
  industry: string;
  brandVoice: string;
  targetAudience: string;
  keywords: string;
  contentGoals: string;
  vertical: string;
  deliveryEmail: string;
  websiteUrl: string;
  brandProfile: BrandProfileJSON;
}

const jpools: SeedClient = {
  name: "J Pools",
  industry: "Pool maintenance & renovation",
  brandVoice: "Calm expertise, crystal-clear standards — the Australian way",
  targetAudience: "Dubai villa & home owners with private pools",
  keywords: "pool maintenance, pool renovation, Dubai, crystal clear, the Australian way",
  contentGoals: "Educational how-to, before/after proof, build trust, drive enquiries",
  vertical: "pools",
  deliveryEmail: "rami@emergedigital.com",
  websiteUrl: "https://jpools.ae",
  brandProfile: {
    version: "1.0",
    textual: {
      outputLocales: ["en"],
      brandName: { primary: "J Pools" },
      tagline: { primary: "Crystal-clear pools, the Australian way" },
      brandStory: { short: "Australian-run pool care bringing meticulous standards to Dubai homes." },
      values: [
        { name: "Crystal-clear standards", description: "Every pool finished to a visible, verifiable standard." },
        { name: "Local trust", description: "Australian craftsmanship, Dubai presence." },
      ],
      personality: { archetype: "The Caregiver-Expert", traits: ["calm", "expert", "approachable", "meticulous"] },
      tone: { description: "warm expert, plain-spoken", formality: 5, energy: 6, technicality: 5, warmth: 8 },
      forbiddenWords: ["cheap", "guaranteed cheapest"],
      keywords: ["pool maintenance", "pool renovation", "Dubai", "crystal clear"],
      contentGoals: ["educate", "prove before/after", "drive enquiries"],
      examplePhrases: ["the Australian way", "crystal-clear standards"],
      callToActions: ["Book a pool health check", "Get a quote"],
      targetAudience: { demographics: "Dubai villa & home owners with private pools" },
    },
    visual: {
      visualStyle: { description: "Clean, bright, water-forward", aesthetic: ["fresh", "premium", "trustworthy"], moodKeywords: ["crystal", "azure", "sunlit"] },
      colorPalette: {
        darkMode: {
          background: { name: "Deep Navy", hex: "#042e56", usage: "backgrounds" },
          accent: { name: "Pool Cyan", hex: "#3fa7cc", usage: "accents, CTAs" },
          textPrimary: { name: "White", hex: "#ffffff", usage: "primary text" },
        },
      },
      typography: { fonts: [
        { family: "Sora", category: "sans-serif", weights: [600, 700], usage: "headings" },
        { family: "Inter", category: "sans-serif", weights: [400, 500], usage: "body" },
      ] },
      iconography: { style: "rounded line", colorApproach: "cyan on navy", sizeBase: 24 },
      cinematicGuidelines: { aspectRatio: "9:16", resolution: "1080p", duration: { short: 15, medium: 30, long: 60 }, pacing: "calm, confident", motionStyle: "smooth glides over water" },
      accessibility: { standard: "WCAG AA", minContrastRatio: 4.5, altTextRequired: true },
      usageRules: { dos: ["show real before/after"], donts: ["never white text on cyan"] },
    },
  },
};

const accDemo: SeedClient = {
  name: "Acc Demo (Real Estate)",
  industry: "Off-plan real estate development",
  brandVoice: "Aspirational, confident, data-grounded — claims always substantiated",
  targetAudience: "Dubai & KSA end-buyers and licensed brokers",
  keywords: "off-plan, Dubai property, investment, handover, payment plan",
  contentGoals: "Drive qualified enquiries, broker enablement, listing reach",
  vertical: "real_estate",
  deliveryEmail: "rami@emergedigital.com",
  websiteUrl: "https://emergedigital.com/acc",
  brandProfile: {
    version: "1.0",
    // The compliance block is what makes real-estate generation pass the gate.
    // Swap these permit numbers per real developer client.
    compliance: {
      rera: "RERA-00000 (demo)",
      dld: "DLD-00000 (demo)",
      brokerLicense: "BRN-00000 (demo)",
      mandatoryFooterEn: "Permit No: RERA-00000 · DLD Reg: DLD-00000 · Broker BRN-00000. Illustrative — confirm details with the developer.",
      mandatoryFooterAr: "رقم تصريح: RERA-00000 · تسجيل دائرة الأراضي: DLD-00000 · رخصة الوسيط: BRN-00000. لأغراض توضيحية.",
    },
    textual: {
      outputLocales: ["en", "ar"],
      arabicGuidelines: { dialect: "MSA", tone: "professional, aspirational" },
      brandName: { primary: "Acc Demo" },
      tagline: { primary: "Own the skyline" },
      brandStory: { short: "Off-plan developments across Dubai and KSA, marketed compliantly." },
      values: [{ name: "Substantiated claims", description: "Every price/yield claim carries its permit." }],
      personality: { archetype: "The Authority", traits: ["confident", "precise", "aspirational"] },
      tone: { description: "aspirational, data-grounded", formality: 7, energy: 6, technicality: 6, warmth: 5 },
      forbiddenWords: ["guaranteed returns"],
      keywords: ["off-plan", "Dubai property", "payment plan", "handover"],
      contentGoals: ["qualified enquiries", "broker enablement"],
      examplePhrases: ["limited release", "flexible payment plan"],
      callToActions: ["Register interest", "Book a viewing"],
      targetAudience: { demographics: "Dubai & KSA end-buyers and licensed brokers" },
    },
    visual: {
      visualStyle: { description: "Cinematic, premium architectural", aesthetic: ["luxury", "architectural", "golden-hour"], moodKeywords: ["skyline", "marble", "dusk"] },
      colorPalette: {
        darkMode: {
          background: { name: "Charcoal", hex: "#111114", usage: "backgrounds" },
          accent: { name: "Gold", hex: "#c9a24b", usage: "accents" },
          textPrimary: { name: "White", hex: "#ffffff", usage: "primary text" },
        },
      },
      typography: { fonts: [{ family: "Playfair Display", category: "serif", weights: [600], usage: "headings" }, { family: "Inter", category: "sans-serif", weights: [400], usage: "body" }] },
      iconography: { style: "thin line", colorApproach: "gold on charcoal", sizeBase: 24 },
      cinematicGuidelines: { aspectRatio: "9:16", resolution: "1080p", duration: { short: 15, medium: 30, long: 60 }, pacing: "cinematic reveal", motionStyle: "slow dolly, golden hour" },
      accessibility: { standard: "WCAG AA", minContrastRatio: 4.5, altTextRequired: true },
      usageRules: { dos: ["always show permit footer"], donts: ["never imply guaranteed returns"] },
    },
  },
};

async function upsert(pool: pkg.Pool, c: SeedClient) {
  const existing = await pool.query("SELECT id FROM clients WHERE name = $1", [c.name]);
  if (existing.rows.length) {
    const id = existing.rows[0].id;
    await pool.query(
      `UPDATE clients SET vertical=$2, delivery_email=$3, brand_profile=$4, website_url=$5 WHERE id=$1`,
      [id, c.vertical, c.deliveryEmail, c.brandProfile, c.websiteUrl],
    );
    console.log(`  ↻ updated ${c.name} (id=${id})`);
    return;
  }
  const { rows } = await pool.query(
    `INSERT INTO clients (name, industry, brand_voice, target_audience, keywords, content_goals, is_active, vertical, delivery_email, website_url, brand_profile)
     VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$9,$10) RETURNING id`,
    [c.name, c.industry, c.brandVoice, c.targetAudience, c.keywords, c.contentGoals, c.vertical, c.deliveryEmail, c.websiteUrl, c.brandProfile],
  );
  console.log(`  + created ${c.name} (id=${rows[0].id})`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) { console.error("DATABASE_URL required"); process.exit(1); }
  const pool = new Pool({ connectionString: url, max: 2 });
  console.log("[seed] upserting real tenants...");
  await upsert(pool, jpools);
  await upsert(pool, accDemo);
  await pool.end();
  console.log("[seed] done");
}

main().catch((e) => { console.error("[seed] FAILED:", e); process.exit(1); });
