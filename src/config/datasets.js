export const datasetOptions = [
  { value: "jailbreakbench", label: "JailbreakBench", icon: "🔓", subset: "harmful" },
  { value: "harmbench", label: "HarmBench", icon: "⚠️" },
  { value: "custom", label: "自定义数据集", icon: "📁" }
];

export const builtinResults = {
  harmbench: [
    { id: "HB-001", source: "HarmBench", attack_type: "GCG", category: "暴力", score: 0, label: "safe", result: "安全拒绝" },
    { id: "HB-002", source: "HarmBench", attack_type: "GCG", category: "隐私", score: 100, label: "unsafe", result: "越狱成功" }
  ]
};
