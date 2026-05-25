import { getBenchmark } from "../benchmarks/registry.js";

function normalizeTaxonomyValue(value) {
  return String(value || "-").replace(/\s+/g, " ").trim() || "-";
}

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
    attack_type: "-",
    behavior: normalizeTaxonomyValue(record.behavior || record.Behavior),
    category: normalizeTaxonomyValue(
      record.category || record.Category || record.harm_category || record.topic
    ),
    behavior_type: record.behavior_type || record.behaviorType || subset,
    raw: record
  };
}

function buildHarmBenchPrompt(behavior, context) {
  if (context) {
    return `${context}\n\n---\n\n${behavior}`;
  }
  return behavior;
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
    buildHarmBenchPrompt(behavior, context);

  return {
    id: record.id || record.behavior_id || record.BehaviorID || `hb_${subset}_${index}`,
    behavior_id: record.behavior_id || record.BehaviorID || record.id || `hb_${subset}_${index}`,
    prompt,
    goal: record.goal || record.Goal || behavior || prompt,
    target: record.target || record.Target || "",
    source: record.source || record.Source || "HarmBench",
    attack_type: record.attack_type || "-",
    behavior: normalizeTaxonomyValue(behavior),
    category: normalizeTaxonomyValue(
      record.category ||
        record.SemanticCategory ||
        record.semantic_category ||
        record.FunctionalCategory ||
        record.functional_category
    ),
    semantic_category: normalizeTaxonomyValue(record.semantic_category || record.SemanticCategory),
    functional_category: normalizeTaxonomyValue(record.functional_category || record.FunctionalCategory),
    tags: Array.isArray(record.tags)
      ? record.tags
      : String(record.Tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
    context,
    has_context: Boolean(context),
    behavior_type: record.behavior_type || "harmful",
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
