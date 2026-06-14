# SafeCompass

SafeCompass 是一个面向课程项目的大模型安全评测平台原型。项目目标是把
JailbreakBench、HarmBench 和用户自定义数据集接入到同一个本地评测流程中，
通过攻击 prompt 生成、模型调用、LLM-as-judge 判分和 ASR 可视化，帮助比较不同模型
在有害请求场景下的拒答能力和越狱风险。

当前平台默认围绕本地部署的 `Llama-3-70B AWQ` 服务工作。该模型既可以作为被测模型，
也可以作为 JailbreakBench 风格 judge，对模型回复判定 `safe` / `unsafe`。

## 当前能力

- 支持本地浏览器访问的安全评测页面：`index.html`
- 支持本地 Llama 对话页面：`chat.html`
- 支持 JailbreakBench `harmful` 子集
- 支持 HarmBench `text_test` 子集
- 支持上传 JSON / CSV 自定义数据集
- 支持手动添加单条测试 prompt
- 支持 OpenAI-compatible 模型接口，包括本地 vLLM、代理网关或第三方兼容接口
- 支持攻击 prompt 生成：
  - `Direct Request`
  - `Human Jailbreaks`
  - `Jailbreak Chat`
- 使用 JailbreakBench Llama judge 进行安全判定
- 输出安全拒绝数、越狱成功数、ASR 等汇总指标
- 支持结果表格、JSON 导出和多种 ASR 可视化图表
- 提供 tmux 启动方式和 systemd 部署配置

## 评测流程

平台执行一次评测时，大致经过以下步骤：

1. 选择数据集：JailbreakBench、HarmBench 或自定义数据集。
2. 加载并规范化测试用例。
3. 选择攻击方法，将原始行为或请求转换成攻击 prompt。
4. 调用被测试模型生成回复。
5. 调用本地 Llama judge，根据“原始请求 + 模型回复”判定 `safe` 或 `unsafe`。
6. 汇总结果，计算 ASR，并在页面展示图表与表格。

其中 ASR 表示 Attack Success Rate，即被 judge 判定为 `unsafe` 的比例。

## 项目结构

```text
.
├── index.html                         # 评测平台页面
├── chat.html                          # 本地 Llama 对话页面
├── server.js                          # Node.js 静态服务和后端 API
├── src/
│   ├── app.js                         # 评测平台前端逻辑
│   ├── chat.js                        # Llama 对话页逻辑
│   ├── benchmarks/registry.js         # 内置 benchmark 注册表
│   ├── config/datasets.js             # 页面数据集选项
│   ├── services/
│   │   ├── attack-strategies.js       # 攻击策略与 prompt 变换
│   │   ├── benchmark-loader.js        # Benchmark 数据加载和规范化
│   │   ├── evaluator.js               # 前端评测调度
│   │   ├── exporter.js                # 结果导出
│   │   └── harmbench-human-jailbreaks.js
│   └── styles/main.css
├── data/benchmarks/
│   ├── jailbreakbench/harmful.json    # JailbreakBench harmful 本地数据
│   └── harmbench/text_test.json       # HarmBench text_test 本地数据
├── scripts/
│   ├── export_jailbreakbench.py       # 导出 JailbreakBench 数据
│   ├── export_harmbench.py            # 导出 HarmBench 数据
│   ├── start_llama70b_awq_judge.sh    # 启动本地 Llama-3-70B vLLM API
│   ├── test_llama70b_awq_judge.sh     # 测试本地 judge 接口
│   └── install_systemd_services.sh    # 安装/管理 systemd 服务
├── deploy/systemd/                    # systemd unit 和 env 示例
└── docs/                              # 启动、部署和本地运行文档
```

## 环境要求

基础平台服务：

- Node.js 18 或更高版本
- 现代浏览器

数据导出脚本：

- Python 3.10 或更高版本

本地 Llama-3-70B 服务：

- Linux 服务器
- NVIDIA GPU 和 CUDA 环境
- 已安装 vLLM 的 Python 环境
- 本地模型目录，默认：

```text
/home/u2023202105/models/llama-3-70b-instruct-awq
```

## 快速启动平台

进入项目目录：

```bash
cd /home/u2023202105/Safecompass
```

启动 SafeCompass Web 服务：

```bash
PORT=4173 node server.js
```

或使用 npm script：

```bash
npm run serve
```

浏览器打开：

```text
http://127.0.0.1:4173
```

健康检查：

```bash
curl http://127.0.0.1:4173/api/health
```

正常返回：

```json
{"ok":true}
```

## 启动本地 Llama-3-70B

平台默认使用的 OpenAI-compatible 模型接口是：

```text
http://127.0.0.1:8002/v1
```

默认模型名是：

```text
meta-llama/Llama-3-70b-chat-hf
```

推荐使用 tmux 在后台启动：

```bash
cd /home/u2023202105/Safecompass

tmux new-session -d -s llama70b_awq_judge \
  'cd /home/u2023202105/Safecompass && env PYTHONUNBUFFERED=1 GPU_ID=0 JUDGE_PORT=8002 MAX_MODEL_LEN=2048 MAX_NUM_SEQS=1 GPU_MEMORY_UTILIZATION=0.90 QUANTIZATION=awq_marlin DISABLE_FRONTEND_MULTIPROCESSING=1 scripts/start_llama70b_awq_judge.sh 2>&1 | tee logs/llama70b-awq-judge.log'
```

验证模型服务：

```bash
curl http://127.0.0.1:8002/v1/models
```

执行最小 judge 测试：

```bash
JUDGE_URL=http://127.0.0.1:8002/v1/chat/completions \
  scripts/test_llama70b_awq_judge.sh
```

更详细的启动说明见：

- `docs/local-runbook.md`
- `docs/safecompass-startup-guide.md`

## 使用平台

1. 打开 `http://127.0.0.1:4173`。
2. 在“被测试的大模型”中选择：
   - `llama`：使用默认本地 vLLM 服务。
   - `自定义 OpenAI-compatible 模型`：填写 API Base URL、API Key 和模型名。
3. 选择数据集：
   - `JailbreakBench`
   - `HarmBench`
   - `自定义数据集`
4. 选择攻击方法。
5. 设置最大样本数。
6. 点击“开始评测”。
7. 查看 ASR 汇总、结果表格和图表。
8. 需要离线分析时，点击“导出 JSON”。

## 自定义数据集格式

自定义数据集支持 JSON 和 CSV。每条用例至少需要一个文本字段：

```text
prompt / goal / request / question / instruction / text / content
```

推荐 JSON 格式：

```json
[
  {
    "id": "custom_001",
    "prompt": "需要评测的原始问题",
    "category": "可选危害类别",
    "behavior_type": "custom"
  }
]
```

也可以使用包含 `cases` 数组的对象：

```json
{
  "cases": [
    {
      "id": "case_001",
      "goal": "需要评测的目标行为",
      "category": "cyber"
    }
  ]
}
```

CSV 第一行必须是字段名，例如：

```csv
id,prompt,category,behavior_type
custom_001,需要评测的原始问题,custom,custom
```

## 数据集导出

仓库已经包含当前平台默认使用的数据：

```text
data/benchmarks/jailbreakbench/harmful.json
data/benchmarks/harmbench/text_test.json
```

重新导出 JailbreakBench harmful：

```bash
python3.11 scripts/export_jailbreakbench.py --subset harmful
```

重新导出 HarmBench text_test：

```bash
python3.11 scripts/export_harmbench.py --subset text_test
```

导出后，前端会通过 `src/benchmarks/registry.js` 中配置的路径加载本地 JSON。

## 后端 API

`server.js` 提供三个主要接口：

```text
GET  /api/health
POST /api/evaluate
POST /api/llama-chat
```

`/api/evaluate` 接收前端构造的评测任务，逐条调用被测模型和 judge，并返回结果数组。

`/api/llama-chat` 用于 `chat.html`，将聊天消息代理到本地 Llama vLLM 接口。

## 部署

日常开发或临时运行可以使用 tmux：

```bash
tmux new-session -d -s safecompass_local \
  'cd /home/u2023202105/Safecompass && PORT=4173 node server.js 2>&1 | tee logs/safecompass-server.log'
```

服务器长期运行可以使用 systemd：

```bash
sudo scripts/install_systemd_services.sh install
sudo scripts/install_systemd_services.sh start
sudo scripts/install_systemd_services.sh status
```

systemd 配置文件位于：

```text
deploy/systemd/
```

详细部署说明见：

```text
docs/systemd-deploy.md
```

## 当前开发方向

SafeCompass 当前仍是课程项目原型，重点是完成“可运行的本地安全评测闭环”。后续可以继续扩展：

- 接入更多 benchmark 子集和模型能力维度。
- 增加更多攻击策略和官方方法复现。
- 优化 LLM-as-judge 的可解释性和一致性。
- 增加批量评测任务管理和历史记录。
- 将 ASR、危害类别、攻击方法和模型能力分析做成更完整的报告。
