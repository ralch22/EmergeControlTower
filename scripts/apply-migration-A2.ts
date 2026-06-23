/**
 * Migration A2 — Week 2 additive columns for Acc readiness.
 *
 *   clients.vertical          — drives archetype menu + compliance gate
 *   clients.delivery_email    — email-delivery fallback target
 *   generated_content.locale  — bilingual fan-out (default 'en')
 *
 * All additive + IF NOT EXISTS → idempotent, no data movement, no locks.
 *
 * Usage:
 *   DATABASE_URL=$(cat ~/.cache/neon_db_url) npx tsx scripts/apply-migration-A2.ts
 */
import pkg from "pg";
const { Pool } = pkg;

const STEPS: Array<{ table: string; column: string; ddl: string }> = [
  { table: "clients", column: "vertical", ddl: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS vertical TEXT` },
  { table: "clients", column: "delivery_email", ddl: `ALTER TABLE clients ADD COLUMN IF NOT EXISTS delivery_email TEXT` },
  { table: "generated_content", column: "locale", ddl: `ALTER TABLE generated_content ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en'` },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url, max: 2 });

  for (const step of STEPS) {
    console.log(`[migration-A2] ${step.ddl}`);
    await pool.query(step.ddl);
  }

  const { rows } = await pool.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND ((table_name = 'clients' AND column_name IN ('vertical','delivery_email'))
          OR (table_name = 'generated_content' AND column_name = 'locale'))
      ORDER BY table_name, column_name`,
  );
  for (const r of rows) console.log(`  ✓ ${r.table_name}.${r.column_name}`);

  if (rows.length !== STEPS.length) {
    console.error(`expected ${STEPS.length} columns, got ${rows.length}`);
    await pool.end();
    process.exit(1);
  }

  await pool.end();
  console.log("[migration-A2] done");
}

main().catch((e) => {
  console.error("[migration-A2] FAILED:", e);
  process.exit(1);
});
