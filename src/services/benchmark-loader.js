import { getBenchmark } from "../benchmarks/registry.js";

function normalizeJailbreakBenchRecord(record, index, subset) {
  const prompt =
    record.prompt ??
    record.Prompt ??
    record.goal ??
    record.Goal ??
    record.instruction ??
    record.query ??
    record.behavior ??
    record.Behavior ??
    "";

  return {
    id: record.id || record.uid || record.Index || `jbb_${subset}_${index}`,
    prompt,
    goal: record.goal || record.Goal || prompt,
    source: record.source || record.Source || "JailbreakBench",
    attack_type:
      record.attack_type ||
      record.attack ||
      record.category_name ||
      record.jailbreak ||
      record.behavior ||
      record.Behavior ||
      "-",
    category:
      record.category || record.Category || record.harm_category || record.topic || "-",
    behavior_type: record.behavior_type || record.behaviorType || subset,
    raw: record
  };
}

async function fetchExportedSubset(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`加载失败: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function loadBenchmarkCases(datasetId, subsetId) {
  const benchmark = getBenchmark(datasetId);
  if (!benchmark) {
    throw new Error(`未知数据集: ${datasetId}`);
  }

  if (datasetId !== "jailbreakbench") {
    throw new Error(`当前仅实现 ${datasetId} 的注册信息，未实现加载器`);
  }

  const activeSubsetId = subsetId || benchmark.defaultSubset;
  const subset = benchmark.subsets[activeSubsetId];
  if (!subset) {
    throw new Error(`未知子集: ${activeSubsetId}`);
  }

  const payload = await fetchExportedSubset(subset.exportedPath);
  const records = Array.isArray(payload.records) ? payload.records : [];

  return {
    benchmark,
    subset,
    records: records.map((record, index) =>
      normalizeJailbreakBenchRecord(record, index, activeSubsetId)
    )
  };
}
