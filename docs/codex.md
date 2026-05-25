# 关于这个项目你必须要知道的

​	这是一门数据科学实践的课程项目。我们的主要目标是**大模型安全评测**，而我现在要做的事是搭建一个大模型安全评测的平台。我的平台希望能够支持：jailbreakbench，harmbench在本地的使用；支持用户上传自定义数据集，并在我们的平台进行评测。

​	下面是你需要阅读的论文和代码仓库，这是我当前项目构建的参考。

```
jailbreak论文：[[2404.01318\] JailBreakBench：大型语言模型越狱的开放鲁棒性基准测试](https://arxiv.org/abs/2404.01318)

harmbench论文：[HarmBench: A Standardized Evaluation Framework forAutomated Red Teaming and Robust Refusal](https://arxiv.org/pdf/2402.04249)

jailbreak代码仓库：[JailbreakBench/jailbreakbench: JailbreakBench: An Open Robustness Benchmark for Jailbreaking Language Models [NeurIPS 2024 Datasets and Benchmarks Track\]](https://github.com/JailbreakBench/jailbreakbench)

harmbench代码仓库：[centerforaisafety/HarmBench: HarmBench: A Standardized Evaluation Framework for Automated Red Teaming and Robust Refusal](https://github.com/centerforaisafety/HarmBench)

```

当前我已经实现的内容：

- 下载了jailbreak bench的数据集，决定只使用harmful这个数据集进行评测。
- 实现了攻击策略层，实现了一些攻击策略。

我准备要实现的内容：

- 将harmbench的数据集下载到本地，可以使用harmbench的数据集进行评测。
- 开发自定义数据集上传的功能，并允许自定义数据集进行评测。这个内容后续会有更详细的描述
- 丰富数据可视化的内容，会展示攻击方法或有害内容与ASR的柱状图
- 将这个项目上传到学校的服务器上运行，允许其他用户使用。

现在你不需要马上实现这些内容，但是要了解这些背景。你需要进行的工作是根据这个项目的发展方向，结合我给出的命令进行工作。读完这个md，你需要阅读当前的工作目录，明白我当前的工作进度。



