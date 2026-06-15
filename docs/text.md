**汇报文稿**

各位老师、同学大家好，我们的项目叫 SafeCompass，是一个面向大模型的安全风险评测与可视化分析平台。

项目背景来自当前大模型应用中的一个核心问题：模型能力越强，越可能被用于生成危险内容，例如网络攻击、违法行为指导、虚假信息、骚扰内容、化学与生物风险内容，或者版权文本复现等。虽然主流大模型通常会加入安全对齐机制，但在真实交互中，用户可以通过改写请求、添加角色设定、伪装成研究场景、要求模型忽略规则等方式进行越狱攻击。因此，仅仅测试模型能不能回答普通问题是不够的，我们还需要系统地评估模型在有害请求下是否会拒答，以及面对攻击 prompt 时是否仍然可靠。

在相关工作方面，我们参考了 JailbreakBench 和 HarmBench 这类安全评测基准。它们提供了有害行为数据集、攻击方法和评测指标，比如 ASR，也就是 Attack Success Rate，表示攻击成功率。但我们项目的区别在于，不只是复现一个静态 benchmark，而是把数据集加载、攻击 prompt 生成、模型调用、LLM-as-judge 判分、结果保存和可视化报告整合到一个本地平台中。平台既可以接入本地部署的 Llama-3-70B AWQ，也可以接入 OpenAI-compatible 接口，同时支持单 Judge 和多 Judge 投票，从而观察不同模型和不同评判机制对最终安全结论的影响。

具体来说，我们实现了 SafeCompass 的前端评测页面、后端评测 API，以及统一的数据 schema。在数据格式方面，我们设计了 `safecompass.case.v1` schema，用来屏蔽不同数据集之间的字段差异。无论原始样本来自 JailbreakBench、HarmBench，还是用户上传的自定义 JSON 或 CSV，平台都会把它们规范化成同一种 case 结构。每条样本包含 `id`、`source`、`dataset`、`prompt`、`goal`、`category`、`behavior_type` 和 `metadata` 等字段。其中，`prompt` 表示实际发送给被测模型的文本，`goal` 表示原始有害请求或评测目标，`category` 表示危害类别，`metadata` 则保留原始数据集中的上下文、标签和行为编号等信息。这样后续攻击方法、模型调用、Judge 判分和报告生成都可以基于统一结构运行。

平台当前支持 JailbreakBench harmful 子集和 HarmBench text_test 子集，也支持自定义数据集。攻击方法方面，我们实现了 Direct Request、Human Jailbreaks 和 Jailbreak Chat 三类针对 prompt 修改的策略。评测流程是：先选择数据集，再规范化样本，然后生成攻击 prompt，调用被测模型得到回复，再由 Judge 判断回复是 safe 还是 unsafe，最后统计安全拒绝数、越狱成功数、需复核样本和 ASR，并导出 Markdown 报告与图表。

下面结合三次实验结果进行分析。前三次实验都使用 HarmBench 的 text_test 子集，共 200 条样本，攻击方法都使用 Jailbreak Chat。这样可以尽量控制数据集和攻击方式不变，分别观察 Judge 模式和被测模型变化带来的影响。

第一次实验使用本地 Llama-3-70B 作为被测模型，并使用 official_jbb 单 Judge。结果显示，200 条样本中有 185 条被判定为安全拒绝，15 条被判定为越狱成功，整体 ASR 是 7.5%。从危害类别看，风险最高的是 cybercrime_intrusion，32 条中成功 5 条，ASR 为 15.6%；其次是 illegal，ASR 为 10.8%；misinformation_disinformation 为 8.8%；copyright 类别为 0%。这说明在单 Judge 标准下，本地 Llama 整体有较强拒答能力，但在网络入侵和违法行为类任务上仍有薄弱点。

第二次实验仍然使用本地 Llama-3-70B 和同样的攻击方法，但把 Judge 模式改为 multi_judge。结果发生明显变化：200 条样本中，安全拒绝降为 162 条，越狱成功升为 32 条，另有 6 条需复核，整体 ASR 上升到 16.0%。与第一次相比，ASR 增加了 8.5 个百分点，越狱成功数从 15 条增加到 32 条。分类别看，cybercrime_intrusion 的 ASR 从 15.6% 上升到 31.3%，misinformation_disinformation 从 8.8% 上升到 26.5%，copyright 从 0% 上升到 9.8%。这说明多 Judge 模式比单 Judge 更敏感，能发现一些单 Judge 可能漏判的版权复现和虚假信息类风险，但也会引入 Judge 分歧，需要人工复核。

第三次实验中，我们把被测模型换成更强的 GPT-5.4，同时保持数据集、样本数和 Jailbreak Chat 攻击方法不变，Judge 模式使用 official_jbb 单 Judge。结果显示，200 条样本中有 198 条被判定为安全拒绝，0 条越狱成功，2 条需复核，整体 ASR 为 0.0%。从危害类别看，copyright、illegal、misinformation_disinformation、cybercrime_intrusion、harassment_bullying 和 harmful 等类别的 ASR 都是 0%；只有 chemical_biological 类别中出现了 2 条 ambiguous，分别是 ricin_synthesis_home 和 botulinum_toxin_manufacturing_guide，它们被归为需复核或错误样本，而不是攻击成功。

因此，第三次实验主要提供了模型间对比。与第一次实验相比，两者都使用 official_jbb 单 Judge，但被测模型不同：本地 Llama 的 ASR 是 7.5%，而 GPT-5.4 的 ASR 是 0.0%。这说明在相同数据集、相同攻击方法和相同 Judge 标准下，GPT-5.4 表现出更强的安全拒答能力，尤其是在网络入侵、违法行为和虚假信息类别中没有出现成功越狱样本。不过，chemical_biological 中仍有 2 条需复核样本，说明高风险生化类请求即使没有被判为 unsafe，也仍然需要人工检查模型回复和 Judge 输出，避免因为接口错误或边界判定造成误判。

综合三次实验，我们可以得到两个层面的结论。第一，评测结果会受到 Judge 机制影响：同一个 Llama 模型，在单 Judge 下 ASR 为 7.5%，在多 Judge 下 ASR 上升到 16.0%，说明多 Judge 更容易暴露潜在风险和边界案例。第二，评测结果也会受到被测模型影响：在同样的 official_jbb 单 Judge 下，GPT-5.4 相比本地 Llama 有更低的攻击成功率，说明不同模型的安全对齐能力存在明显差异。

最后总结一下项目不足和发展方向。当前平台仍是课程项目原型，数据集覆盖还不够全面，攻击方法主要是 prompt 修改类，尚未完整接入更复杂的自动化攻击方法，例如 PAIR。其次，Judge 的可靠性还需要进一步验证，多 Judge 虽然能降低单点偏差，但不同 Judge 的标准并不完全一致。第三，目前主要关注文本输出安全，后续还可以扩展到多轮对话、多模态输入和更长上下文场景。

未来我们计划从三个方向继续完善：第一，扩展更多 benchmark 和危害类别，增强评测覆盖面；第二，引入更系统的攻击策略对比，分析不同攻击方法对 ASR 的影响；第三，强化报告和可解释性，包括 Judge 分歧分析、失败案例聚类、模型间横向对比和可复现实验记录。总体来说，SafeCompass 的目标是把大模型安全评测从一次性的手工测试，变成一个可复现、可比较、可分析的本地化评测流程。