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
  ELEVENLABS_MAX_CONCURRENT: string;

  // Secrets (wrangler secret put …)
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  GEMINI_API_KEY?: string;
  AI_INTEGRATIONS_GEMINI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  AI_INTEGRATIONS_ANTHROPIC_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  RUNWAY_API_KEY?: string;
  PIKA_API_KEY?: string;
  FLUX_API_KEY?: string;
  REPLICATE_API_KEY?: string;
  FAL_API_KEY?: string;
  SLACK_WEBHOOK_URL?: string;
  BUFFER_ACCESS_TOKEN?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  GOOGLE_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  SHOTSTACK_API_KEY?: string;
  DASHSCOPE_API_KEY?: string;
  SESSION_SECRET?: string;

  // Direct Neon Postgres URL — forwarded as DATABASE_URL to the Container.
  // Hyperdrive's connectionString is a Worker-only address (intercepted by
  // the Worker runtime); Containers live in a separate network namespace
  // and can't reach it. Keep HYPERDRIVE binding for future Worker-side
  // direct DB calls but pass the upstream URL through to the Container.
  NEON_DATABASE_URL?: string;

  // Cloudflare Access defence-in-depth. When BOTH are set, the Worker
  // verifies the Cf-Access-Jwt-Assertion header before forwarding to the
  // Container — so even if the Access policy is removed/misconfigured at
  // the edge, the app stays gated. Until they're set (the Access app's AUD
  // tag is created in the Zero Trust dashboard), verification is skipped
  // and CF Access at the edge remains the sole gate.
  //   ACCESS_TEAM_DOMAIN e.g. "highpointtreescom.cloudflareaccess.com"
  //   ACCESS_AUD         the Application Audience tag from the Access app
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}

// In-memory JWKS cache (per isolate). CF Access rotates signing keys
// rarely; a short TTL keeps us correct without refetching every request.
let jwksCache: { keys: JsonWebKey[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000; // 1h

function b64urlToUint8(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJwtPart<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToUint8(part))) as T;
}

async function getJwks(teamDomain: string): Promise<JsonWebKey[]> {
  const now = Date.now();
  if (jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = (await res.json()) as { keys: JsonWebKey[] };
  jwksCache = { keys: body.keys ?? [], fetchedAt: now };
  return jwksCache.keys;
}

/**
 * Verify a Cloudflare Access JWT (RS256). Returns true iff the signature is
 * valid AND aud includes the configured AUD AND iss matches the team AND it
 * hasn't expired. Defence-in-depth only — CF Access is the primary gate.
 */
async function verifyAccessJwt(token: string, env: Env): Promise<boolean> {
  try {
    const [headerB64, payloadB64, sigB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !sigB64) return false;

    const header = decodeJwtPart<{ kid?: string; alg?: string }>(headerB64);
    if (header.alg !== "RS256" || !header.kid) return false;

    const jwks = await getJwks(env.ACCESS_TEAM_DOMAIN!);
    const jwk = jwks.find((k) => (k as { kid?: string }).kid === header.kid);
    if (!jwk) return false;

    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToUint8(sigB64),
      data,
    );
    if (!ok) return false;

    const payload = decodeJwtPart<{ aud?: string | string[]; iss?: string; exp?: number }>(payloadB64);
    const auds = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
    if (!auds.includes(env.ACCESS_AUD!)) return false;
    if (payload.iss !== `https://${env.ACCESS_TEAM_DOMAIN}`) return false;
    if (!payload.exp || payload.exp * 1000 < Date.now()) return false;

    return true;
  } catch {
    return false;
  }
}

export class EctContainer extends Container<Env> {
  // Express listens on :5000 inside the container (see Dockerfile ENV PORT).
  defaultPort = 5000;

  // Stop the Container after 10 min of no traffic. CF Containers wakes it
  // on the next request (small cold-start). Tune up if cold-starts hurt UX.
  sleepAfter = "10m";

  // Override fetch() so envVars are resolved LAZILY at request time, not
  // at DO class-field init.
  //
  // The previous shape — `override envVars = { DATABASE_URL: this.env.HYPERDRIVE.connectionString, ... }` —
  // evaluates as a class-field initializer inside the DO constructor.
  // Touching `this.env.HYPERDRIVE` at that point can throw if any binding
  // isn't fully ready, which crashes the constructor before the SDK's
  // auto-start ever reaches Cloudchamber's scheduler. Result: CF logs zero
  // events ever, and every Worker request returns the SDK's generic
  // "Failed to start container, consider calling start()" — what we saw
  // for two hours on 2026-06-23 (CF API: active=0, scheduling=0, events=[]).
  //
  // The fix is the SDK-blessed pattern: pass envVars to startAndWaitForPorts
  // at the first request, where bindings are guaranteed live. Errors here
  // surface as real exceptions instead of the opaque SDK string.
  override async fetch(request: Request): Promise<Response> {
    const envVars: Record<string, string> = {
      // The Container talks to Neon DIRECTLY via NEON_DATABASE_URL.
      // Hyperdrive's `connectionString` is a Worker-only synthetic
      // address (intercepted by the Worker runtime). The Container
      // runs in a different network namespace and can't reach it,
      // so Express's `initializeDefaultControlEntities` would crash
      // on pool.query → container dies before port 5000 binds → CF
      // reports "Container crashed while checking for ports".
      // Keep env.HYPERDRIVE for future direct Worker-side queries.
      DATABASE_URL: this.env.NEON_DATABASE_URL ?? this.env.HYPERDRIVE.connectionString,
      APP_BASE_URL: this.env.APP_BASE_URL,
      R2_ACCOUNT_ID: this.env.R2_ACCOUNT_ID,
      R2_BUCKET: this.env.R2_BUCKET,
      R2_ACCESS_KEY_ID: this.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: this.env.R2_SECRET_ACCESS_KEY,
      ELEVENLABS_MAX_CONCURRENT: this.env.ELEVENLABS_MAX_CONCURRENT,
      GEMINI_API_KEY: this.env.GEMINI_API_KEY ?? "",
      AI_INTEGRATIONS_GEMINI_API_KEY: this.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? "",
      ANTHROPIC_API_KEY: this.env.ANTHROPIC_API_KEY ?? "",
      AI_INTEGRATIONS_ANTHROPIC_API_KEY: this.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY ?? "",
      ELEVENLABS_API_KEY: this.env.ELEVENLABS_API_KEY ?? "",
      RUNWAY_API_KEY: this.env.RUNWAY_API_KEY ?? "",
      PIKA_API_KEY: this.env.PIKA_API_KEY ?? "",
      FLUX_API_KEY: this.env.FLUX_API_KEY ?? "",
      REPLICATE_API_KEY: this.env.REPLICATE_API_KEY ?? "",
      FAL_API_KEY: this.env.FAL_API_KEY ?? "",
      SLACK_WEBHOOK_URL: this.env.SLACK_WEBHOOK_URL ?? "",
      BUFFER_ACCESS_TOKEN: this.env.BUFFER_ACCESS_TOKEN ?? "",
      GOOGLE_SERVICE_ACCOUNT_JSON: this.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "",
      GOOGLE_API_KEY: this.env.GOOGLE_API_KEY ?? "",
      OPENROUTER_API_KEY: this.env.OPENROUTER_API_KEY ?? "",
      SHOTSTACK_API_KEY: this.env.SHOTSTACK_API_KEY ?? "",
      DASHSCOPE_API_KEY: this.env.DASHSCOPE_API_KEY ?? "",
      SESSION_SECRET: this.env.SESSION_SECRET ?? "",
      NODE_ENV: "production",
    };

    await this.startAndWaitForPorts({
      ports: [5000],
      cancellationOptions: { instanceGetTimeoutMS: 30_000 },
      startOptions: { envVars },
    });

    return this.containerFetch(request);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Defence-in-depth: if Access JWT verification is configured, enforce it
    // before touching the Container. No-op until ACCESS_TEAM_DOMAIN + ACCESS_AUD
    // are set (the Access app's AUD is created in the Zero Trust dashboard).
    if (env.ACCESS_TEAM_DOMAIN && env.ACCESS_AUD) {
      const token = request.headers.get("Cf-Access-Jwt-Assertion");
      if (!token || !(await verifyAccessJwt(token, env))) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    // Single shared instance for v1 — no per-tenant sharding yet. When
    // we land multi-tenancy, key by tenant_id from req auth instead.
    const container = getContainer(env.ECT, "singleton");
    return container.fetch(request);
  },
} satisfies ExportedHandler<Env>;
