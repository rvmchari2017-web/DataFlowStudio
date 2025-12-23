#!/usr/bin/env bash
set -e
# Minimal setup + run script. Run from repo root: bash run.sh

# Create and activate venv
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

# shellcheck disable=SC1091
source .venv/bin/activate

pip install -r backend/requirements.txt

# Install frontend deps if needed
cd frontend
if [ ! -d "node_modules" ]; then
  npm install
fi
cd ..

# Run both servers concurrently using npx (no global deps needed)
# backend: uvicorn serving FastAPI on port 8000
# frontend: vite dev server on port 5173
npx concurrently "bash -lc 'source .venv/bin/activate && uvicorn backend.app:app --reload --port 8000'" "bash -lc 'cd frontend && npm run dev -- --port 5173'"
