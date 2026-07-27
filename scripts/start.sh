#!/usr/bin/env bash
# VICES — start everything (Linux / macOS)
# Usage:  bash scripts/start.sh [--backend-only]
#
# Launches the backend API (which auto-spawns the local LLM engine) and the
# Tauri desktop app. Ctrl+C stops both.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -x .venv/bin/python ]]; then
  echo "No virtual environment found. Run: bash scripts/install.sh" >&2
  exit 1
fi

if ! ls models/llm/*.gguf >/dev/null 2>&1; then
  echo "WARNING: no .gguf model in models/llm/ — chat will not work until you add one." >&2
  echo "         See models/README.md for recommendations." >&2
fi

echo "Starting VICES backend (http://localhost:8000)..."
(cd backend && ../.venv/bin/python server.py) &
BACKEND_PID=$!

cleanup() {
  echo "Stopping backend (PID $BACKEND_PID)..."
  kill "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [[ "${1:-}" == "--backend-only" ]]; then
  echo "Backend running (PID $BACKEND_PID). Ctrl+C to stop."
  wait "$BACKEND_PID"
else
  echo "Starting desktop app..."
  (cd frontend_app && pnpm tauri dev)
fi
