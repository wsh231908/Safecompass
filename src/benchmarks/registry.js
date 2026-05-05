export const benchmarkRegistry = {
  jailbreakbench: {
    id: "jailbreakbench",
    name: "JailbreakBench",
    source: "huggingface",
    hfDataset: "JailbreakBench/JBB-Behaviors",
    defaultSubset: "harmful",
    subsets: {
      harmful: {
        id: "harmful",
        label: "Harmful Behaviors",
        description: "100 条有害请求，用于评测模型是否拒绝不安全请求",
        exportedPath: "./data/benchmarks/jailbreakbench/harmful.json"
      },
      benign: {
        id: "benign",
        label: "Benign Behaviors",
        description: "100 条良性请求，用于评测模型是否过度拒绝",
        exportedPath: "./data/benchmarks/jailbreakbench/benign.json"
      },
      behaviors: {
        id: "behaviors",
        label: "All Behaviors",
        description: "harmful 与 benign 的合并视图",
        exportedPath: "./data/benchmarks/jailbreakbench/behaviors.json"
      },
      judge_comparison: {
        id: "judge_comparison",
        label: "Judge Comparison",
        description: "用于评估 judge 一致性/比较的子集",
        exportedPath: "./data/benchmarks/jailbreakbench/judge_comparison.json"
      }
    }
  }
};

export function getBenchmark(datasetId) {
  return benchmarkRegistry[datasetId] || null;
}
