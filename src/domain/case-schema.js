export const SAFE_COMPASS_CASE_SCHEMA_VERSION = "safecompass.case.v1";

export const CASE_TEXT_FIELDS = [
  "prompt",
  "goal",
  "request",
  "question",
  "instruction",
  "text",
  "content"
];

const ID_FIELDS = ["id", "case_id", "uid", "Index", "behavior_id", "BehaviorID"];
const GOAL_FIELDS = ["goal", "Goal", "original_prompt", ...CASE_TEXT_FIELDS];
const PROMPT_FIELDS = ["prompt", "Prompt", ...CASE_TEXT_FIELDS];
const DATASET_FIELDS = ["dataset"];
const SUBSET_FIELDS = ["subset"];
const SOURCE_FIELDS = ["source", "Source"];
const TARGET_FIELDS = ["target", "Target"];
const CATEGORY_FIELDS = [
  "category",
  "Category",
  "harm_category",
  "topic",
  "SemanticCategory",
  "semantic_category",
  "FunctionalCategory",
  "functional_category"
];
const SEMANTIC_CATEGORY_FIELDS = ["semantic_category", "SemanticCategory"];
const FUNCTIONAL_CATEGORY_FIELDS = ["functional_category", "FunctionalCategory"];
const TAG_FIELDS = ["tags", "Tags"];
const CONTEXT_FIELDS = ["context", "ContextString"];
const BEHAVIOR_TYPE_FIELDS = ["behavior_type", "behaviorType"];
const ATTACK_TYPE_FIELDS = ["attack_type", "attack"];
const ORIGINAL_PROMPT_FIELDS = ["original_prompt", "OriginalPrompt"];

export function normalizeTaxonomyValue(value, fallback = "-") {
  return String(value || fallback).replace(/\s+/g, " ").trim() || fallback;
}

function getCaseInsensitiveValue(record, key) {
  if (!record || typeof record !== "object") {
    return undefined;
  }
  const targetKey = String(key).toLowerCase();
  const match = Object.entries(record).find(([recordKey]) => recordKey.toLowerCase() === targetKey);
  return match ? match[1] : undefined;
}

export function getFirstString(record, keys) {
  for (const key of keys) {
    if (typeof record?.[key] === "string" && record[key].trim()) {
      return record[key].trim();
    }
  }
  for (const key of keys) {
    const value = getCaseInsensitiveValue(record, key);
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function getFirstValue(record, keys) {
  for (const key of keys) {
    if (record?.[key] !== undefined && record[key] !== null && String(record[key]).trim()) {
      return record[key];
    }
  }
  for (const key of keys) {
    const value = getCaseInsensitiveValue(record, key);
    if (value !== undefined && value !== null && String(value).trim()) {
      return value;
    }
  }
  return "";
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined)
  );
}

export function buildPromptWithContext(behavior, context) {
  if (context) {
    return `${context}\n\n---\n\n${behavior}`;
  }
  return behavior;
}

export function normalizeSafeCompassCase(input, options = {}) {
  const record =
    typeof input === "string"
      ? { prompt: input }
      : input && typeof input === "object"
        ? input
        : {};
  const index = options.index ?? 0;
  const idPrefix = options.idPrefix || "case";
  const dataset = getFirstString(record, DATASET_FIELDS) || options.dataset || "custom";
  const subset = getFirstString(record, SUBSET_FIELDS) || options.subset || null;
  const source = getFirstString(record, SOURCE_FIELDS) || options.source || dataset || "自定义";
  const behavior =
    getFirstString(record, ["behavior", "Behavior", "behavior_id", "BehaviorID"]) ||
    getFirstString(record, GOAL_FIELDS);
  const context = getFirstString(record, CONTEXT_FIELDS);
  const prompt =
    getFirstString(record, PROMPT_FIELDS) ||
    buildPromptWithContext(behavior, context);
  const goal =
    getFirstString(record, GOAL_FIELDS) ||
    behavior ||
    prompt;

  if (!prompt && !goal && options.requireText !== false) {
    throw new Error(
      `第 ${index + 1} 条用例缺少 ${CASE_TEXT_FIELDS.join("/")} 字段`
    );
  }

  const id = String(getFirstValue(record, ID_FIELDS) || `${idPrefix}_${index}`);
  const category = normalizeTaxonomyValue(getFirstValue(record, CATEGORY_FIELDS));
  const semanticCategory = normalizeTaxonomyValue(getFirstValue(record, SEMANTIC_CATEGORY_FIELDS));
  const functionalCategory = normalizeTaxonomyValue(getFirstValue(record, FUNCTIONAL_CATEGORY_FIELDS));
  const tags = normalizeTags(getFirstValue(record, TAG_FIELDS));
  const sourceRecordId = getFirstValue(record, ["case_id", "uid", "Index"]);
  const behaviorId = getFirstValue(record, ["behavior_id", "BehaviorID"]);
  const metadata = {
    ...(record.metadata && typeof record.metadata === "object" ? record.metadata : {}),
    source_record_id: sourceRecordId || undefined,
    behavior_id: behaviorId || undefined,
    semantic_category: semanticCategory !== "-" ? semanticCategory : undefined,
    functional_category: functionalCategory !== "-" ? functionalCategory : undefined,
    context: context || undefined,
    has_context: Boolean(context),
    tags: tags.length ? tags : undefined
  };

  return {
    ...record,
    schema_version: SAFE_COMPASS_CASE_SCHEMA_VERSION,
    id,
    source,
    dataset,
    subset,
    prompt: prompt || goal,
    goal: goal || prompt,
    original_prompt: getFirstString(record, ORIGINAL_PROMPT_FIELDS) || goal || prompt,
    target: getFirstString(record, TARGET_FIELDS),
    category,
    behavior: normalizeTaxonomyValue(behavior || id),
    behavior_type: getFirstString(record, BEHAVIOR_TYPE_FIELDS) || options.behaviorType || "custom",
    attack_type: getFirstString(record, ATTACK_TYPE_FIELDS) || "-",
    metadata: compactObject(metadata),
    raw: record.raw || record,
    behavior_id: behaviorId || undefined,
    semantic_category: semanticCategory,
    functional_category: functionalCategory,
    tags,
    context,
    has_context: Boolean(context)
  };
}

export function hasCaseTextField(headers) {
  return headers.some((header) => CASE_TEXT_FIELDS.includes(String(header || "").trim().toLowerCase()));
}
