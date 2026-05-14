# SafeCompass 近期实现改动总结

本文档总结近期围绕 JailbreakBench 接入、大模型安全评测流程、UI 调整、调试能力和攻击策略层完成的主要改动。

## 1. JailbreakBench 数据集接入

- 接入 `JailbreakBench/JBB-Behaviors` 本地数据。
- 增加本地数据转换脚本能力，将 CSV 转换为前端可加载 JSON。
- 生成并保留以下数据文件：
  - `data/benchmarks/jailbreakbench/harmful.json`
  - `data/benchmarks/jailbreakbench/benign.json`
  - `data/benchmarks/jailbreakbench/behaviors.json`
  - `data/benchmarks/jailbreakbench/judge_comparison.json`
- 明确当前安全攻击评测默认使用 `harmful.json`。
- 保留 `benign` 和 `judge_comparison` 的数据与 registry 加载能力，但当前 UI 不暴露它们。

## 2. JailbreakBench 子集与字段语义修正

- 修正了早期将 `Behavior` 误当作模型输入 prompt 的问题。
- 当前模型输入来源为 JBB 的 `Goal`。
- `Behavior` 保留为数据集中的有害行为主题，例如 `Defamation`、`Phishing`、`Ransomware`。
- `Category` 保留为危害类别，用于筛选和统计。
- `attack_type` 不再由 JBB `Behavior` 填充，当前保持为 `-`，留给后续自定义攻击方法层使用。

## 3. UI 调整

- 删除 `CVALUES` 数据集入口。
- 当前数据集入口保留：
  - `JailbreakBench`
  - `HarmBench`
  - `自定义数据集`
- JailbreakBench 专属配置只在选择 `JailbreakBench` 时显示。
- 删除 JBB 子集选择 UI，当前固定使用 `harmful`。
- 删除旧的“攻击类型筛选”占位 UI。
- 保留并实现真实可用的“危害类别筛选”。
- 将默认 `API Base URL` 修改为 `https://api.moark.com/v1`。
- 将默认 `Judge API Base URL` 修改为 `https://api.moark.com/v1`。

## 4. 危害类别筛选

- `危害类别筛选` 基于 JBB `Category` 字段动态生成。
- 当前 `harmful.json` 包含 10 个危害类别：
  - `Disinformation`
  - `Economic harm`
  - `Expert advice`
  - `Fraud/Deception`
  - `Government decision-making`
  - `Harassment/Discrimination`
  - `Malware/Hacking`
  - `Physical harm`
  - `Privacy`
  - `Sexual/Adult content`
- 评测执行时会先按危害类别过滤，再按最大样本数截断。

## 5. Judge Pipeline

- 实现 JailbreakBench official judge pipeline 的结构：
  - 先调用被测模型生成 response。
  - 再调用 judge 模型判定结果。
- harmful 样本默认 judge 模型：
  - `meta-llama/Llama-3-70b-chat-hf`
- benign 样本加载能力仍保留，默认 refusal judge 模型：
  - `meta-llama/Llama-3-8b-chat-hf`
- 当前 UI 默认只跑 harmful，因此主要使用 harmful judge。
- 支持手动配置 judge API 和 judge 模型名称。
- 保留 `Refusal pattern fallback`，用于没有可用 judge 模型时的快速调试。

## 6. 空响应与 Judge 异常处理

- 修正空模型响应被误判为 unsafe 的问题。
- 当模型返回空 `response` 时，结果标记为：
  - `label: ambiguous`
  - `score: 50`
  - `result: 模型空响应`
- 当 official judge 返回空内容或无法解析时，结果标记为：
  - `label: ambiguous`
  - `result: Judge 输出未知`
- 增强 fallback 拒绝识别，覆盖更多常见拒绝表达，例如：
  - `I can't draft ...`
  - `I don't create ...`
  - `I cannot and will not ...`
  - `promotes hatred`
  - `discrimination`

## 7. 模型调用与 Reasoning 调整

- 将被测模型默认 `max_tokens` 从 `512` 提高到 `2048`。
- 将 judge 默认 `max_tokens` 调整为 `64`。
- 为 OpenAI-compatible 请求加入常见关闭 reasoning/thinking 的参数：
  - `enable_thinking: false`
  - `thinking: false`
  - `reasoning_effort: "none"`
- 这些参数用于减少部分推理模型只输出 reasoning、最终 `content` 为空的问题。

## 8. 原始 API 返回体调试字段

- 在每条评测结果中新增：
  - `raw_model_response`
- 该字段保存被测模型 API 的原始 JSON 返回体。
- 用途：
  - 判断服务商是否返回 `content: null`。
  - 判断内容是否在 `reasoning`、`reasoning_content` 或其他非标准字段中。
  - 查看 `finish_reason`、`usage`、过滤信息等。

## 9. Attack Strategy 层

- 新增独立攻击策略模块：
  - `src/services/attack-strategies.js`
- 评测流程调整为：
  1. 加载 JBB harmful `Goal`
  2. 通过 attack strategy 转换为实际攻击 prompt
  3. 将转换后的 prompt 发给被测模型
  4. judge 仍使用原始 goal 和模型 response 判断
- 每条结果会保留：
  - `original_prompt`
  - `prompt`
  - `attack_strategy`
  - `attack_strategy_label`

## 10. 已实现攻击策略

### direct

- 名称：`直接攻击`
- 行为：原样发送 JBB `Goal`。

### roleplay

- 名称：`角色扮演`
- 行为：将原始 `Goal` 包装进虚构角色场景中，生成角色扮演式攻击 prompt。

### encoding_base64

- 名称：`编码绕过（Base64）`
- 行为：
  - 将原始 `Goal` 以 UTF-8 编码为 Base64。
  - 生成要求模型解码并执行的 prompt。

## 11. 当前保留但未暴露的能力

- `benign.json` 数据仍保留。
- `judge_comparison.json` 数据仍保留。
- registry 中仍保留 `benign`、`behaviors`、`judge_comparison` 的定义。
- 后续如需做过度拒绝评测或 judge 对比，可恢复 UI 暴露。

## 12. 当前未提交改动

截至本文档编写时，工作区仍有未提交改动，主要包括：

- UI 简化与默认 API 地址调整。
- 空响应和 judge unknown 的 ambiguous 处理。
- JBB harmful 固定使用。
- 危害类别筛选接入。
- 攻击策略层与 `direct`、`roleplay`、`encoding_base64` 策略。
- 原始模型 API 返回体调试字段。

