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

# Pin to linux/amd64 — Cloudflare Containers runs amd64 only, and we
# don't want a Mac-arm64 host to silently produce an arm64 image that
# would fail to schedule. BuildKit will use emulation on arm64 hosts.
ARG TARGETPLATFORM=linux/amd64

# ────────────────────────────────────────────────────────────────────────────
# Stage 1 — Node deps + build
# ────────────────────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:20-bookworm-slim AS node-builder

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
# Stage 2 — Runtime (Node + Python coexist, single image)
# ────────────────────────────────────────────────────────────────────────────
#
# We removed the separate python-builder stage: `uv venv` in a python:3.11
# image symlinks python to /usr/local/bin/python3, which doesn't exist in
# the node:20-bookworm-slim runtime base. Copying the venv across stages
# left dangling symlinks. Installing Python packages directly in the
# runtime stage avoids the cross-base-image symlink problem entirely.
#
# Runtime system deps:
#   - python3 + python3-pip — orchestrator runtime
#   - libvips42 — sharp's native runtime (kept slim, no compilers)
#   - dumb-init — PID 1 so signals reach Node and Python cleanly
#   - no ffmpeg: ECT has no spawn/exec call sites for it; Shotstack
#     handles muxing via HTTP
FROM --platform=linux/amd64 node:20-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      python3 \
      python3-pip \
      libvips42 \
      dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps system-wide (no venv — see header). PEP 668
# requires --break-system-packages on newer Debian; safe here because
# we own the whole container.
COPY --from=node-builder /app/pyproject.toml ./pyproject.toml
COPY --from=node-builder /app/uv.lock ./uv.lock
RUN pip install --break-system-packages --no-cache-dir uv \
    && uv export --frozen --no-dev --no-hashes -o /tmp/requirements.txt \
    && pip install --break-system-packages --no-cache-dir -r /tmp/requirements.txt \
    && rm /tmp/requirements.txt

# Pull in the Node build output + pruned node_modules
COPY --from=node-builder /app/dist ./dist
COPY --from=node-builder /app/node_modules ./node_modules
COPY --from=node-builder /app/package.json ./package.json

# Python source (TS code is already bundled into dist/index.cjs)
COPY --from=node-builder /app/01-content-factory ./01-content-factory
COPY --from=node-builder /app/shared ./shared

ENV NODE_ENV=production \
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
