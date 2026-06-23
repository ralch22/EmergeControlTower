#!/usr/bin/env bash
# Container entrypoint for EmergeControlTower.
#
# Boots the Python FastAPI orchestrator on PORT=8000 in the background, then
# execs the Node Express server on PORT=5000 in the foreground. dumb-init
# (PID 1) reaps the background Python process when Node exits, so the whole
# container terminates cleanly and CF Containers can restart the instance.

set -euo pipefail

PY_BIN="python3"
PY_HOST="${PYTHON_API_HOST:-127.0.0.1}"
PY_PORT="${CONTENT_FACTORY_PORT:-8000}"

if command -v "$PY_BIN" >/dev/null 2>&1; then
  echo "[entrypoint] starting Python FastAPI orchestrator on ${PY_HOST}:${PY_PORT}"
  # Run uvicorn in the background. Logs go to stdout/stderr (collected by CF).
  #
  # The Python package lives at 01-content-factory/python/. Python identifiers
  # can't start with a digit or contain hyphens, so the top-level dirname
  # ("01-content-factory") isn't importable. We use --app-dir to inject the
  # parent into sys.path; uvicorn then imports the inner `python` package
  # cleanly (it has __init__.py + relative imports across siblings).
  "$PY_BIN" -m uvicorn python.main:app \
    --app-dir /app/01-content-factory \
    --host "$PY_HOST" --port "$PY_PORT" \
    --no-access-log &
  PY_PID=$!

  # Best-effort liveness probe: give Python ~5s to bind before starting Node.
  for i in {1..10}; do
    if (echo > "/dev/tcp/${PY_HOST}/${PY_PORT}") 2>/dev/null; then
      echo "[entrypoint] Python orchestrator ready (pid=${PY_PID})"
      break
    fi
    if ! kill -0 "$PY_PID" 2>/dev/null; then
      echo "[entrypoint] Python orchestrator died during startup; exiting"
      exit 1
    fi
    sleep 0.5
  done
else
  echo "[entrypoint] Python venv not found at ${PY_BIN}; skipping orchestrator"
fi

echo "[entrypoint] starting Node Express server on :${PORT:-5000}"
exec node dist/index.cjs
