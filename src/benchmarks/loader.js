import { getBenchmark } from "../benchmarks/registry.js";
import { buildPromptWithContext, normalizeSafeCompassCase } from "../domain/case-schema.js";

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

  return normalizeSafeCompassCase(
    {
      ...record,
      prompt,
      goal: record.goal || record.Goal || prompt,
      source: record.source || record.Source || "JailbreakBench",
      attack_type: "-",
      behavior: record.behavior || record.Behavior,
      category: record.category || record.Category || record.harm_category || record.topic,
      behavior_type: record.behavior_type || record.behaviorType || subset,
      raw: record
    },
    {
      dataset: "jailbreakbench",
      source: "JailbreakBench",
      subset,
      idPrefix: `jbb_${subset}`,
      index,
      behaviorType: subset
    }
  );
}

function normalizeHarmBenchRecord(record, index, subset) {
  const behavior =
    record.behavior ??
    record.Behavior ??
    record.goal ??
    record.Goal ??
    record.prompt ??
    record.Prompt ??
    "";
  const context = String(record.context || record.ContextString || "").trim();
  const prompt =
    record.prompt ??
    record.Prompt ??
    buildPromptWithContext(behavior, context);

  return normalizeSafeCompassCase(
    {
      ...record,
      id: record.id || record.behavior_id || record.BehaviorID || `hb_${subset}_${index}`,
      behavior_id: record.behavior_id || record.BehaviorID || record.id || `hb_${subset}_${index}`,
      prompt,
      goal: record.goal || record.Goal || behavior || prompt,
      target: record.target || record.Target || "",
      source: record.source || record.Source || "HarmBench",
      attack_type: record.attack_type || "-",
      behavior,
      category:
        record.category ||
        record.SemanticCategory ||
        record.semantic_category ||
        record.FunctionalCategory ||
        record.functional_category,
      context,
      behavior_type: record.behavior_type || "harmful",
      raw: record
    },
    {
      dataset: "harmbench",
      source: "HarmBench",
      subset,
      idPrefix: `hb_${subset}`,
      index,
      behaviorType: "harmful"
    }
  );
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

  const activeSubsetId = subsetId || benchmark.defaultSubset;
  const subset = benchmark.subsets[activeSubsetId];
  if (!subset) {
    throw new Error(`未知子集: ${activeSubsetId}`);
  }

  const payload = await fetchExportedSubset(subset.exportedPath);
  const records = Array.isArray(payload.records) ? payload.records : [];
  const normalizeRecord =
    datasetId === "harmbench" ? normalizeHarmBenchRecord : normalizeJailbreakBenchRecord;

  return {
    benchmark,
    subset,
    records: records.map((record, index) => normalizeRecord(record, index, activeSubsetId))
  };
}
