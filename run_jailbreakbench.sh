#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-4173}"
if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
  PYTHON_BIN="${PYTHON_BIN:-$ROOT_DIR/.venv/bin/python}"
else
  PYTHON_BIN="${PYTHON_BIN:-python3}"
fi

cd "$ROOT_DIR"

HARMFUL_JSON="$ROOT_DIR/data/benchmarks/jailbreakbench/harmful.json"

if [[ -f "$HARMFUL_JSON" ]]; then
  echo "[1/3] Using existing local JailbreakBench harmful JSON"
else
  echo "Local JailbreakBench harmful data not found."
  echo "Expected: data/benchmarks/jailbreakbench/harmful.json"
  exit 1
fi

echo "[2/3] Verifying prepared dataset files"
[[ -f "$HARMFUL_JSON" ]] || { echo "Missing $HARMFUL_JSON"; exit 1; }

echo "[3/3] Starting local server on http://localhost:${PORT}"
echo "Press Ctrl+C to stop"
node server.js
