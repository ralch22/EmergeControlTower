# EmergeControlTower — Cloudflare Containers image.
#
# Single-runtime Node image. Express on PORT=5000.
#
# The Python LangGraph orchestrator that lived alongside Node was never
# invoked from production paths (audit 2026-06-23: dashboard-bridge was
# the only caller and exposed 3 routes that nobody hit). Removing it
# dropped ~600 MB from the image and eliminated the Python boot-time
# pressure that drove us to standard-2.
#
# Build with: docker build -t emerge-control-tower:dev .
# Or via wrangler: wrangler containers build (uses this Dockerfile + .dockerignore)

# syntax=docker/dockerfile:1.7

# Pin to linux/amd64 — Cloudflare Containers runs amd64 only, and we
# don't want a Mac-arm64 host to silently produce an arm64 image that
# would fail to schedule. BuildKit will use emulation on arm64 hosts.
ARG TARGETPLATFORM=linux/amd64

# ────────────────────────────────────────────────────────────────────────────
# Stage 1 — Node deps + build
# ────────────────────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:20-bookworm-slim AS node-builder

WORKDIR /app

# Build-time system deps for native modules (sharp). `python3` is needed
# only as node-gyp's build helper, not as a runtime — the runtime stage
# below drops it entirely.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      build-essential \
      python3 \
      pkg-config \
      libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Install npm deps first (layer cache: changes infrequently)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --include=optional

# Copy source + build (Vite client + esbuild server bundle → dist/)
COPY . .
RUN npm run build

# Prune devDependencies from node_modules so the runtime stage is smaller
RUN npm prune --omit=dev

# ────────────────────────────────────────────────────────────────────────────
# Stage 2 — Runtime (Node-only)
# ────────────────────────────────────────────────────────────────────────────
#
# Runtime system deps:
#   - libvips42 — sharp's native runtime (kept slim, no compilers)
#   - dumb-init — PID 1 so signals reach Node cleanly
FROM --platform=linux/amd64 node:20-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      libvips42 \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Pull in the Node build output + pruned node_modules
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/package.json ./package.json
COPY --from=node-builder /app/shared ./shared

ENV NODE_ENV=production \
    PORT=5000

# Entrypoint just execs Node — no background Python process anymore.
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/usr/local/bin/entrypoint.sh"]
