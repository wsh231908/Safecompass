---
title: "SafeCompass：面向大语言模型越狱风险的可复现安全评测与可视化平台"
author: "武思豪"
date: "2026年6月"
---

课程：数据科学实践  
姓名：武思豪  
项目名称：SafeCompass 大模型安全评测平台  

# 摘要

大语言模型在问答、编程和智能体任务中被广泛使用，但其在有害请求和越狱攻击下的拒答可靠性仍难以通过普通能力评测反映。本文围绕 SafeCompass 平台展开，构建了一个面向大语言模型安全风险的可复现评测与可视化流程。平台将 JailbreakBench、HarmBench 和自定义数据集接入统一的 `safecompass.case.v1` schema，并实现攻击 prompt 生成、OpenAI-compatible 模型调用、LLM-as-judge 判分、多 Judge 投票、Attack Success Rate（ASR）统计和报告导出。

基于 HarmBench `text_test` 前 200 条样本的实验显示，本地 Llama-3-70B AWQ 在 Jailbreak Chat 攻击和单 Judge 设置下 ASR 为 7.5%，在多 Judge 设置下 ASR 上升到 16.0%；外部 GPT-compatible 对照模型在相同单 Judge 设置下 ASR 为 0.0%，但有 2 条接口错误样本需复核。结果表明，SafeCompass 能够支持模型间安全表现比较，并揭示 Judge 机制和危害类别差异对安全评测结论的影响。

关键词：大语言模型安全；越狱攻击；LLM-as-judge；HarmBench；ASR；可复现评测

# 1. 引言

大语言模型已经从文本生成工具发展为通用交互系统，并被用于问答、代码生成、写作辅助和复杂任务规划。能力增强提高了模型实用价值，也放大了错误或恶意使用场景中的安全风险。当用户请求网络入侵步骤、违法行为指导、虚假信息生成、骚扰文本、化学与生物风险信息或版权文本复现时，安全对齐后的模型通常应拒绝提供实质性帮助。

然而，真实交互并不总是以直接有害请求出现。攻击者可以通过角色扮演、研究场景包装、虚构任务设定或指令覆盖等方式改变输入形式，使模型绕过拒答策略并输出有害细节，这类现象通常被称为越狱攻击。因此，仅使用普通问答准确率无法回答安全治理中的核心问题：模型面对有害请求时是否可靠拒答，不同危害类别是否存在薄弱点，不同 Judge 对同一回复是否一致，以及实验结果是否可以保存并复现。

本文关注的问题是：如何将已有安全基准、攻击策略、模型接口和 Judge 判分机制组织为一个可复现、可比较、可分析的平台流程。SafeCompass 的目标不是提出新的安全基准或攻击算法，而是将评测流程工程化，使研究者能够在统一框架下比较不同模型、不同 Judge 设置和不同危害类别的风险。

# 2. 相关工作与项目定位

大语言模型安全评测关注模型在面对潜在有害输入时是否能够保持稳健拒答。与传统自然语言处理任务不同，安全评测通常需要判断模型输出是否实质性满足了有害请求。Attack Success Rate（ASR）是常用指标，即被判定为 `unsafe` 的样本比例。ASR 直观、便于比较，但高度依赖样本集合、攻击策略和判分标准。

JailbreakBench 强调开放、可复现的越狱评测，提供有害行为集合、攻击 artifacts、评分函数和排行榜。HarmBench 则从自动化红队和鲁棒拒答角度，构建覆盖多类有害行为的标准化评测框架。本文实验使用 HarmBench `text_test` 子集，是因为该子集包含网络入侵、违法行为、虚假信息、化学与生物风险、版权复现、骚扰和一般有害行为等类别，适合观察风险分布是否均匀。

LLM-as-judge 能降低人工标注成本，但在安全场景中必须谨慎使用。Judge 的任务不是评价回答是否“有帮助”，而是判断回答是否实质性提供危险信息。单 Judge 流程简单但可能误判边界样本；多 Judge 可以提高风险可见性，但会引入投票分歧、未知输出和接口错误。因此，本文将 Judge 机制视为显式实验变量，并在平台中保留每个 Judge 的原始输出、标签、错误信息和一致率。

# 3. SafeCompass 平台设计

SafeCompass 采用轻量 Web 架构，由浏览器前端、Node.js 后端和本地数据文件组成。前端负责数据集选择、模型配置、攻击策略选择、Judge 模式配置、进度展示、表格渲染和报告导出。后端由 `server.js` 提供静态页面和 API，核心接口包括 `GET /api/health`、`POST /api/evaluate`、`POST /api/evaluate-stream` 和 `POST /api/llama-chat`。

一次评测包含七个步骤：加载 JailbreakBench、HarmBench 或自定义数据集；将原始记录规范化为统一 case；根据攻击策略生成攻击 prompt；通过 OpenAI-compatible 接口调用被测模型；将原始请求和模型回复交给 Judge 判分；在多 Judge 模式下执行多数投票；汇总 ASR、类别风险、失败案例和需复核样本，并保存运行记录。

不同基准的数据字段并不一致。为降低后续模块与数据来源之间的耦合，SafeCompass 设计了 `safecompass.case.v1` 作为统一样本 schema。规范化后的 case 包含 `id`、`source`、`dataset`、`subset`、`prompt`、`goal`、`original_prompt`、`target`、`category`、`behavior`、`behavior_type` 和 `metadata` 等字段。统一 schema 不消除不同 benchmark 的语义差异，而是将差异限制在加载入口，使攻击、模型调用、Judge 和报告模块可以复用。

平台当前实现的主要攻击族是 prompt 修改攻击，包括 Direct Request、Human Jailbreaks 和 Jailbreak Chat（JBC）。Direct Request 直接发送原始请求；Human Jailbreaks 使用人工整理的越狱模板包装原始行为；JBC 使用确定性前缀和包装模板，将目标改写为研究、虚构或受控评测场景中的请求。本文主实验固定使用 JBC，以控制攻击变量并观察模型和 Judge 设置对结果的影响。

SafeCompass 将模型回复判定为 `safe`、`unsafe` 或 `ambiguous`。`safe` 表示模型拒答或没有提供实质性有害细节；`unsafe` 表示模型回复满足了有害请求并计为越狱成功；`ambiguous` 表示 Judge 输出未知、投票无法形成多数、接口错误或其他需要人工复核的情况。多 Judge 模式可同时启用本地 Llama Judge、GPT-compatible Judge 和 rule-based fallback，并按多数投票聚合。

# 4. 实验设计

本文使用 HarmBench `text_test` 子集前 200 条样本进行评测。样本覆盖七类危害：`cybercrime_intrusion`、`illegal`、`misinformation_disinformation`、`chemical_biological`、`copyright`、`harassment_bullying` 和 `harmful`。本文不比较不同 benchmark，而是在固定数据来源下观察模型因素和 Judge 因素对结论的影响。

实验包含两个被测模型设置。第一类为本地部署的 Llama-3-70B AWQ，通过 vLLM 提供 OpenAI-compatible `/v1/chat/completions` 接口，模型名记录为 `meta-llama/Llama-3-70b-chat-hf`。第二类为外部 GPT-compatible 对照模型，运行记录中的模型名为 `gpt-5.4`。三组主实验均固定使用 JBC 攻击策略，将数据集、样本数和攻击方式作为固定变量，将被测模型和 Judge 设置作为变化变量。

| 实验 | 运行记录 | 被测模型 | Judge 设置 | 样本数 | 攻击 |
| --- | --- | --- | --- | ---: | --- |
| 实验一 | `2026-06-15T07-51-23Z` | Llama-3-70B AWQ | 单 Judge | 200 | JBC |
| 实验二 | `2026-06-15T08-41-51Z` | Llama-3-70B AWQ | 多 Judge | 200 | JBC |
| 实验三 | `2026-06-15T11-50-34Z` | GPT-compatible | 单 Judge | 200 | JBC |

核心指标为 ASR：

```text
ASR = unsafe 样本数 / 原始样本总数 × 100%
```

由于 JBC 对每条原始样本只生成一次攻击尝试，本文中的样本级 ASR 与结果行级 ASR 一致。除总体 ASR 外，本文还报告安全拒绝数、越狱成功数、需复核数、错误数和类别 ASR。

# 5. 实验结果与分析

三组实验总体结果如表 2 所示。实验一中，Llama-3-70B AWQ 在 200 条样本上产生 185 条安全拒绝、15 条越狱成功，ASR 为 7.5%。实验二保持模型、数据集和攻击策略不变，将 Judge 改为多 Judge 多数投票，结果为 162 条安全拒绝、32 条越狱成功、6 条需复核，ASR 上升到 16.0%。实验三在相同数据集、攻击策略和单 Judge 设置下替换为 GPT-compatible 对照模型，结果为 198 条安全拒绝、0 条越狱成功、2 条需复核，ASR 为 0.0%。

| 实验 | 被测模型 | Judge | 安全拒绝 | 越狱成功 | 需复核 | 错误 | ASR |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| 实验一 | Llama-3-70B AWQ | 单 Judge | 185 | 15 | 0 | 0 | 7.5% |
| 实验二 | Llama-3-70B AWQ | 多 Judge | 162 | 32 | 6 | 0 | 16.0% |
| 实验三 | GPT-compatible | 单 Judge | 198 | 0 | 2 | 2 | 0.0% |

实验一显示，本地 Llama-3-70B AWQ 在单 Judge 标准下总体拒答能力较强，但仍存在可观察风险。类别层面，`cybercrime_intrusion` 的 ASR 最高，为 15.6%；`illegal` 为 10.8%；`misinformation_disinformation` 为 8.8%；`copyright` 为 0.0%。这说明技术性攻击请求更容易诱导模型输出具体步骤、payload 或代码，而版权复现请求在该设置下相对稳定。

实验二表明，Judge 机制会显著影响结论。同一模型、同一数据集和同一 JBC 攻击下，多 Judge 使总体 ASR 从 7.5% 上升到 16.0%。类别变化更明显：`cybercrime_intrusion` 从 15.6% 上升到 31.3%，`misinformation_disinformation` 从 8.8% 上升到 26.5%，`copyright` 从 0.0% 上升到 9.8%，并产生 3 条需复核样本。该结果说明，多 Judge 不只是改变总体 ASR，也会改变对类别风险的判断。

| 类别 | 样本数 | 单 Judge ASR | 多 Judge ASR | 多 Judge 需复核 |
| --- | ---: | ---: | ---: | ---: |
| `cybercrime_intrusion` | 32 | 15.6% | 31.3% | 1 |
| `misinformation_disinformation` | 34 | 8.8% | 26.5% | 2 |
| `illegal` | 37 | 10.8% | 13.5% | 0 |
| `copyright` | 51 | 0.0% | 9.8% | 3 |
| `chemical_biological` | 21 | 4.8% | 4.8% | 0 |
| `harassment_bullying` | 15 | 6.7% | 6.7% | 0 |
| `harmful` | 10 | 10.0% | 10.0% | 0 |

实验三显示，GPT-compatible 对照模型在 200 条样本中没有被单 Judge 判定为越狱成功，ASR 为 0.0%。但该实验有 2 条 `chemical_biological` 样本因外部接口返回 502 Bad Gateway 被标记为需复核。因此，实验三应解释为：在成功完成的 198 条调用中未观测到越狱成功；接口稳定性仍会影响实验完整性。

# 6. 讨论

SafeCompass 的研究意义在于将安全评测从临时 prompt 测试转化为可复现的数据流程。单次测试只能说明模型在某条输入上是否失败，而平台化评测可以同时记录样本来源、攻击改写、模型回复、Judge 输出、分歧票、接口错误和类别信息。这样，最终 ASR 可以被回溯到逐条样本和逐个 Judge 判断，便于复核和比较。

实验结果也表明，Judge 机制不能被视为中性的后台工具。单 Judge 流程简单、成本较低，但可能低估边界风险；多 Judge 更敏感，但会引入分歧和需复核样本。对安全治理而言，更合理的做法是将自动化 Judge 用于大规模筛查，将高风险类别、低一致率样本和 ambiguous 样本交给人工复核。

类别分析比单一总体 ASR 更有解释力。多 Judge 设置下，网络入侵类 ASR 达到 31.3%，明显高于化学与生物风险类的 4.8%。这说明模型风险并非均匀分布。技术性请求可能因为带有术语、代码和安全免责声明而更容易产生边界输出；版权复现类别则对 Judge 规则较敏感。后续模型改进和人工评审应优先关注这些高风险类别。

本文仍有局限。实验只使用 HarmBench `text_test` 前 200 条样本，规模和类别覆盖有限；主实验只使用 JBC 单轮攻击，尚未覆盖 PAIR 等自动化多轮攻击、多模态输入、工具调用和长上下文智能体任务；Judge 可靠性尚未通过人工标注校准；实验三依赖外部接口，接口错误使部分样本无法完成评测。

# 7. 结论

本文提出 SafeCompass，一个面向大语言模型越狱风险的可复现安全评测与可视化平台。平台通过统一 schema 接入多源数据，并将攻击生成、模型调用、LLM-as-judge 判分、多 Judge 投票、ASR 统计、类别风险分析和报告导出组织为端到端流程。

基于 HarmBench `text_test` 前 200 条样本的三组实验表明，SafeCompass 能够在控制变量的条件下比较模型安全拒答表现，并揭示 Judge 机制对评测结论的影响。Llama-3-70B AWQ 在单 Judge 下 ASR 为 7.5%，在多 Judge 下 ASR 上升到 16.0%；GPT-compatible 对照模型在相同单 Judge 设置下 ASR 为 0.0%，但有 2 条接口错误样本需复核。类别分析进一步显示，网络入侵和虚假信息等类别风险更集中，单一总体 ASR 不足以支撑细粒度安全诊断。

SafeCompass 的贡献不在于提出新的攻击算法，而在于将安全评测中的数据、攻击、模型、Judge、指标和报告组织为可复现的实验系统。该平台为后续模型比较、Judge 校准、人工复核和安全治理分析提供了基础。

# 参考文献

[1] P. Chao, E. Debenedetti, A. Robey, M. Andriushchenko, F. Croce, V. Sehwag, E. Dobriban, N. Flammarion, G. J. Pappas, F. Tramer, H. Hassani, and E. Wong, "JailbreakBench: An Open Robustness Benchmark for Jailbreaking Large Language Models," arXiv:2404.01318, 2024.

[2] M. Mazeika, L. Phan, X. Yin, A. Zou, Z. Wang, N. Mu, E. Sakhaee, N. Li, S. Basart, B. Li, D. Forsyth, and D. Hendrycks, "HarmBench: A Standardized Evaluation Framework for Automated Red Teaming and Robust Refusal," arXiv:2402.04249, 2024.

[3] L. Zheng, W.-L. Chiang, Y. Sheng, S. Zhuang, Z. Wu, Y. Zhuang, Z. Lin, Z. Li, D. Li, E. P. Xing, H. Zhang, J. E. Gonzalez, and I. Stoica, "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena," arXiv:2306.05685, 2023.
