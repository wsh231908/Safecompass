我建议后续不要先堆功能，而是按“评测可信度 -> 数据覆盖 -> 攻击方法 -> 报告与部署”推进。这个项目最核心的价值是：别人能相信你跑出来的 ASR 结果。

**第一阶段：把评测闭环做稳**
现在流程已经能跑，但还需要工程化：

1. 拆分“被测模型”和“Judge 模型”配置  
   现在前端默认都指向本地 Llama。建议把 UI 和请求体改成两个明确配置：
   - Target Model：被评测模型
   - Judge Model：负责判定 safe/unsafe 的模型

   主要改：
   - [src/app.js](/home/u2023202105/Safecompass/src/app.js)
   - [server.js](/home/u2023202105/Safecompass/server.js)

2. 增加评测任务记录  
   每次评测应该保存：
   - 数据集、子集、样本数
   - 攻击方法
   - target model / judge model
   - 原始 prompt、攻击 prompt、模型回复、judge 输出
   - 时间戳和运行参数

   可以先保存为本地 JSON 文件，比如 `runs/YYYYMMDD-HHMMSS.json`，后续再考虑数据库。

3. 增加失败重试和错误标记  
   模型接口超时、judge 输出异常、上下文超长都应该在结果里有状态，而不是直接中断整次评测。

**第二阶段：完善数据集能力**
现在内置了 JailbreakBench harmful 和 HarmBench text_test。下一步应该做成统一数据 schema。

建议定义一个标准 case 格式：

```json
{
  "id": "string",
  "source": "JailbreakBench | HarmBench | custom",
  "prompt": "string",
  "goal": "string",
  "category": "string",
  "behavior_type": "string",
  "metadata": {}
}
```

然后让所有 loader 都输出这个格式。

主要改：
- [src/services/benchmark-loader.js](/home/u2023202105/Safecompass/src/services/benchmark-loader.js)
- [src/benchmarks/registry.js](/home/u2023202105/Safecompass/src/benchmarks/registry.js)
- [scripts/export_harmbench.py](/home/u2023202105/Safecompass/scripts/export_harmbench.py)
- [scripts/export_jailbreakbench.py](/home/u2023202105/Safecompass/scripts/export_jailbreakbench.py)

接着再加：
- HarmBench 更多 split
- 自定义数据集字段校验
- 数据集预览和错误提示
- 按 category / behavior_type 的更细筛选

**第三阶段：补齐攻击方法**
当前 UI 里有 Direct Request、Human Jailbreaks、Jailbreak Chat。服务端其实已经有一些 PAIR 逻辑，但前端没有正式接出来。

推荐顺序：

1. 先把 PAIR 作为高级攻击方法接入 UI  
   让用户能配置：
   - streams
   - iterations
   - attacker model
   - stop on success

2. 给每种攻击方法加统一元数据  
   例如：
   - `attack_family`
   - `attack_strategy`
   - `attack_variant`
   - `official_method`
   - `attempt_index`

3. 做攻击方法对比  
   输出每种攻击方法的 ASR、成功样本数、平均 judge 分布。

主要改：
- [src/services/attack-strategies.js](/home/u2023202105/Safecompass/src/services/attack-strategies.js)
- [server.js](/home/u2023202105/Safecompass/server.js)
- [src/app.js](/home/u2023202105/Safecompass/src/app.js)

**第四阶段：提升 Judge 可信度**
这是论文/课程展示里最容易被问的问题。

建议做三件事：

1. 保留原始 judge 输出  
   这个已经有基础了，继续强化展示。

2. 增加多 judge 模式  
   比如：
   - Llama judge
   - GPT-compatible judge
   - rule-based fallback
   - majority vote

3. 增加 judge prompt 模板管理  
   不要把 judge prompt 固定写死在 `server.js`，可以拆到 `src/services/judge-prompts.js` 或 `prompts/judges/`。

这样你可以解释：平台不仅跑 ASR，还能比较不同 judge 对结果的影响。

**第五阶段：报告和可视化**
你现在已经有图表基础。下一步应该让结果更像“评测报告”。

建议加：

- 一键导出完整报告 Markdown / HTML
- 模型风险雷达图
- category × attack strategy 热力图
- 每个危害类别的 Top 失败案例
- 每种攻击方法的代表性成功样本
- judge 不确定样本列表

这部分主要改：
- [src/app.js](/home/u2023202105/Safecompass/src/app.js)
- [src/services/exporter.js](/home/u2023202105/Safecompass/src/services/exporter.js)

**第六阶段：部署和用户体验**
如果要给其他用户用，需要补：

- 简单访问认证
- 任务队列，避免多人同时压垮 70B 模型
- systemd 日志说明
- 端口、模型路径、judge URL 全部环境变量化
- 页面上显示 Llama 服务是否在线

部署相关已经有基础：
- [deploy/systemd/](/home/u2023202105/Safecompass/deploy/systemd)
- [docs/systemd-deploy.md](/home/u2023202105/Safecompass/docs/systemd-deploy.md)

**我建议的最近三步**
1. 先做“评测结果持久化”：每次评测保存为 `runs/*.json`。  
2. 再做“Target Model / Judge Model 分离配置”。  
3. 然后把 PAIR 攻击方法接入前端，形成更完整的攻击策略对比。

这三步做完以后，你的平台就不只是一个 demo，而是一个能复现实验、能解释结果、能扩展 benchmark 的评测框架。