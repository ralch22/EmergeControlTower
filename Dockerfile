# EmergeControlTower — Cloudflare Containers image.
#
# Runs the full ECT stack in one image:
#   - Node 20 Express server (PORT=5000) — front-door HTTP, served by CF Containers
#   - Python 3.11 FastAPI orchestrator (PORT=8000) — local-only, called by Node
#
# Process model: entrypoint.sh launches Python in the background, then execs
# Node in the foreground. Node restarts on failure (CF Containers restarts the
# whole instance); Python crashes take the container down by design — we want
# CF's "instance died" signal in that case rather than a half-broken pod.
#
# Build with: docker build -t emerge-control-tower:dev .
# Or via wrangler: wrangler containers build (uses this Dockerfile + .dockerignore)

# syntax=docker/dockerfile:1.7

# ────────────────────────────────────────────────────────────────────────────
# Stage 1 — Node deps + build
# ────────────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS node-builder

WORKDIR /app

# Install build-time system deps for native modules (sharp, etc).
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
# Stage 2 — Python deps (uv)
# ────────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim-bookworm AS python-builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      build-essential \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./
# `uv sync --frozen --no-dev` is the modern lockfile-driven install path
# (replaces the older `uv pip sync uv.lock` which is fragile across uv
# versions). --frozen forbids resolution mismatches; --no-dev skips dev
# extras. pyproject.toml's [tool.uv] package=false stops uv from trying
# to build the project itself.
RUN uv venv /opt/venv \
    && VIRTUAL_ENV=/opt/venv uv sync --frozen --no-dev

# ────────────────────────────────────────────────────────────────────────────
# Stage 3 — Runtime
# ────────────────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

# Runtime system deps:
#   - python3 + libvips42 (sharp's native runtime) — kept slim, no compilers
#   - dumb-init — proper PID 1 so signals reach Node and Python cleanly
#
# Note: no ffmpeg here. ECT has no spawn/exec call sites for it; muxing
# is handled by Shotstack via HTTP. Adding ffmpeg back would pull ~250
# MB of codecs — re-add only when a real local-mux call site lands.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      python3 \
      libvips42 \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Pull in the Node build output + pruned node_modules
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/package.json ./package.json

# Pull in the Python venv + Python source (kept separate from the Node bundle)
COPY --from=python-builder /opt/venv /opt/venv
COPY --from=node-builder /app/01-content-factory ./01-content-factory
COPY --from=node-builder /app/shared ./shared
COPY --from=node-builder /app/pyproject.toml ./pyproject.toml

ENV NODE_ENV=production \
    PATH="/opt/venv/bin:${PATH}" \
    PORT=5000 \
    CONTENT_FACTORY_PORT=8000 \
    CONTENT_FACTORY_URL=http://localhost:8000 \
    PYTHONUNBUFFERED=1

# Entrypoint script — boots Python orchestrator in background, then Node fg.
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 5000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["/usr/local/bin/entrypoint.sh"]
