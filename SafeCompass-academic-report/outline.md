# SafeCompass 学术报告型 PPT 大纲

来源文稿：`docs/text.md`

建议页数：10 页

## Slide 1: SafeCompass

- Key points:
  - 面向大模型的安全风险评测与可视化分析平台
  - 聚焦有害请求、越狱攻击与拒答可靠性
  - 课程项目/学术汇报语境下的系统实现与实验分析
- Visual idea: 深色技术背景上的平台名与安全评测主题视觉，含模型、攻击 prompt、Judge、报告四个抽象节点
- Layout role and intent: cover
- Required source images: none

## Slide 2: 研究背景与问题定义

- Key points:
  - 大模型能力增强后，危险内容生成风险同步增加
  - 安全对齐机制在真实交互中可能被越狱 prompt 绕过
  - 普通问答测试不足，需要系统评估有害请求下的拒答能力
  - 目标问题：模型面对攻击 prompt 时是否仍然可靠
- Visual idea: 从“有害请求”到“攻击包装”再到“模型响应”的风险链路示意
- Layout role and intent: concept explanation
- Required source images: none

## Slide 3: 相关工作与项目定位

- Key points:
  - 参考 JailbreakBench 与 HarmBench 的安全评测范式
  - 使用有害行为数据集、攻击方法与 ASR 指标
  - SafeCompass 不止复现静态 benchmark，而是整合完整本地评测流程
  - 支持本地 Llama-3-70B AWQ 与 OpenAI-compatible 接口
- Visual idea: 左侧列出基准能力，右侧突出 SafeCompass 的平台化扩展
- Layout role and intent: comparison
- Required source images: none

## Slide 4: 平台架构与评测流水线

- Key points:
  - 前端评测页面、后端评测 API、统一数据 schema 协同工作
  - 流程：数据集选择、样本规范化、攻击 prompt 生成、模型调用、Judge 判分、报告导出
  - 支持单 Judge 与多 Judge 投票
  - 输出安全拒绝数、越狱成功数、需复核样本与 ASR
- Visual idea: 横向流程图，展示 Dataset -> Case Schema -> Attack -> Model -> Judge -> Report
- Layout role and intent: architecture / process
- Required source images: none

## Slide 5: 统一数据 Schema 与攻击策略

- Key points:
  - `safecompass.case.v1` 屏蔽不同数据集字段差异
  - 样本字段包含 `id`、`source`、`dataset`、`prompt`、`goal`、`category`、`behavior_type`、`metadata`
  - 当前支持 JailbreakBench harmful、HarmBench text_test 与自定义 JSON/CSV
  - 攻击策略包括 Direct Request、Human Jailbreaks、Jailbreak Chat
- Visual idea: 中心为标准 case 卡片，周围连接多个数据源和后续评测模块
- Layout role and intent: concept explanation
- Required source images: none

## Slide 6: 实验设计

- Key points:
  - 三次实验均使用 HarmBench text_test 子集，共 200 条样本
  - 攻击方法统一为 Jailbreak Chat，用于控制攻击变量
  - 实验一：Llama-3-70B + official_jbb 单 Judge
  - 实验二：Llama-3-70B + multi_judge
  - 实验三：GPT-5.4 + official_jbb 单 Judge
- Visual idea: 三列实验配置矩阵，突出固定变量与变化变量
- Layout role and intent: experiment setup
- Required source images: none

## Slide 7: 实验一结果：Llama + 单 Judge

- Key points:
  - 200 条样本中 185 条安全拒绝，15 条越狱成功
  - 整体 ASR 为 7.5%
  - cybercrime_intrusion 风险最高，ASR 为 15.6%
  - copyright 类别 ASR 为 0%，本地 Llama 整体拒答能力较强但存在薄弱点
- Visual idea: 危害类别 ASR 柱状图作为主视觉，旁边保留关键指标摘要
- Layout role and intent: data evidence
- Required source images:
  - HarmBench Llama official_jbb 危害类别 ASR 图；strict input asset；preserve chart data, axes, labels, legends, colors, and values

    ![危害类型 ASR](../report/image1/危害类型asr.png)

## Slide 8: 实验二结果：多 Judge 暴露更多边界风险

- Key points:
  - 同一 Llama 模型在 multi_judge 下，安全拒绝降至 162 条
  - 越狱成功升至 32 条，另有 6 条需复核
  - 整体 ASR 从 7.5% 上升至 16.0%
  - cybercrime_intrusion、misinformation_disinformation 与 copyright 类别风险上升明显
- Visual idea: 多 Judge 雷达图/Pareto 图与关键数字对比，强调敏感性与分歧
- Layout role and intent: data evidence / comparison
- Required source images:
  - Multi-judge 模型风险雷达图；strict input asset；preserve chart data, labels, legends, colors, and values

    ![Multi Judge 风险雷达图](../report/image2/78928940f6016cd49cbeec001e1a2924.png)

  - Multi-judge 攻击成功样本 Pareto 图；strict input asset；preserve chart data, labels, legends, colors, and values

    ![Multi Judge Pareto](../report/image2/1af3461c2f265ef57a7b9bdff5a6cdc8.png)

## Slide 9: 模型间对比：GPT-5.4 的安全拒答表现

- Key points:
  - GPT-5.4 + official_jbb 单 Judge 下，198 条安全拒绝，0 条越狱成功，2 条需复核
  - 整体 ASR 为 0.0%
  - 与 Llama 单 Judge 的 7.5% ASR 相比，表现出更强安全拒答能力
  - chemical_biological 中 2 条 ambiguous 仍需人工检查
- Visual idea: Llama 与 GPT-5.4 的 ASR 对比卡片，辅以类别矩阵/雷达视觉
- Layout role and intent: comparison / data evidence
- Required source images:
  - Llama official_jbb 模型风险雷达图；optional evidence asset；preserve chart labels and values if used

    ![Llama 风险雷达图](../report/image1/模型风险雷达图.png)

## Slide 10: 结论、不足与未来工作

- Key points:
  - 结论一：Judge 机制影响评测结论，多 Judge 更容易暴露潜在风险和边界案例
  - 结论二：被测模型影响安全结果，GPT-5.4 在相同 Judge 标准下 ASR 更低
  - 局限：数据集覆盖有限，攻击方法以 prompt 修改为主，Judge 可靠性仍需验证
  - 未来方向：扩展 benchmark、引入 PAIR 等自动化攻击、强化可解释报告与复现实验记录
- Visual idea: 三段式总结：Findings、Limitations、Next Steps
- Layout role and intent: summary / closing
- Required source images: none
