# 本地大模型部署说明

## 1. 部署目标

本项目的目标是搭建一个大模型安全评测平台。为了避免每次评测都依赖外部 API，同时保证评测过程可控，我将 Llama-3-70B 模型部署在本地服务器上，并通过本地接口提供给 SafeCompass 平台调用。

当前部署后的整体结构是：

```text
浏览器
  |
  v
SafeCompass 平台服务
http://127.0.0.1:4173
  |
  v
本地 Llama vLLM 服务
http://127.0.0.1:8002/v1
```

其中 SafeCompass 负责数据集选择、攻击 prompt 生成、模型调用和结果展示；Llama 模型服务负责实际推理，也可以作为 LLM-as-a-judge 对模型回复进行安全性判定。

## 2. 使用的主要工具

### 2.1 Llama-3-70B AWQ 模型

本地部署使用的是 Llama-3-70B 的 AWQ 量化版本：

```text
/home/u2023202105/models/llama-3-70b-instruct-awq
```

70B 模型参数量很大，原始精度部署需要非常高的显存。AWQ 是一种权重量化方法，可以在尽量保持模型能力的前提下降低显存占用，使模型能够在单张 A800 80GB GPU 上运行。

平台中使用的模型名称是：

```text
meta-llama/Llama-3-70b-chat-hf
```

这个名称是服务暴露给调用方的模型名，不一定等同于模型文件夹名称。

### 2.2 vLLM

本地模型服务使用 vLLM 启动。vLLM 是一个高性能大模型推理框架，适合把本地模型部署成 API 服务。

本项目使用的启动方式是：

```bash
python -m vllm.entrypoints.openai.api_server
```

这个命令会把本地模型启动成 OpenAI-compatible API，也就是接口形式和 OpenAI 的 `chat/completions` 类似。

常用接口包括：

```text
GET  /v1/models
POST /v1/chat/completions
```

这样 SafeCompass 调用本地 Llama 的方式，就和调用 OpenAI-compatible 远程模型类似。

### 2.3 CUDA GPU

Llama-3-70B 推理需要 GPU。当前部署主要使用 A800 80GB GPU。

启动时通过环境变量指定使用哪张卡：

```bash
GPU_ID=0
```

脚本内部会将其设置为：

```bash
CUDA_VISIBLE_DEVICES=0
```

这样 vLLM 只会看到并使用指定 GPU。

### 2.4 Node.js

SafeCompass 平台本身是一个 Node.js 服务。它负责提供网页和后端接口。

平台服务运行在：

```text
http://127.0.0.1:4173
```

模型服务运行在：

```text
http://127.0.0.1:8002/v1
```

二者是两个独立进程，通过 HTTP 请求通信。

### 2.5 tmux 或 systemd

在开发阶段，可以使用 tmux 让服务在后台持续运行。

例如：

```bash
tmux new-session -d -s llama70b_awq_judge '...启动 Llama...'
tmux new-session -d -s safecompass_local '...启动 SafeCompass...'
```

如果要作为长期网站运行，更推荐使用 systemd 管理服务。systemd 可以在服务异常退出时自动重启，也可以在服务器重启后自动拉起服务。

## 3. 本地部署的启动参数

当前 Llama 服务的核心启动参数如下：

```bash
GPU_ID=0
JUDGE_PORT=8002
MAX_MODEL_LEN=2048
MAX_NUM_SEQS=1
GPU_MEMORY_UTILIZATION=0.75
QUANTIZATION=awq_marlin
DISABLE_FRONTEND_MULTIPROCESSING=1
```

这些参数的含义如下：

| 参数 | 含义 |
| --- | --- |
| `GPU_ID` | 指定使用哪张 GPU |
| `JUDGE_PORT` | 模型服务监听端口，当前是 `8002` |
| `MAX_MODEL_LEN` | 最大上下文长度，当前为 2048 tokens |
| `MAX_NUM_SEQS` | 同时处理的最大序列数，当前设为 1，保证稳定 |
| `GPU_MEMORY_UTILIZATION` | vLLM 可使用的 GPU 显存比例 |
| `QUANTIZATION` | 量化方式，当前使用 `awq_marlin` |
| `DISABLE_FRONTEND_MULTIPROCESSING` | 关闭前端多进程，减少兼容问题 |

其中 `GPU_MEMORY_UTILIZATION=0.75` 是根据当前服务器显存占用情况设置的。如果 GPU 比较空闲，可以尝试提高到 `0.90`；如果出现显存不足，则需要降低该值或降低 `MAX_MODEL_LEN`。

## 4. 为什么要通过端口接入本地模型

虽然 Llama 模型部署在本机，但它和 SafeCompass 平台不是同一个程序。

SafeCompass 是 Node.js 服务，Llama 是 Python/vLLM 服务。两个进程之间不能直接调用函数，因此需要一种通信方式。本项目选择 HTTP API，也就是通过本地端口通信。

具体来说：

```text
SafeCompass 后端
  |
  | HTTP 请求
  v
http://127.0.0.1:8002/v1/chat/completions
  |
  v
vLLM 调用本地 Llama 模型完成推理
```

这种方式有几个优点：

1. 平台和模型解耦，模型服务可以单独启动、重启和替换。
2. 接口兼容 OpenAI 格式，后续可以方便替换成其他本地或远程模型。
3. `127.0.0.1` 只允许本机访问，外部用户不能直接访问模型服务，安全性更好。
4. SafeCompass 不需要关心模型底层是 PyTorch、vLLM 还是其他框架，只需要调用统一 API。

## 5. 推理请求的基本流程

当用户在 SafeCompass 中发起一次评测时，整体流程如下：

```text
1. 用户在网页选择数据集和攻击策略
2. SafeCompass 根据测试用例生成攻击 prompt
3. SafeCompass 调用本地 Llama API
4. vLLM 接收请求并进行模型推理
5. Llama 返回模型回复
6. SafeCompass 再调用 judge 模型进行安全判定
7. 平台统计 ASR，并展示评测结果
```

如果是自定义数据集，当前平台固定使用 LLM-as-a-judge：

```text
原始请求 + 被测模型回复
  |
  v
本地 Llama judge
  |
  v
safe / unsafe
```

也就是说，系统不是简单通过关键词或模式匹配判断安全性，而是让本地 Llama 作为评判模型来判断回复是否真正满足了有害请求。

## 6. OpenAI-compatible API 的作用

vLLM 启动后提供的接口格式接近 OpenAI API。例如，一个最简单的请求如下：

```bash
curl http://127.0.0.1:8002/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-3-70b-chat-hf",
    "messages": [
      {"role": "user", "content": "Reply with exactly: ok"}
    ],
    "temperature": 0,
    "max_tokens": 4
  }'
```

正常情况下，模型会返回类似：

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "ok"
      }
    }
  ]
}
```

这种接口形式让 SafeCompass 可以用统一代码调用不同模型。只要模型服务兼容 OpenAI API，就可以接入平台。

## 7. 服务启动与检查

### 7.1 检查服务是否在线

检查 SafeCompass：

```bash
curl http://127.0.0.1:4173/api/health
```

正常返回：

```json
{"ok":true}
```

检查 Llama：

```bash
curl http://127.0.0.1:8002/v1/models
```

正常返回中应包含：

```text
meta-llama/Llama-3-70b-chat-hf
```

### 7.2 检查端口

```bash
ss -ltnp | grep -E ':(4173|8002)\b'
```

正常情况下可以看到：

```text
4173  node
8002  python
```

### 7.3 检查 GPU

```bash
nvidia-smi
```

如果 Llama 正常运行，可以看到对应 GPU 上有较高显存占用。

## 8. 本地部署的优点和限制

### 8.1 优点

本地部署的优点主要有：

- 不依赖外部商业 API，评测过程更可控。
- 数据不会发送到外部模型服务，适合安全评测场景。
- 可以稳定使用同一个 judge 模型，减少评测标准变化。
- 可以通过 vLLM 提供统一接口，方便平台调用。

### 8.2 限制

本地部署也有明显限制：

- 70B 模型显存占用很高，需要高性能 GPU。
- 模型加载时间较长，第一次启动需要等待几分钟。
- 并发能力有限，多个用户同时评测时可能排队。
- 如果 GPU 上还有其他任务，可能出现显存不足或推理变慢。

因此在课程项目中，我将最大并发设置得比较保守，优先保证评测流程稳定。

## 9. 总结

本项目将 Llama-3-70B AWQ 模型部署在本地服务器上，并使用 vLLM 将模型封装成 OpenAI-compatible API。SafeCompass 平台通过本地端口调用该 API，实现了本地模型推理和 LLM-as-a-judge 安全判定。

这种部署方式的核心思想是：

```text
大模型作为独立推理服务运行，
平台通过统一 API 调用模型，
从而实现模型能力和评测平台的解耦。
```

对本项目来说，这种方式既保证了评测流程的可控性，也为后续更换模型、扩展数据集和部署成网站提供了基础。
