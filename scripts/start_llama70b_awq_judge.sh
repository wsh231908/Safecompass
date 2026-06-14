#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

GPU_ID="${GPU_ID:-1}"
PORT="${JUDGE_PORT:-8001}"
HOST="${JUDGE_HOST:-127.0.0.1}"
MODEL="${JUDGE_MODEL:-/home/u2023202105/models/llama-3-70b-instruct-awq}"
SERVED_MODEL_NAME="${SERVED_MODEL_NAME:-meta-llama/Llama-3-70b-chat-hf}"
VLLM_PYTHON="${VLLM_PYTHON:-/fs/fast/share/aimind_files/conda/envs/video-eval/bin/python}"
HF_ENDPOINT="${HF_ENDPOINT:-https://hf-mirror.com}"
HF_HOME="${HF_HOME:-/home/u2023202105/.cache/huggingface}"
MAX_MODEL_LEN="${MAX_MODEL_LEN:-2048}"
MAX_NUM_SEQS="${MAX_NUM_SEQS:-1}"
GPU_MEMORY_UTILIZATION="${GPU_MEMORY_UTILIZATION:-0.90}"
QUANTIZATION="${QUANTIZATION:-awq_marlin}"
DISABLE_FRONTEND_MULTIPROCESSING="${DISABLE_FRONTEND_MULTIPROCESSING:-1}"

export CUDA_VISIBLE_DEVICES="$GPU_ID"
export HF_ENDPOINT
export HF_HOME
export TRANSFORMERS_CACHE="${TRANSFORMERS_CACHE:-$HF_HOME/transformers}"
export HUGGINGFACE_HUB_CACHE="${HUGGINGFACE_HUB_CACHE:-$HF_HOME/hub}"

mkdir -p "$HF_HOME" "$ROOT_DIR/logs"

echo "Starting Llama-3-70B AWQ judge on GPU ${GPU_ID}"
echo "Model: ${MODEL}"
echo "OpenAI-compatible endpoint: http://${HOST}:${PORT}/v1"
echo "Served model name: ${SERVED_MODEL_NAME}"

ARGS=(
  -m vllm.entrypoints.openai.api_server
  --host "$HOST" \
  --port "$PORT" \
  --model "$MODEL" \
  --served-model-name "$SERVED_MODEL_NAME" \
  --tensor-parallel-size 1 \
  --quantization "$QUANTIZATION" \
  --dtype half \
  --max-model-len "$MAX_MODEL_LEN" \
  --max-num-seqs "$MAX_NUM_SEQS" \
  --gpu-memory-utilization "$GPU_MEMORY_UTILIZATION" \
  --disable-log-requests
)

if [[ "$DISABLE_FRONTEND_MULTIPROCESSING" == "1" ]]; then
  ARGS+=(--disable-frontend-multiprocessing)
fi

exec "$VLLM_PYTHON" "${ARGS[@]}"
