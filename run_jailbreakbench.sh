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

BEHAVIORS_JSON="$ROOT_DIR/data/benchmarks/jailbreakbench/behaviors.json"
JUDGE_JSON="$ROOT_DIR/data/benchmarks/jailbreakbench/judge_comparison.json"
BENIGN_CSV="$ROOT_DIR/data/benchmarks/jailbreakbench/benign-behaviors.csv"
HARMFUL_CSV="$ROOT_DIR/data/benchmarks/jailbreakbench/harmful-behaviors.csv"
JUDGE_CSV="$ROOT_DIR/data/benchmarks/jailbreakbench/judge-comparison.csv"

if [[ -f "$BENIGN_CSV" || -f "$HARMFUL_CSV" || -f "$JUDGE_CSV" ]]; then
  echo "[1/3] Preparing local JailbreakBench CSV files"
  $PYTHON_BIN scripts/prepare_local_jailbreakbench.py
elif [[ -f "$BEHAVIORS_JSON" && -f "$JUDGE_JSON" ]]; then
  echo "[1/3] Using existing local JailbreakBench JSON files"
else
  echo "Local JailbreakBench data not found."
  echo "Expected one of the following:"
  echo "  - data/benchmarks/jailbreakbench/behaviors.json and judge_comparison.json"
  echo "  - data/benchmarks/jailbreakbench/benign-behaviors.csv / harmful-behaviors.csv / judge-comparison.csv"
  exit 1
fi

echo "[2/3] Verifying prepared dataset files"
[[ -f "$BEHAVIORS_JSON" ]] || { echo "Missing $BEHAVIORS_JSON"; exit 1; }
[[ -f "$JUDGE_JSON" ]] || { echo "Missing $JUDGE_JSON"; exit 1; }

echo "[3/3] Starting local server on http://localhost:${PORT}"
echo "Press Ctrl+C to stop"
node server.js
