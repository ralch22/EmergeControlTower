/**
 * EmergeControlTower — Cloudflare Worker front-door.
 *
 * Every HTTP request hitting the Worker is proxied to a singleton
 * EctContainer instance. The Container runs the full ECT stack (Node
 * Express + Python FastAPI orchestrator); this Worker exists only to
 * own the Container lifecycle and forward traffic.
 *
 * The Container's DATABASE_URL is the Hyperdrive connection string
 * (env.HYPERDRIVE.connectionString) — Hyperdrive pools the upstream
 * Neon connection at the edge so the Container doesn't pay handshake
 * latency on every request.
 *
 * S3-compat R2 credentials (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)
 * are passed as Container env vars from Worker-side secrets. The
 * R2 binding (env.ASSETS_BUCKET) is declared in wrangler.jsonc for
 * future Worker-side direct-bucket access (not used in v1).
 */
import { Container, getContainer } from "@cloudflare/containers";

interface Env {
  ECT: DurableObjectNamespace<EctContainer>;
  HYPERDRIVE: Hyperdrive;
  ASSETS_BUCKET: R2Bucket;

  // Non-secret vars (wrangler.jsonc `vars`)
  APP_BASE_URL: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET: string;
  CONTENT_FACTORY_PORT: string;
  CONTENT_FACTORY_URL: string;
  ELEVENLABS_MAX_CONCURRENT: string;

  // Secrets (wrangler secret put …)
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  GEMINI_API_KEY?: string;
  AI_INTEGRATIONS_GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  RUNWAY_API_KEY?: string;
  PIKA_API_KEY?: string;
  FLUX_API_KEY?: string;
  REPLICATE_API_KEY?: string;
  FAL_API_KEY?: string;
  SLACK_WEBHOOK_URL?: string;
  BUFFER_ACCESS_TOKEN?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
}

export class EctContainer extends Container<Env> {
  // Express listens on :5000 inside the container (see Dockerfile ENV PORT).
  defaultPort = 5000;

  // Stop the Container after 10 min of no traffic. CF Containers wakes it
  // on the next request (small cold-start). Tune up if cold-starts hurt UX.
  sleepAfter = "10m";

  // Env vars forwarded to the container at startup. The Container app sees
  // these as `process.env.<KEY>`. Hyperdrive's connectionString is the key
  // unlock — it's how DATABASE_URL becomes "Neon via the CF edge pool".
  override envVars = {
    DATABASE_URL: this.env.HYPERDRIVE.connectionString,
    APP_BASE_URL: this.env.APP_BASE_URL,
    R2_ACCOUNT_ID: this.env.R2_ACCOUNT_ID,
    R2_BUCKET: this.env.R2_BUCKET,
    R2_ACCESS_KEY_ID: this.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: this.env.R2_SECRET_ACCESS_KEY,
    CONTENT_FACTORY_PORT: this.env.CONTENT_FACTORY_PORT,
    CONTENT_FACTORY_URL: this.env.CONTENT_FACTORY_URL,
    ELEVENLABS_MAX_CONCURRENT: this.env.ELEVENLABS_MAX_CONCURRENT,
    GEMINI_API_KEY: this.env.GEMINI_API_KEY ?? "",
    AI_INTEGRATIONS_GEMINI_API_KEY: this.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? "",
    ANTHROPIC_API_KEY: this.env.ANTHROPIC_API_KEY ?? "",
    ELEVENLABS_API_KEY: this.env.ELEVENLABS_API_KEY ?? "",
    RUNWAY_API_KEY: this.env.RUNWAY_API_KEY ?? "",
    PIKA_API_KEY: this.env.PIKA_API_KEY ?? "",
    FLUX_API_KEY: this.env.FLUX_API_KEY ?? "",
    REPLICATE_API_KEY: this.env.REPLICATE_API_KEY ?? "",
    FAL_API_KEY: this.env.FAL_API_KEY ?? "",
    SLACK_WEBHOOK_URL: this.env.SLACK_WEBHOOK_URL ?? "",
    BUFFER_ACCESS_TOKEN: this.env.BUFFER_ACCESS_TOKEN ?? "",
    GOOGLE_SERVICE_ACCOUNT_JSON: this.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "",
    NODE_ENV: "production",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Single shared instance for v1 — no per-tenant sharding yet. When
    // we land multi-tenancy, key by tenant_id from req auth instead.
    const container = getContainer(env.ECT, "singleton");
    return container.fetch(request);
  },
} satisfies ExportedHandler<Env>;
