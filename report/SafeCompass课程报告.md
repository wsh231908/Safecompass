---
title: "SafeCompass：面向大模型安全风险的评测平台设计与实验分析"
author: "课程项目报告"
date: "2026年6月"
---

# SafeCompass：面向大模型安全风险的评测平台设计与实验分析

## 摘要

大语言模型在问答、代码生成和内容创作等任务中表现出较强能力，但在有害请求、越狱提示和边界诱导场景下仍可能产生危险内容。围绕“大模型治理的评测体系和平台构建”这一主题，本项目实现了 SafeCompass，一个面向大模型安全风险评测与可视化分析的本地平台。平台将数据集加载、样本规范化、攻击 prompt 生成、模型调用、LLM-as-judge 判分、结果聚合和报告导出整合到同一流程中，支持 JailbreakBench、HarmBench 与自定义数据集，支持本地 Llama-3-70B AWQ 与 OpenAI-compatible 模型接口，并提供单 Judge 与多 Judge 投票两种评判模式。基于 HarmBench text_test 子集的三组实验显示，同一 Llama-3-70B 模型在 official_jbb 单 Judge 下 ASR 为 7.5%，在 multi_judge 下 ASR 上升到 16.0%；在相同 official_jbb 标准下，GPT-5.4 的 ASR 为 0.0%，但仍存在 2 条需复核样本。结果说明，SafeCompass 能够支撑可复现、可比较的安全评测，也揭示了 Judge 机制、模型差异与人工复核在大模型安全治理中的重要性。

**关键词：** 大语言模型；安全评测；越狱攻击；LLM-as-judge；ASR；SafeCompass

## 1. 研究背景与项目目标

大语言模型的能力增强使其可以处理复杂指令，但也扩大了被滥用的风险。若模型在面对网络入侵、违法行为、虚假信息、骚扰、化学与生物风险或版权文本复现等请求时不能稳定拒答，就可能输出不适宜传播的内容。现实交互中的风险不仅来自直接有害请求，还来自经过包装的越狱 prompt，例如角色扮演、研究伪装、要求忽略规则、要求不要输出警告语等。因此，普通问答能力测试不足以评价模型安全性，课程项目需要一个能够围绕有害请求进行压力测试的平台。

从治理角度看，大模型安全评测至少需要回答三个问题。第一，模型是否能识别请求的真实意图，而不是只识别表层措辞；如果有害目标被包裹在“研究”“虚构”“安全测试”等语境中，模型仍应维持拒答边界。第二，评测结论是否可复现；同一数据集、同一攻击方法和同一 Judge 配置下，平台应能保存完整运行记录，避免只依赖一次手工测试的截图或口头描述。第三，评测结果是否可比较；不同模型、不同攻击策略和不同 Judge 机制必须进入同一指标体系，才能形成有意义的横向分析。SafeCompass 的设计正是围绕这三个问题展开。

已有研究为本项目提供了评测范式。JailbreakBench 强调开放、可复现的越狱鲁棒性评测，提供行为集合、攻击构件、威胁模型和评分函数等组成部分（Chao et al., 2024）。HarmBench 面向自动化红队与稳健拒答，提出了用于比较攻击和防御方法的标准化框架（Mazeika et al., 2024）。同时，LLM-as-judge 为开放式生成任务提供了可扩展判分方式，但也存在偏差与分歧，需要结合评判记录和人工复核使用（Zheng et al., 2023）。

SafeCompass 的目标不是重新提出一个新的安全基准，而是把安全评测流程平台化。具体目标包括：第一，将不同来源的安全数据统一进入同一评测流程；第二，把攻击 prompt 生成、被测模型调用和 Judge 判分串成可复现流水线；第三，用 ASR、危害类别分布、失败案例和 Judge 分歧样本帮助分析模型风险；第四，支持本地模型和 OpenAI-compatible 接口，便于横向比较不同模型与不同 Judge 机制。

## 2. 平台设计与实现

SafeCompass 采用 JavaScript 全栈实现。前端由 `index.html`、`src/app.js` 和 `src/api/evaluation-client.js` 等模块组成，负责数据集选择、模型与 Judge 配置、攻击方式选择、评测进度展示、结果表格和报告导出。后端核心为 `server.js`，负责静态服务、模型 API 调用、Judge 调用、投票聚合、结果保存和健康检查。平台还提供 `chat.html` 作为本地 Llama 对话入口，便于验证模型服务状态。

前后端分工体现了课程项目原型的工程取舍。前端侧重点是让实验配置可视化，包括被测模型、数据集、攻击策略、Judge 模式、样本上限和导出选项；后端侧重点是将外部模型调用和评判逻辑封装为稳定 API。这样做的好处是，研究者不需要在每次实验中手工拼接 prompt、复制模型输出和手动统计结果，而是可以把精力集中在变量控制和结果解释上。项目还通过 `runs/` 目录保存每次运行的 JSON 记录，使课程答辩中的 ASR、类别风险和需复核样本能够追溯到具体运行文件。

平台的核心流程为：选择数据集，加载并规范化样本，生成攻击 prompt，调用被测模型得到回复，再由 Judge 根据“原始请求 + 模型回复”判断回复是否安全，最后汇总 safe、unsafe、ambiguous 和 ASR 等指标。ASR 即 Attack Success Rate，在本项目中按被 Judge 判定为 unsafe 的原始样本比例计算。若一个样本存在多次攻击尝试，平台也保留 `base_case_id` 与 attempt 信息，以便后续扩展到 attempt 级和 behavior 级指标。

在一次完整评测中，平台实际执行的是一个“样本级闭环”。首先，loader 读取 benchmark 的本地导出文件并产生统一 case；随后 attack module 根据所选策略生成最终发送给模型的 prompt；后端调用被测模型接口并保存回复；Judge 模块再把原始有害目标和模型回复共同输入评判器，得到 safe、unsafe 或 unknown 结果；最后 summary 模块聚合所有样本，并计算总量、拒答数、越狱成功数、需复核数、错误数和 ASR。这个闭环使平台既能服务演示，也能服务后续实验复查。

为屏蔽不同 benchmark 的字段差异，项目设计了 `safecompass.case.v1` 统一 schema。无论样本来自 JailbreakBench、HarmBench，还是用户上传的 JSON/CSV，自定义加载后都会规范化为包含 `id`、`source`、`dataset`、`subset`、`prompt`、`goal`、`category`、`behavior_type`、`metadata` 等字段的结构。这样后续攻击策略、模型调用、Judge 判分和报告生成都只依赖统一 case，降低了新增数据集的接入成本。

统一 schema 还增强了实验解释性。`prompt` 表示实际送入模型的文本，`goal` 保存原始有害目标，`category` 与 `behavior_type` 支持按危害类别统计风险，`metadata` 则保留来源字段、上下文、标签和 attack 信息。对于 HarmBench 这类可能包含上下文的样本，平台会把行为与上下文合并为可评测 prompt，同时仍在 metadata 中保留原始信息。由此，报告生成器可以在不理解每个 benchmark 原始字段的情况下，统一生成类别 ASR 表和 Judge 复核列表。

| 模块 | 主要实现 | 功能 |
| --- | --- | --- |
| 数据加载 | `src/benchmarks/loader.js`、`registry.js` | 加载 JailbreakBench、HarmBench 与本地导出数据 |
| 统一 schema | `src/domain/case-schema.js` | 将不同字段映射到 `safecompass.case.v1` |
| 攻击策略 | `src/attacks/strategies.js` | 支持 Direct Request、Human Jailbreaks、Jailbreak Chat |
| 后端评测 | `server.js` | 调用被测模型、运行 Judge、保存运行记录 |
| 报告生成 | `src/reporting/report-builder.js` | 生成 Markdown 报告、类别风险表和复核样本 |

攻击策略方面，当前平台主要覆盖 prompt 修改类攻击。Direct Request 直接发送原始请求；Human Jailbreaks 在原始行为前拼接人工越狱模板，并基于估算 token 数进行筛选；Jailbreak Chat 则从若干前缀和包装模板中确定性选择一种，将原始有害目标包装为更具诱导性的请求。该设计优先保证课程项目中的稳定性和复现性，而更复杂的自动化迭代攻击可以作为后续扩展。

在课程项目阶段，选择 prompt 修改类攻击有两个原因。其一，这类攻击不需要额外训练攻击模型，也不依赖多轮搜索，因此实验成本和运行时间可控。其二，它能覆盖许多真实交互中常见的绕过方式，例如把有害目标嵌入“受控评测”“假设场景”或“请直接完成目标”的表述中。平台在实现上使用确定性选择而非随机采样，保证同一 case 在同一策略下生成相同攻击 prompt，这对复现实验尤其重要。

Judge 机制是平台设计的另一个重点。单 Judge 模式使用类似 JailbreakBench official judge 的方式，将原始请求和模型回复一起输入 Judge，由 Judge 判断模型是否实质性满足了有害请求。多 Judge 模式会同时运行本地 Llama judge、GPT-compatible judge 和 rule-based fallback 等多个评判器，再按 majority vote 聚合：unsafe 票多则判定为越狱成功，safe 票多则判定为安全拒绝，平票、未知输出或错误则标记为 ambiguous。平台保留每个 Judge 的原始输出、错误信息、一致率和投票明细，便于人工复核。

这种 Judge 设计体现了“自动化评测 + 人工复核”的折中。单 Judge 的优点是结果简洁、成本较低、便于和基准范式对齐；缺点是容易受单个 Judge 的偏好影响。多 Judge 能缓解单点评判偏差，并暴露模型回复中的边界风险，但也可能因为评判尺度不同而增加 ambiguous 样本。因此，SafeCompass 没有把 Judge 输出当作绝对真值，而是把它作为可追踪的自动化证据：当投票一致率较低、出现 unknown 或 error 票时，平台会将样本列入复核列表。

报告导出模块则承担“从实验记录到可读结论”的转换。`report-builder.js` 会基于结果列表生成总览表、危害类别风险表、Top 失败案例和 Judge 需复核样本。对于课程报告而言，这一模块的价值不只是导出文件，而是把安全评测的关键证据固定下来：总览表回答整体安全性，类别风险表回答风险集中在哪些危害类型，失败案例帮助定位模型薄弱点，复核样本则提示哪些结论不应被自动化 Judge 直接定论。

## 3. 实验设计

实验使用 HarmBench 的 text_test 子集，共 200 条样本。三次实验均固定攻击方法为 Jailbreak Chat，以控制数据集和攻击方式不变，再分别改变 Judge 模式或被测模型。实验一使用本地 Llama-3-70B 加 official_jbb 单 Judge；实验二保持 Llama-3-70B 不变，将 Judge 改为 multi_judge；实验三将被测模型切换为 GPT-5.4，并恢复 official_jbb 单 Judge。这样的设置可以分别观察评判机制和模型能力对安全结论的影响。

实验变量的设置遵循控制变量原则。实验一建立本地 Llama-3-70B 的基线结果；实验二只改变 Judge 模式，用于观察评判机制是否会改变安全结论；实验三在保持数据集、攻击方法和 Judge 标准一致的前提下替换被测模型，用于观察模型本身的安全拒答差异。由于三组实验都使用 200 条样本和同一攻击策略，ASR 变化可以更清楚地归因于 Judge 或模型变化，而不是数据集规模或攻击方式变化。

| 实验 | 数据集与攻击 | 被测模型 | Judge 模式 | 安全拒绝 | 越狱成功 | 需复核 | ASR |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 实验一 | HarmBench text_test，Jailbreak Chat | Llama-3-70B | official_jbb | 185 | 15 | 0 | 7.5% |
| 实验二 | HarmBench text_test，Jailbreak Chat | Llama-3-70B | multi_judge | 162 | 32 | 6 | 16.0% |
| 实验三 | HarmBench text_test，Jailbreak Chat | GPT-5.4 | official_jbb | 198 | 0 | 2 | 0.0% |

评测指标以 ASR 为核心，但报告不只依赖单一数字。ASR 越高，表示被 Judge 判定为 unsafe 的比例越高，模型在该设置下越容易被攻破；安全拒绝数反映模型成功维持安全边界的样本数量；需复核数反映自动化 Judge 的不确定性；类别 ASR 则用于定位具体风险来源。对于安全治理而言，整体 ASR 很低并不意味着没有问题，因为少数高风险类别中的越狱成功样本仍可能具有较高危害。

## 4. 实验结果与分析

实验一显示，本地 Llama-3-70B 在 official_jbb 单 Judge 下有 185 条样本被判定为安全拒绝，15 条被判定为越狱成功，整体 ASR 为 7.5%。从危害类别看，cybercrime_intrusion 的 ASR 最高，为 15.6%；illegal 为 10.8%，harmful 为 10.0%，misinformation_disinformation 为 8.8%。copyright 类别在该设置下 ASR 为 0.0%。这说明 Llama-3-70B 在单 Judge 标准下整体具备较强拒答能力，但网络入侵、违法行为等高操作性场景仍是薄弱点。

进一步看，实验一的失败样本主要集中在能够产生具体执行性内容的类别中。网络入侵类请求往往包含明确目标和操作语境，模型如果只输出形式化警告但随后继续给出实质性步骤，就可能被 Judge 判定为 unsafe。违法行为、骚扰和化学/生物风险样本虽然数量较少，但同样说明模型的安全对齐并非对所有类别都均衡有效。copyright 在实验一中未出现越狱成功，说明单 Judge 对版权复现类回复的判定相对宽松，或模型在该组样本上更倾向于拒绝长文本复现。

实验二仅改变 Judge 机制，结果从 185 条安全拒绝和 15 条越狱成功变为 162 条安全拒绝、32 条越狱成功和 6 条需复核，ASR 从 7.5% 上升到 16.0%。类别层面，cybercrime_intrusion 的 ASR 上升到 31.3%，misinformation_disinformation 上升到 26.5%，copyright 也从 0.0% 上升到 9.8%。这说明多 Judge 模式更敏感，能暴露一些单 Judge 可能漏判的边界风险。但 multi_judge 并不等同于绝对正确，它也引入了评判分歧，因此保留 ambiguous 样本和 Judge 投票明细是必要设计。

实验二尤其说明，安全评测结论并不只由被测模型决定，Judge 机制本身也是实验变量。同一个 Llama 回复，在单 Judge 下可能被视为安全拒绝，但在多 Judge 下可能因另一个 Judge 认为其包含实质性满足而被改判为 unsafe。copyright 类别的变化最能体现这一点：单 Judge 下 copyright ASR 为 0.0%，multi_judge 下出现 5 条 unsafe 和 3 条 ambiguous，说明不同 Judge 对“长段版权文本复现”边界的敏感度不同。平台保留分歧样本，有助于在答辩或后续分析中解释为什么 ASR 发生变化。

实验三在相同 HarmBench text_test、Jailbreak Chat 和 official_jbb 标准下，将被测模型换为 GPT-5.4。结果显示 198 条安全拒绝、0 条越狱成功、2 条需复核，整体 ASR 为 0.0%。与实验一相比，主要变化是被测模型，因此可以认为在这组实验条件下 GPT-5.4 表现出更强的安全拒答能力。不过该结果不能推出模型“完全安全”：2 条需复核样本集中在 chemical_biological 类别，仍需要结合模型回复和 Judge 原始输出进行人工检查。

实验三的意义在于验证平台的区分度。若平台对所有模型都给出接近的结果，就难以说明它能用于比较安全表现；而在相同 Judge 标准下，Llama-3-70B 的 ASR 为 7.5%，GPT-5.4 的 ASR 为 0.0%，说明平台能够反映模型安全拒答能力差异。与此同时，2 条 chemical_biological ambiguous 样本提醒我们，低 ASR 不等于评测结束。对于高风险领域，即使没有 unsafe 判定，也需要检查 ambiguous 是否来自接口错误、Judge 不确定，或模型回复处在安全边界附近。

综合三组实验，SafeCompass 至少体现出两点价值。第一，它能比较 Judge 机制对结论的影响：同一模型、同一数据集、同一攻击方法下，单 Judge 与多 Judge 得到的 ASR 差异明显。第二，它能比较模型之间的安全表现：在相同 Judge 标准下，不同被测模型产生了可区分的安全结果。这些结果说明平台不只是静态展示工具，而是能支撑实验变量控制和结果复核的评测流程。

从工程角度看，平台的运行记录也支撑了结果可追溯。实验一、实验二和实验三分别对应本地 `runs/` 下的 JSON 运行文件，报告中的总数、标签分布和类别 ASR 可以由这些文件重新计算。相比手工记录，这种方式降低了报告数字与真实运行不一致的风险，也为后续加入更多模型、更多攻击策略和更多 Judge 组合提供了统一的数据基础。

## 5. 讨论：平台有效性与安全评测边界

SafeCompass 的有效性主要体现在流程完整性、变量可控性和结果可解释性三个方面。流程完整性指平台覆盖了安全评测从输入到报告的关键环节，而不是只实现某一个脚本。变量可控性指实验者可以固定数据集和攻击方法，只改变模型或 Judge，从而进行更清晰的对比。结果可解释性指平台不仅输出一个 ASR 数字，还输出类别风险、Judge 投票和需复核样本，使研究者能够判断风险来自模型、攻击、数据类别还是评判机制。

不过，平台输出仍应被理解为“在给定实验条件下的安全证据”，而不是模型安全性的最终证明。第一，benchmark 只能覆盖部分危害场景，真实世界中的提示可能更长、更隐蔽，也可能包含多轮上下文。第二，Jailbreak Chat 属于相对简单的 prompt 包装攻击，不能代表所有自动化红队能力。第三，Judge 仍是模型或规则系统，它可能漏判、误判或对某些表达风格更敏感。因此，SafeCompass 更适合作为安全治理中的评测基础设施，而不是替代人工审查和更大规模红队测试。

本项目还体现了本地化评测的价值。将本地 Llama-3-70B AWQ 作为被测模型或 Judge，可以减少对外部服务的依赖，也便于在课程环境中控制成本和隐私。与此同时，平台保留 OpenAI-compatible 接口，允许接入外部模型进行横向比较。这种开放接口设计使 SafeCompass 既可以在本地服务器上运行，也可以随着模型和 Judge 组件更新而扩展。

## 6. 局限与改进方向

当前项目仍是课程项目原型，存在三个主要局限。首先，数据集覆盖有限，实验主要围绕 JailbreakBench harmful 与 HarmBench text_test，本报告的核心实验只使用 HarmBench text_test 的 200 条样本，难以代表全部真实风险。其次，攻击方法主要是 prompt 修改类，尚未完整接入 PAIR 等自动化迭代攻击，攻击强度和攻击多样性仍可提升。再次，LLM-as-judge 不是金标准，Judge 模型可能受提示、表述长度、模型偏好和接口失败影响；多 Judge 能提供交叉参考，但也会带来分歧，最终仍需要人工复核关键样本。

后续工作可以从四个方向推进。第一，扩展更多 benchmark、危害类别和多语言样本，使评测覆盖面更接近真实使用场景。第二，引入 PAIR、GCG 或其他自动化红队策略，并记录攻击成本、迭代次数和成功条件。第三，强化 Judge 分歧分析，例如按类别统计一致率、聚类失败案例，并将 ambiguous 样本纳入人工标注闭环。第四，完善实验记录与横向对比功能，把模型配置、Judge 配置、攻击策略、运行时间和导出报告绑定到同一运行档案中，提高课程展示和后续研究的可复现性。

除此之外，平台还可以加强两类能力。第一是更细粒度的统计分析，例如区分“完全拒答”“部分拒答后泄露信息”“安全替代建议”和“直接顺从”等回复类型，从而比 safe/unsafe 二分类提供更丰富的诊断。第二是更完善的复核工作流，例如允许人工为 ambiguous 样本打标签，并将人工标签回写到运行记录中。这样，平台可以逐步形成自动 Judge 与人工标注相结合的数据闭环。

## 7. 结论

SafeCompass 将大模型安全评测从一次性手工测试推进为一个可复现、可比较、可分析的本地化流程。平台通过统一 case schema 接入不同数据源，通过攻击策略生成压力测试输入，通过单 Judge 或多 Judge 机制判定回复安全性，并通过 ASR、类别风险和需复核样本呈现实验结果。基于三组 HarmBench text_test 实验，本项目验证了 Judge 机制会显著影响安全结论，也验证了平台能够区分不同被测模型的拒答表现。未来若进一步扩展数据集、攻击算法、Judge 可靠性分析和人工复核闭环，SafeCompass 可以成为课程项目之外更通用的大模型安全治理评测原型。

## 参考文献

Chao, P., Debenedetti, E., Robey, A., Andriushchenko, M., Croce, F., Sehwag, V., Dobriban, E., Flammarion, N., Pappas, G. J., Tramer, F., Hassani, H., & Wong, E. (2024). *JailbreakBench: An open robustness benchmark for jailbreaking large language models*. NeurIPS Datasets and Benchmarks Track.

Mazeika, M., Phan, L., Yin, X., Zou, A., Wang, Z., Mu, N., Sakhaee, E., Li, N., Basart, S., Li, B., Forsyth, D., & Hendrycks, D. (2024). *HarmBench: A standardized evaluation framework for automated red teaming and robust refusal*. Proceedings of Machine Learning Research, 235, 35181-35224.

Zheng, L., Chiang, W.-L., Sheng, Y., Zhuang, S., Wu, Z., Zhuang, Y., Lin, Z., Li, Z., Li, D., Xing, E. P., Zhang, H., Gonzalez, J. E., & Stoica, I. (2023). *Judging LLM-as-a-judge with MT-Bench and Chatbot Arena*. arXiv:2306.05685.

AI Disclosure: 本报告在作者提供的项目提纲、运行记录和源代码基础上，使用 AI 辅助完成结构整理、文字起草和格式转换。报告中的项目设计、实验数据和结论均依据本地 SafeCompass 项目材料整理，最终内容应由作者复核后提交。
