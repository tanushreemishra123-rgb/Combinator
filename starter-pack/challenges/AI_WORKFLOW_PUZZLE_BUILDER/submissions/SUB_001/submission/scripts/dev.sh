#!/usr/bin/env bash
# Starts the FastAPI backend and the Vite dev server together; Ctrl-C stops both.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_PY="$ROOT/backend/.venv/bin/python"

if [ ! -x "$VENV_PY" ]; then
  echo "Missing virtualenv at backend/.venv" >&2
  echo "Create it with: python3 -m venv backend/.venv && backend/.venv/bin/pip install -r backend/requirements.txt" >&2
  exit 1
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Missing frontend dependencies. Run: npm install --prefix frontend" >&2
  exit 1
fi

pids=()

cleanup() {
  trap - EXIT INT TERM
  for pid in "${pids[@]:-}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Backend  -> http://localhost:8000"
echo "Frontend -> http://localhost:5173"

(cd "$ROOT/backend" && "$VENV_PY" -m uvicorn app.main:app --reload --port 8000) &
pids+=($!)

(cd "$ROOT/frontend" && npm run dev) &
pids+=($!)

# Exit as soon as either process dies, so cleanup takes the other one down too.
# (A poll loop instead of `wait -n`, which needs bash 4+; macOS ships bash 3.2.)
while true; do
  for pid in "${pids[@]}"; do
    kill -0 "$pid" 2>/dev/null || exit 1
  done
  sleep 1
done
