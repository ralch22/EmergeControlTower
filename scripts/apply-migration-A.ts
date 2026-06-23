/**
 * Migration A — add nullable clientId to 5 system tables.
 *
 * Part of the v2 multi-tenant scoping plan. This is the FIRST of three
 * migrations:
 *   A (here): ADD COLUMN client_id INTEGER REFERENCES clients(id) — nullable.
 *   B (Week 3): UPDATE <table> SET client_id = 1 WHERE client_id IS NULL.
 *   C (Week 3): ALTER COLUMN client_id SET NOT NULL + composite indexes.
 *
 * Safe to run multiple times: each ADD COLUMN uses `IF NOT EXISTS`.
 *
 * Usage:
 *   DATABASE_URL=$(cat ~/.cache/neon_db_url) npx tsx scripts/apply-migration-A.ts
 */
import pkg from "pg";
const { Pool } = pkg;

const TABLES = ["kpis", "pods", "phase_changes", "approval_queue", "alerts"] as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url, max: 2 });

  for (const table of TABLES) {
    const sql = `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id)`;
    console.log(`[migration-A] ${sql}`);
    await pool.query(sql);
  }

  console.log("[migration-A] verifying columns exist...");
  const { rows } = await pool.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
        AND column_name = 'client_id'
      ORDER BY table_name`,
    [TABLES as unknown as string[]],
  );
  for (const r of rows) console.log(`  ✓ ${r.table_name}.${r.column_name}`);

  if (rows.length !== TABLES.length) {
    console.error(`expected ${TABLES.length} client_id columns, got ${rows.length}`);
    await pool.end();
    process.exit(1);
  }

  await pool.end();
  console.log("[migration-A] done");
}

main().catch((e) => {
  console.error("[migration-A] FAILED:", e);
  process.exit(1);
});
