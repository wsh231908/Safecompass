# SafeCompass 本地服务启动操作手册

本文档按实际操作顺序说明：如何从本地电脑连接服务器，如何启动 Llama-3-70B 本地模型服务，如何启动 SafeCompass 平台，以及如何在浏览器中访问。

本文档适合日常启动使用。更详细的参数解释见：

```text
docs/safecompass-startup-guide.md
```

## 1. 服务地址约定

| 服务 | 服务器内地址 | 用途 |
| --- | --- | --- |
| SafeCompass 平台 | `http://127.0.0.1:4173` | 浏览器访问评测平台 |
| Llama-3-70B API | `http://127.0.0.1:8002/v1` | OpenAI-compatible 模型接口 |

模型名：

```text
meta-llama/Llama-3-70b-chat-hf
```

项目路径：

```text
/home/u2023202105/Safecompass
```

模型路径：

```text
/home/u2023202105/models/llama-3-70b-instruct-awq
```

## 2. 从本地电脑连接服务器

在你的本地电脑终端中执行：

```bash
ssh 用户名@服务器地址
```

示例：

```bash
ssh u2023202105@your.server.address
```

如果你希望在本地浏览器访问服务器上的 SafeCompass，需要做端口转发：

```bash
ssh -L 4173:127.0.0.1:4173 用户名@服务器地址
```

这条命令的含义是：

| 部分 | 含义 |
| --- | --- |
| `ssh` | 连接远程服务器 |
| `-L 4173:127.0.0.1:4173` | 把本地电脑的 `4173` 端口转发到服务器的 `127.0.0.1:4173` |
| `用户名@服务器地址` | 你的服务器登录账号和地址 |

连接成功后，你可以在本地浏览器打开：

```text
http://127.0.0.1:4173
```

如果你是在服务器桌面环境里直接打开浏览器，也可以直接访问：

```text
http://127.0.0.1:4173
```

## 3. 进入项目目录

连接服务器后，先进入项目目录：

```bash
cd /home/u2023202105/Safecompass
```

后续命令都默认在这个目录下执行。

## 4. 启动前检查

启动前必须先检查服务是否已经在运行，尤其是 Llama-3-70B。70B 模型加载慢、显存占用高，不要重复启动。

### 4.1 查看 tmux 会话

```bash
tmux list-sessions 2>/dev/null || true
```

如果已经看到：

```text
safecompass_local
llama70b_awq_judge
```

说明平台和 Llama 服务可能已经在运行。

### 4.2 查看端口

```bash
ss -ltnp | grep -E ':(4173|8002)\b' || true
```

正常运行时应看到：

```text
*:4173              users:(("node",...))
127.0.0.1:8002     users:(("python",...))
```

含义：

| 端口 | 说明 |
| --- | --- |
| `4173` | SafeCompass 平台服务 |
| `8002` | Llama-3-70B vLLM API |

### 4.3 查看 GPU 状态

```bash
nvidia-smi
```

简洁版本：

```bash
nvidia-smi --query-gpu=index,memory.used,memory.free,memory.total,utilization.gpu --format=csv,noheader,nounits
```

如果要启动 Llama-3-70B，优先选择空闲显存较多的 GPU。当前已验证可用的配置是：

```text
GPU_ID=0
GPU_MEMORY_UTILIZATION=0.90
MAX_MODEL_LEN=2048
```

## 5. 启动 Llama-3-70B 模型服务

如果 `8002` 端口已经在监听，并且 `/v1/models` 能返回模型列表，可以跳过本节。

### 5.1 启动命令

```bash
cd /home/u2023202105/Safecompass

tmux new-session -d -s llama70b_awq_judge \
  'cd /home/u2023202105/Safecompass && env PYTHONUNBUFFERED=1 GPU_ID=0 JUDGE_PORT=8002 MAX_MODEL_LEN=2048 MAX_NUM_SEQS=1 GPU_MEMORY_UTILIZATION=0.90 QUANTIZATION=awq_marlin DISABLE_FRONTEND_MULTIPROCESSING=1 scripts/start_llama70b_awq_judge.sh 2>&1 | tee logs/llama70b-awq-judge.log'
```

### 5.2 等待模型加载

Llama-3-70B 第一次启动需要等待。查看日志：

```bash
tail -f logs/llama70b-awq-judge.log
```

加载过程中会看到：

```text
Loading safetensors checkpoint shards
```

启动成功会看到：

```text
Uvicorn running on http://127.0.0.1:8002
```

### 5.3 验证 Llama API

```bash
curl http://127.0.0.1:8002/v1/models
```

正常返回中应包含：

```text
meta-llama/Llama-3-70b-chat-hf
```

再执行一个最小 judge 测试：

```bash
JUDGE_URL=http://127.0.0.1:8002/v1/chat/completions \
  scripts/test_llama70b_awq_judge.sh
```

正常情况下会返回 JSON，内容中包含：

```text
"content":"safe"
```

## 6. 启动 SafeCompass 平台服务

如果 `4173` 端口已经在监听，并且 `/api/health` 返回正常，可以跳过本节。

### 6.1 启动命令

```bash
cd /home/u2023202105/Safecompass

tmux new-session -d -s safecompass_local \
  'cd /home/u2023202105/Safecompass && PORT=4173 node server.js 2>&1 | tee logs/safecompass-server.log'
```

### 6.2 验证平台服务

```bash
curl http://127.0.0.1:4173/api/health
```

正常返回：

```json
{"ok":true}
```

## 7. 打开平台页面

如果你使用了 SSH 端口转发：

```bash
ssh -L 4173:127.0.0.1:4173 用户名@服务器地址
```

那么在本地浏览器打开：

```text
http://127.0.0.1:4173
```

如果你在服务器本机浏览器访问，也打开：

```text
http://127.0.0.1:4173
```

## 8. 平台页面使用流程

1. 被测试的大模型选择：`llama`
2. 数据集选择：
   - `JailbreakBench`
   - `HarmBench`
   - 或 `自定义数据集`
3. 如果选择 `JailbreakBench`：
   - 子集选择 `harmful`
4. 选择攻击策略：
   - `直接攻击`
   - `角色扮演`
   - `指令冲突`
   - `文本混淆`
   - `Random Search（本地搜索）`
5. 判分方式选择：`JailbreakBench official judge`
6. 最大样本数建议先设置为 `5` 或 `10`
7. 点击 `开始评测`

## 9. 常用管理命令

### 9.1 查看所有 tmux 服务

```bash
tmux list-sessions
```

### 9.2 进入 SafeCompass 平台服务

```bash
tmux attach -t safecompass_local
```

### 9.3 进入 Llama 模型服务

```bash
tmux attach -t llama70b_awq_judge
```

进入 tmux 后，如果想退出但不停止服务：

```text
Ctrl+B，然后按 D
```

### 9.4 查看平台日志

```bash
tail -f logs/safecompass-server.log
```

### 9.5 查看 Llama 日志

```bash
tail -f logs/llama70b-awq-judge.log
```

### 9.6 停止平台服务

```bash
tmux kill-session -t safecompass_local
```

### 9.7 停止 Llama 服务

```bash
tmux kill-session -t llama70b_awq_judge
```

## 10. 一键启动流程

如果你确认当前没有服务在运行，可以直接执行下面这一组命令。

注意：这会先停止已有的同名 tmux 会话，再重新启动。

```bash
cd /home/u2023202105/Safecompass

tmux kill-session -t llama70b_awq_judge 2>/dev/null || true
tmux kill-session -t safecompass_local 2>/dev/null || true

tmux new-session -d -s llama70b_awq_judge \
  'cd /home/u2023202105/Safecompass && env PYTHONUNBUFFERED=1 GPU_ID=0 JUDGE_PORT=8002 MAX_MODEL_LEN=2048 MAX_NUM_SEQS=1 GPU_MEMORY_UTILIZATION=0.90 QUANTIZATION=awq_marlin DISABLE_FRONTEND_MULTIPROCESSING=1 scripts/start_llama70b_awq_judge.sh 2>&1 | tee logs/llama70b-awq-judge.log'

tmux new-session -d -s safecompass_local \
  'cd /home/u2023202105/Safecompass && PORT=4173 node server.js 2>&1 | tee logs/safecompass-server.log'
```

启动后检查：

```bash
curl http://127.0.0.1:4173/api/health
curl http://127.0.0.1:8002/v1/models
```

如果第二条命令暂时失败，先查看 Llama 日志等待模型加载完成：

```bash
tail -f logs/llama70b-awq-judge.log
```

## 11. 常见问题

### 11.1 Llama 启动失败：No available memory for cache blocks

错误类似：

```text
ValueError: No available memory for the cache blocks.
```

处理方式：

1. 检查 GPU 显存：

```bash
nvidia-smi
```

2. 换一个更空闲的 GPU，例如：

```bash
GPU_ID=4 JUDGE_PORT=8002 scripts/start_llama70b_awq_judge.sh
```

3. 降低上下文长度：

```bash
MAX_MODEL_LEN=1024 JUDGE_PORT=8002 scripts/start_llama70b_awq_judge.sh
```

4. 确认 `GPU_MEMORY_UTILIZATION` 不要过低。当前验证可用值是：

```text
GPU_MEMORY_UTILIZATION=0.90
```

### 11.2 页面打不开

先确认平台服务：

```bash
curl http://127.0.0.1:4173/api/health
```

如果服务器上正常，但本地浏览器打不开，通常是没有做端口转发。重新用下面命令连接服务器：

```bash
ssh -L 4173:127.0.0.1:4173 用户名@服务器地址
```

### 11.3 页面评测失败

先检查 Llama：

```bash
curl http://127.0.0.1:8002/v1/models
```

如果失败，说明模型服务没启动或还在加载。

再检查平台：

```bash
curl http://127.0.0.1:4173/api/health
```

最后查看日志：

```bash
tail -f logs/safecompass-server.log
tail -f logs/llama70b-awq-judge.log
```
