#!/usr/bin/env bash
# Container entrypoint for EmergeControlTower.
#
# Boots the Python FastAPI orchestrator on PORT=8000 in the background, then
# execs the Node Express server on PORT=5000 in the foreground. dumb-init
# (PID 1) reaps the background Python process when Node exits, so the whole
# container terminates cleanly and CF Containers can restart the instance.

set -euo pipefail

PY_BIN="/opt/venv/bin/python"
PY_HOST="${PYTHON_API_HOST:-127.0.0.1}"
PY_PORT="${CONTENT_FACTORY_PORT:-8000}"

if [[ -x "$PY_BIN" ]]; then
  echo "[entrypoint] starting Python FastAPI orchestrator on ${PY_HOST}:${PY_PORT}"
  # Run uvicorn in the background. Logs go to stdout/stderr (collected by CF).
  "$PY_BIN" -m uvicorn 01-content-factory.python.main:app \
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
