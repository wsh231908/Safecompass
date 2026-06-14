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
      }
    }
  },
  harmbench: {
    id: "harmbench",
    name: "HarmBench",
    source: "github",
    repository: "centerforaisafety/HarmBench",
    defaultSubset: "text_test",
    subsets: {
      text_test: {
        id: "text_test",
        label: "Text Test Behaviors",
        description: "HarmBench 官方文本测试集，用于本地安全评测",
        exportedPath: "./data/benchmarks/harmbench/text_test.json"
      }
    }
  }
};

export function getBenchmark(datasetId) {
  return benchmarkRegistry[datasetId] || null;
}
