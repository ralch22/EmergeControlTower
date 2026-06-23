/**
 * Database client.
 *
 * Uses the plain `pg` driver (not @neondatabase/serverless) so the same
 * connection string can target either Neon directly OR Cloudflare
 * Hyperdrive — which proxies via plain Postgres TCP, not Neon's
 * WebSocket protocol. @neondatabase/serverless would handshake with
 * Hyperdrive over a non-existent WS endpoint and silently hang.
 *
 * For local dev pointing straight at Neon: DATABASE_URL is the public
 * Neon connection string and pg connects over TLS-TCP directly.
 * For Cloudflare Container deploys: workers/proxy.ts forwards
 * env.HYPERDRIVE.connectionString as DATABASE_URL, and pg connects to
 * Hyperdrive's edge proxy (pooled, low-latency).
 */
import pkg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Hyperdrive handles pooling itself; cap pg's pool small so we don't
  // double-pool. For direct Neon, 10 connections is the default sweet
  // spot (Neon's compute scales per request).
  max: 10,
});

export const db = drizzle(pool, { schema });
