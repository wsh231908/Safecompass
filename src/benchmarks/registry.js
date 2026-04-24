export const benchmarkRegistry = {
  jailbreakbench: {
    id: "jailbreakbench",
    name: "JailbreakBench",
    source: "huggingface",
    hfDataset: "JailbreakBench/JBB-Behaviors",
    defaultSubset: "behaviors",
    subsets: {
      behaviors: {
        id: "behaviors",
        label: "Behaviors",
        description: "用于安全攻击评测的基础行为集",
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
