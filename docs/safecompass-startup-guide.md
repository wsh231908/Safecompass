# SafeCompass 与 Llama-3-70B 本地模型启动流程

本文档说明如何在服务器上启动 SafeCompass 平台服务和本地 Llama-3-70B AWQ 模型服务，并解释启动命令中各个参数的含义。

## 1. 服务结构

SafeCompass 当前由两个本地服务组成：

| 服务 | 默认地址 | 作用 |
| --- | --- | --- |
| SafeCompass 平台 | `http://127.0.0.1:4173` | 浏览器访问的评测平台 |
| Llama-3-70B vLLM API | `http://127.0.0.1:8002/v1` | OpenAI-compatible 模型接口，用作被测模型和 JailbreakBench judge |

平台默认使用的模型名称是：

```text
meta-llama/Llama-3-70b-chat-hf
```

本地模型目录是：

```text
/home/u2023202105/models/llama-3-70b-instruct-awq
```

## 2. 推荐启动顺序

建议按以下顺序启动：

1. 检查 GPU 和端口状态。
2. 启动 Llama-3-70B vLLM API。
3. 验证 Llama API 可用。
4. 启动 SafeCompass 平台。
5. 验证平台可用。
6. 打开浏览器访问平台并开始评测。

## 3. 进入项目目录

所有命令都建议先进入项目根目录：

```bash
cd /home/u2023202105/Safecompass
```

## 4. 启动前检查

### 4.1 检查 tmux 会话

```bash
tmux list-sessions 2>/dev/null || true
```

参数说明：

| 部分 | 含义 |
| --- | --- |
| `tmux list-sessions` | 列出当前已有的 tmux 后台会话 |
| `2>/dev/null` | 如果当前没有 tmux server，隐藏错误输出 |
| `|| true` | 即使命令失败，也不要中断后续操作 |

### 4.2 检查端口占用

```bash
ss -ltnp | grep -E ':(4173|8002)\b' || true
```

参数说明：

| 部分 | 含义 |
| --- | --- |
| `ss` | 查看 socket/端口状态 |
| `-l` | 只显示监听中的端口 |
| `-t` | 只显示 TCP 端口 |
| `-n` | 以数字形式显示端口，不解析服务名 |
| `-p` | 显示占用端口的进程 |
| `grep -E ':(4173|8002)\b'` | 只筛选 SafeCompass 和 Llama API 使用的端口 |
| `|| true` | 没查到端口时也不报错中断 |

如果 `4173` 已经被 SafeCompass 占用，通常不需要重复启动平台。

如果 `8002` 已经被 Llama vLLM 占用，通常不需要重复启动模型。

### 4.3 检查 GPU 显存

```bash
nvidia-smi
```

更简洁的显存检查：

```bash
nvidia-smi --query-gpu=index,memory.used,memory.free,memory.total,utilization.gpu --format=csv,noheader,nounits
```

输出每列含义：

| 列 | 含义 |
| --- | --- |
| `index` | GPU 编号，也就是后续 `GPU_ID` 要填写的值 |
| `memory.used` | 已用显存，单位 MiB |
| `memory.free` | 空闲显存，单位 MiB |
| `memory.total` | 总显存，单位 MiB |
| `utilization.gpu` | GPU 计算利用率，单位 `%` |

Llama-3-70B AWQ 需要大量显存。当前实践中，A800 80GB 单卡可运行，但要尽量选择空闲显存足够的 GPU。

## 5. 启动 Llama-3-70B 本地模型服务

### 5.1 推荐启动命令

当前验证可用的启动命令如下：

```bash
cd /home/u2023202105/Safecompass

tmux new-session -d -s llama70b_awq_judge \
  'cd /home/u2023202105/Safecompass && env PYTHONUNBUFFERED=1 GPU_ID=0 JUDGE_PORT=8002 MAX_MODEL_LEN=2048 MAX_NUM_SEQS=1 GPU_MEMORY_UTILIZATION=0.90 QUANTIZATION=awq_marlin DISABLE_FRONTEND_MULTIPROCESSING=1 scripts/start_llama70b_awq_judge.sh 2>&1 | tee logs/llama70b-awq-judge.log'
```

这个命令会在 tmux 后台会话中启动 vLLM OpenAI-compatible API。

### 5.2 tmux 参数说明

| 参数 | 含义 |
| --- | --- |
| `tmux new-session` | 创建一个新的 tmux 会话 |
| `-d` | detached 模式，后台运行，不占用当前终端 |
| `-s llama70b_awq_judge` | 设置 tmux 会话名，便于后续查看、进入或停止 |

### 5.3 shell 命令结构说明

tmux 中实际执行的是：

```bash
cd /home/u2023202105/Safecompass && env ... scripts/start_llama70b_awq_judge.sh 2>&1 | tee logs/llama70b-awq-judge.log
```

| 部分 | 含义 |
| --- | --- |
| `cd /home/u2023202105/Safecompass` | 切换到项目根目录 |
| `&&` | 前一个命令成功后才执行后一个命令 |
| `env KEY=VALUE ...` | 为当前启动命令设置环境变量 |
| `scripts/start_llama70b_awq_judge.sh` | 实际启动 vLLM 的脚本 |
| `2>&1` | 将标准错误合并到标准输出 |
| `tee logs/llama70b-awq-judge.log` | 同时把日志打印到 tmux 窗口并写入日志文件 |

### 5.4 环境变量参数说明

这些环境变量会被 `scripts/start_llama70b_awq_judge.sh` 读取。

| 参数 | 推荐值 | 含义 |
| --- | --- | --- |
| `PYTHONUNBUFFERED` | `1` | 让 Python 日志实时输出，避免日志长时间不刷新 |
| `GPU_ID` | `0` | 指定使用哪张 GPU。脚本会把它写入 `CUDA_VISIBLE_DEVICES` |
| `JUDGE_PORT` | `8002` | vLLM API 监听端口。平台默认调用 `8002` |
| `MAX_MODEL_LEN` | `2048` | 模型最大上下文长度。越大越占 KV cache 显存 |
| `MAX_NUM_SEQS` | `1` | vLLM 同时处理的最大序列数。评测时建议先设为 `1` 保守运行 |
| `GPU_MEMORY_UTILIZATION` | `0.90` | vLLM 可使用的 GPU 显存比例。A800 80GB 跑 70B AWQ 时通常需要较高值 |
| `QUANTIZATION` | `awq_marlin` | 使用 AWQ Marlin 量化内核加载 AWQ 模型 |
| `DISABLE_FRONTEND_MULTIPROCESSING` | `1` | 禁用 vLLM frontend multiprocessing，减少部分环境下的进程兼容问题 |

注意：如果 `GPU_MEMORY_UTILIZATION=0.70`，可能出现：

```text
ValueError: No available memory for the cache blocks.
```

这表示 vLLM 给 KV cache 的预算不足。可以尝试：

1. 使用更空闲的 GPU。
2. 将 `GPU_MEMORY_UTILIZATION` 提高到 `0.90`。
3. 降低 `MAX_MODEL_LEN`，例如改为 `1024`。

### 5.5 启动脚本内部默认参数

`scripts/start_llama70b_awq_judge.sh` 中还有一些可覆盖的默认参数：

| 参数 | 默认值 | 含义 |
| --- | --- | --- |
| `JUDGE_HOST` | `127.0.0.1` | vLLM 监听地址。默认只允许本机访问 |
| `JUDGE_MODEL` | `/home/u2023202105/models/llama-3-70b-instruct-awq` | 本地模型目录 |
| `SERVED_MODEL_NAME` | `meta-llama/Llama-3-70b-chat-hf` | OpenAI-compatible API 暴露给客户端的模型名 |
| `VLLM_PYTHON` | `/fs/fast/share/aimind_files/conda/envs/video-eval/bin/python` | 运行 vLLM 的 Python 解释器 |
| `HF_ENDPOINT` | `https://hf-mirror.com` | Hugging Face 镜像地址 |
| `HF_HOME` | `/home/u2023202105/.cache/huggingface` | Hugging Face 缓存目录 |

如果需要临时修改模型目录，可以这样启动：

```bash
JUDGE_MODEL=/path/to/model scripts/start_llama70b_awq_judge.sh
```

### 5.6 vLLM 命令行参数说明

启动脚本最终会执行：

```bash
python -m vllm.entrypoints.openai.api_server \
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
  --disable-log-requests \
  --disable-frontend-multiprocessing
```

| 参数 | 含义 |
| --- | --- |
| `-m vllm.entrypoints.openai.api_server` | 以 OpenAI-compatible API server 模式启动 vLLM |
| `--host` | API 监听地址，当前是 `127.0.0.1` |
| `--port` | API 监听端口，当前是 `8002` |
| `--model` | 本地模型目录 |
| `--served-model-name` | `/v1/models` 和 `/v1/chat/completions` 中使用的模型名 |
| `--tensor-parallel-size 1` | 单卡运行，不做张量并行 |
| `--quantization awq_marlin` | 使用 AWQ Marlin 量化内核 |
| `--dtype half` | 使用 FP16 计算 |
| `--max-model-len 2048` | 最大上下文长度 |
| `--max-num-seqs 1` | 同时处理的最大请求序列数 |
| `--gpu-memory-utilization 0.90` | vLLM 可使用的显存比例 |
| `--disable-log-requests` | 不记录每个请求的详细日志，减少日志量 |
| `--disable-frontend-multiprocessing` | 禁用 frontend 多进程模式 |

## 6. 验证 Llama API

### 6.1 检查端口

```bash
ss -ltnp | grep ':8002'
```

正常情况下会看到类似：

```text
LISTEN 0 2048 127.0.0.1:8002 0.0.0.0:* users:(("python",pid=3221,fd=86))
```

### 6.2 检查模型列表

```bash
curl http://127.0.0.1:8002/v1/models
```

正常结果中应包含：

```json
"id":"meta-llama/Llama-3-70b-chat-hf"
```

### 6.3 测试 chat completion

项目中已有测试脚本：

```bash
JUDGE_URL=http://127.0.0.1:8002/v1/chat/completions \
  scripts/test_llama70b_awq_judge.sh
```

正常情况下会返回一段 OpenAI-compatible JSON，其中 `choices[0].message.content` 通常是：

```json
"safe"
```

## 7. 启动 SafeCompass 平台服务

### 7.1 推荐启动命令

```bash
cd /home/u2023202105/Safecompass

tmux new-session -d -s safecompass_local \
  'cd /home/u2023202105/Safecompass && PORT=4173 node server.js 2>&1 | tee logs/safecompass-server.log'
```

### 7.2 参数说明

| 参数 | 含义 |
| --- | --- |
| `tmux new-session -d` | 创建后台 tmux 会话 |
| `-s safecompass_local` | tmux 会话名 |
| `PORT=4173` | 设置 SafeCompass 平台监听端口 |
| `node server.js` | 启动 Node.js 平台服务 |
| `2>&1` | 合并错误输出和标准输出 |
| `tee logs/safecompass-server.log` | 输出日志并写入日志文件 |

### 7.3 前台启动方式

如果只是临时调试，也可以前台启动：

```bash
cd /home/u2023202105/Safecompass
PORT=4173 node server.js
```

看到下面日志表示启动成功：

```text
SafeCompass server listening on http://localhost:4173
```

前台启动时，关闭终端或按 `Ctrl+C` 会停止服务。正式使用建议用 tmux。

## 8. 验证 SafeCompass 平台

```bash
curl http://127.0.0.1:4173/api/health
```

正常返回：

```json
{"ok":true}
```

浏览器访问：

```text
http://127.0.0.1:4173
```

如果你是在本地电脑访问远程服务器，需要使用 SSH 端口转发：

```bash
ssh -L 4173:127.0.0.1:4173 用户名@服务器地址
```

然后在本地浏览器打开：

```text
http://127.0.0.1:4173
```

## 9. 平台页面使用流程

打开平台后，按以下方式配置：

1. 被测试的大模型：选择 `llama`。
2. Benchmark / 数据集：选择 `JailbreakBench`。
3. Benchmark 子集：选择 `harmful`。
4. 攻击策略：按需要选择。

可选攻击策略包括：

| 策略 | 说明 |
| --- | --- |
| `直接攻击` | 直接使用原始 harmful goal |
| `角色扮演` | 使用本项目内置角色扮演模板 |
| `指令冲突` | 使用本项目内置指令冲突模板 |
| `文本混淆` | 使用本项目内置文本混淆模板 |
| `Random Search（本地搜索）` | 服务端生成多个候选 prompt，成功后提前停止 |

5. 判分方式：选择 `JailbreakBench official judge`。
6. 最大样本数：建议先设置为 `5` 或 `10`，确认稳定后再增加。
7. 点击 `开始评测`。

## 10. 查看日志

### 10.1 SafeCompass 日志

```bash
tail -f logs/safecompass-server.log
```

### 10.2 Llama vLLM 日志

```bash
tail -f logs/llama70b-awq-judge.log
```

### 10.3 查看 tmux 会话

```bash
tmux list-sessions
```

### 10.4 进入 tmux 会话

进入 SafeCompass 会话：

```bash
tmux attach -t safecompass_local
```

进入 Llama 会话：

```bash
tmux attach -t llama70b_awq_judge
```

从 tmux 会话中退出但不停止服务：

```text
Ctrl+B，然后按 D
```

## 11. 停止服务

停止 SafeCompass：

```bash
tmux kill-session -t safecompass_local
```

停止 Llama：

```bash
tmux kill-session -t llama70b_awq_judge
```

停止后检查端口：

```bash
ss -ltnp | grep -E ':(4173|8002)\b' || true
```

如果没有输出，说明两个服务都已经停止。

## 12. 重启服务

重启 SafeCompass：

```bash
tmux kill-session -t safecompass_local 2>/dev/null || true

tmux new-session -d -s safecompass_local \
  'cd /home/u2023202105/Safecompass && PORT=4173 node server.js 2>&1 | tee logs/safecompass-server.log'
```

重启 Llama：

```bash
tmux kill-session -t llama70b_awq_judge 2>/dev/null || true

tmux new-session -d -s llama70b_awq_judge \
  'cd /home/u2023202105/Safecompass && env PYTHONUNBUFFERED=1 GPU_ID=0 JUDGE_PORT=8002 MAX_MODEL_LEN=2048 MAX_NUM_SEQS=1 GPU_MEMORY_UTILIZATION=0.90 QUANTIZATION=awq_marlin DISABLE_FRONTEND_MULTIPROCESSING=1 scripts/start_llama70b_awq_judge.sh 2>&1 | tee logs/llama70b-awq-judge.log'
```

## 13. 常见问题

### 13.1 端口被占用

现象：

```text
EADDRINUSE
```

或端口检查显示已有进程：

```bash
ss -ltnp | grep -E ':(4173|8002)\b'
```

处理方式：

1. 如果是已有正确服务在运行，不需要重复启动。
2. 如果要重启，先停止对应 tmux 会话：

```bash
tmux kill-session -t safecompass_local
tmux kill-session -t llama70b_awq_judge
```

### 13.2 Llama 启动时没有可用 KV cache

现象：

```text
ValueError: No available memory for the cache blocks.
Try increasing `gpu_memory_utilization` when initializing the engine.
```

含义：

vLLM 的显存预算不足以同时容纳模型权重和 KV cache。

处理方式：

1. 检查 GPU 显存：

```bash
nvidia-smi --query-gpu=index,memory.used,memory.free,memory.total,utilization.gpu --format=csv,noheader,nounits
```

2. 换一张更空闲的 GPU，例如：

```bash
GPU_ID=4 JUDGE_PORT=8002 scripts/start_llama70b_awq_judge.sh
```

3. 提高 vLLM 显存比例，例如：

```bash
GPU_MEMORY_UTILIZATION=0.90 scripts/start_llama70b_awq_judge.sh
```

4. 降低上下文长度，例如：

```bash
MAX_MODEL_LEN=1024 scripts/start_llama70b_awq_judge.sh
```

### 13.3 Llama API 端口迟迟不开放

70B 模型加载需要时间。查看日志：

```bash
tail -f logs/llama70b-awq-judge.log
```

如果看到：

```text
Loading safetensors checkpoint shards
```

说明模型仍在加载，继续等待即可。

如果看到：

```text
Uvicorn running on http://127.0.0.1:8002
```

说明服务已经启动完成。

### 13.4 页面评测失败，提示模型接口调用失败

检查 Llama API：

```bash
curl http://127.0.0.1:8002/v1/models
```

如果连接失败，先启动或重启 Llama 服务。

如果可以返回模型列表，再检查平台：

```bash
curl http://127.0.0.1:4173/api/health
```

### 13.5 浏览器打不开平台

如果在服务器本机浏览器访问：

```text
http://127.0.0.1:4173
```

如果在自己电脑访问远程服务器，需要 SSH 端口转发：

```bash
ssh -L 4173:127.0.0.1:4173 用户名@服务器地址
```

然后本地打开：

```text
http://127.0.0.1:4173
```

## 14. 当前推荐的完整一键启动片段

如果确认端口没有被占用，可以直接运行：

```bash
cd /home/u2023202105/Safecompass

tmux kill-session -t llama70b_awq_judge 2>/dev/null || true
tmux kill-session -t safecompass_local 2>/dev/null || true

tmux new-session -d -s llama70b_awq_judge \
  'cd /home/u2023202105/Safecompass && env PYTHONUNBUFFERED=1 GPU_ID=0 JUDGE_PORT=8002 MAX_MODEL_LEN=2048 MAX_NUM_SEQS=1 GPU_MEMORY_UTILIZATION=0.90 QUANTIZATION=awq_marlin DISABLE_FRONTEND_MULTIPROCESSING=1 scripts/start_llama70b_awq_judge.sh 2>&1 | tee logs/llama70b-awq-judge.log'

tmux new-session -d -s safecompass_local \
  'cd /home/u2023202105/Safecompass && PORT=4173 node server.js 2>&1 | tee logs/safecompass-server.log'
```

启动后验证：

```bash
curl http://127.0.0.1:4173/api/health
curl http://127.0.0.1:8002/v1/models
```

第一次启动 Llama 需要等待模型加载完成，`/v1/models` 只有在看到 `Uvicorn running on http://127.0.0.1:8002` 后才会正常返回。
