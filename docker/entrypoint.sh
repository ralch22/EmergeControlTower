#!/usr/bin/env bash
# Container entrypoint for EmergeControlTower.
#
# Single-runtime: Express on PORT=5000. The Python LangGraph orchestrator
# that lived alongside Node was deleted (PR 2.1, 2026-06-23) — it was
# never called from production paths.

set -euo pipefail

echo "[entrypoint] starting Node Express server on :${PORT:-5000}"
exec node dist/index.cjs
