import { summarizeResults } from "../utils/format.js";

function pct(value, digits = 1) {
  return `${Number(value || 0).toFixed(digits)}%`;
}

function truncate(text, maxLength = 240) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function escapeMarkdown(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " ");
}

function getCategory(item) {
  return item.category || item.semantic_category || item.functional_category || "未分类";
}

export function buildCategoryRiskSummary(results) {
  const groups = new Map();
  results.forEach((item) => {
    const category = getCategory(item);
    const bucket = groups.get(category) || {
      category,
      total: 0,
      unsafe: 0,
      safe: 0,
      ambiguous: 0,
      errored: 0
    };
    bucket.total += 1;
    if (item.label === "unsafe") {
      bucket.unsafe += 1;
    } else if (item.label === "safe") {
      bucket.safe += 1;
    } else {
      bucket.ambiguous += 1;
    }
    if (item.status === "error") {
      bucket.errored += 1;
    }
    bucket.asr = bucket.total ? (bucket.unsafe / bucket.total) * 100 : 0;
    groups.set(category, bucket);
  });

  return [...groups.values()].sort(
    (left, right) => right.asr - left.asr || right.unsafe - left.unsafe || right.total - left.total
  );
}

export function getTopFailureCases(results, limit = 8) {
  return results
    .filter((item) => item.label === "unsafe")
    .sort(
      (left, right) =>
        Number(right.score || 0) - Number(left.score || 0) ||
        String(left.category || "").localeCompare(String(right.category || ""))
    )
    .slice(0, limit);
}

export function getJudgeReviewCases(results, limit = 12) {
  return results
    .filter((item) => {
      const hasErrorVote = Number(item.judge_error_votes || 0) > 0;
      const hasUnknownVote = Number(item.judge_unknown_votes || 0) > 0;
      const lowAgreement = Number(item.judge_agreement ?? 1) < 1;
      return item.label === "ambiguous" || item.status === "error" || hasErrorVote || hasUnknownVote || lowAgreement;
    })
    .sort(
      (left, right) =>
        Number(left.judge_agreement ?? 1) - Number(right.judge_agreement ?? 1) ||
        Number(right.judge_error_votes || 0) - Number(left.judge_error_votes || 0)
    )
    .slice(0, limit);
}

function buildConfigLines(config) {
  return [
    `- 数据集：${config.dataset || "-"}`,
    `- 子集：${config.datasetSubset || "-"}`,
    `- 被测模型：${config.targetModelConfig?.modelName || "-"}`,
    `- Judge 模式：${config.judgeConfig?.mode || config.judgeConfig?.preset || "-"}`,
    `- 攻击方法：${config.evaluationOptions?.attackStrategy || "-"}`
  ].join("\n");
}

function buildMarkdownTable(headers, rows) {
  if (!rows.length) {
    return "暂无数据";
  }
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => escapeMarkdown(cell)).join(" | ")} |`)
  ].join("\n");
}

function buildChartSection(charts = []) {
  if (!charts.length) {
    return ["## 图表", "", "暂无图表"].join("\n");
  }
  return [
    "## 图表",
    "",
    ...charts.flatMap((chart) => [
      `### ${chart.title}`,
      "",
      `![${escapeMarkdown(chart.title)}](${chart.dataUrl})`,
      ""
    ])
  ].join("\n");
}

export function buildMarkdownReport({
  results,
  config = {},
  exportedAt = new Date().toISOString(),
  charts = []
}) {
  const summary = summarizeResults(results);
  const categorySummary = buildCategoryRiskSummary(results).slice(0, 12);
  const topFailures = getTopFailureCases(results);
  const reviewCases = getJudgeReviewCases(results);

  return [
    "# SafeCompass 评测报告",
    "",
    `导出时间：${exportedAt}`,
    "",
    "## 运行配置",
    "",
    buildConfigLines(config),
    "",
    "## 总览",
    "",
    buildMarkdownTable(
      ["总数", "安全拒绝", "越狱成功", "需复核", "错误", "原始样本 ASR"],
      [[summary.total, summary.safe, summary.unsafe, summary.ambiguous, summary.errored, pct(summary.behaviorAsr)]]
    ),
    "",
    "## 危害类别风险",
    "",
    buildMarkdownTable(
      ["类别", "样本数", "越狱成功", "安全拒绝", "需复核", "ASR"],
      categorySummary.map((item) => [
        item.category,
        item.total,
        item.unsafe,
        item.safe,
        item.ambiguous,
        pct(item.asr)
      ])
    ),
    "",
    buildChartSection(charts),
    "",
    "## Top 失败案例",
    "",
    buildMarkdownTable(
      ["用例 ID", "类别", "得分", "Judge", "Prompt", "模型回复"],
      topFailures.map((item) => [
        item.id,
        getCategory(item),
        item.score,
        item.result,
        truncate(item.prompt, 180),
        truncate(item.response, 220)
      ])
    ),
    "",
    "## Judge 需复核样本",
    "",
    buildMarkdownTable(
      ["用例 ID", "最终标签", "一致率", "unknown 票", "error 票", "Judge 摘要"],
      reviewCases.map((item) => [
        item.id,
        item.label,
        pct(Number(item.judge_agreement ?? 0) * 100, 0),
        item.judge_unknown_votes || 0,
        item.judge_error_votes || 0,
        (item.judge_votes || []).map((vote) => `${vote.name || vote.id}: ${vote.status === "error" ? "error" : vote.label}`).join("; ")
      ])
    )
  ].join("\n");
}
