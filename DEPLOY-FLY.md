# Deploying EmergeControlTower to Fly.io

Fallback compute layer for ECT, pre-staged in case we pivot off Cloudflare
Containers (silent boot failures we can't debug via `wrangler tail`).

All Cloudflare-side resources (R2 bucket, Hyperdrive, Worker proxy) stay
in place — Fly only replaces the Container compute. The Worker at
`workers/proxy.ts` would `fetch('https://ect-emerge.fly.dev', ...)`
instead of dispatching to the `EctContainer` Durable Object.

---

## 1. Install flyctl

Not currently installed on this Mac. Pick one:

```bash
# Homebrew (preferred — easy upgrades)
brew install flyctl

# Or official curl installer (writes to ~/.fly/bin)
curl -L https://fly.io/install.sh | sh
export FLYCTL_INSTALL="$HOME/.fly"
export PATH="$FLYCTL_INSTALL/bin:$PATH"
```

Verify: `flyctl version`

## 2. Authenticate

```bash
flyctl auth login          # opens browser → fly.io sign in / sign up
flyctl auth whoami         # confirm email
```

If creating a fresh account, Fly requires a credit card before any
machine boots (free tier covers shared-cpu-1x; we use shared-cpu-2x so
expect ~US$5–10/mo for a single always-on VM).

## 3. Create the app (no deploy yet)

`fly.toml` is already committed at repo root. To register the app on
Fly's side without building or shipping:

```bash
cd ~/Documents/EmergeControlTower
flyctl launch --no-deploy --copy-config --name ect-emerge --region iad
```

`--copy-config` tells launch to use our existing `fly.toml` instead of
generating a new one. Answer **No** to Postgres (we use Neon via
Hyperdrive) and **No** to Upstash Redis.

## 4. Set secrets (match wrangler secret names exactly)

Secrets are set on the Fly side, not in `fly.toml`. Batch them in one
call so they only restart the app once:

```bash
flyctl secrets set \
  DATABASE_URL="postgres://<neon-direct-conn-string>" \
  R2_ACCESS_KEY_ID="…" \
  R2_SECRET_ACCESS_KEY="…" \
  GEMINI_API_KEY="…" \
  ANTHROPIC_API_KEY="…" \
  AI_INTEGRATIONS_GEMINI_API_KEY="…" \
  ELEVENLABS_API_KEY="…" \
  RUNWAY_API_KEY="…" \
  PIKA_API_KEY="…" \
  FLUX_API_KEY="…" \
  REPLICATE_API_KEY="…" \
  MIDJOURNEY_API_KEY="…" \
  FAL_API_KEY="…" \
  SLACK_WEBHOOK_URL="…" \
  BUFFER_ACCESS_TOKEN="…" \
  GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' \
  --app ect-emerge
```

Pull the current values from wrangler so they match production:

```bash
wrangler secret list   # names only
# For each, copy the value from 1Password / source-of-truth — wrangler
# does NOT print secret values back out.
```

**DATABASE_URL note:** Hyperdrive only works inside a CF Worker. On Fly,
point `DATABASE_URL` directly at Neon's pooled connection string
(`-pooler.us-east-1.aws.neon.tech`) so we still get connection pooling.

## 5. Deploy

```bash
flyctl deploy --app ect-emerge
```

Fly's remote builder pulls the Dockerfile, builds for amd64, pushes to
Fly's registry, and rolls one machine in `iad`. First build is ~5–8 min
(no cache); subsequent deploys ~1–2 min.

## 6. Verify

```bash
flyctl status --app ect-emerge
flyctl logs --app ect-emerge          # live tail — THIS is the reason we pivoted
flyctl ssh console --app ect-emerge   # shell into the VM (debug boot chain)
curl https://ect-emerge.fly.dev/healthz
```

## 7. Cut Worker traffic over (only when ready)

Edit `workers/proxy.ts` to `fetch('https://ect-emerge.fly.dev' + url.pathname, ...)`
instead of `env.ECT.get(id).fetch(...)`. Keep the Container binding in
`wrangler.jsonc` until the Fly path is proven — easy rollback.

## Rollback

```bash
flyctl deploy --image registry.fly.io/ect-emerge:<previous-tag>
# or scale to zero to stop billing
flyctl scale count 0 --app ect-emerge
```
