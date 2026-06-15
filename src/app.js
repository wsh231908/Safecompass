import { datasetOptions } from "./config/datasets.js";
import { attackStrategyOptions } from "./attacks/strategies.js";
import { createApiEvaluator } from "./api/evaluation-client.js";
import { loadBenchmarkCases } from "./benchmarks/loader.js";
import { CASE_TEXT_FIELDS, hasCaseTextField, normalizeSafeCompassCase } from "./domain/case-schema.js";
import { exportJson, exportMarkdown } from "./reporting/downloads.js";
import {
  buildMarkdownReport,
  getJudgeReviewCases,
  getTopFailureCases
} from "./reporting/report-builder.js";
import { createStore } from "./state/store.js";
import { $, createOptions, escapeHtml } from "./utils/dom.js";
import { formatTimestamp, summarizeResults } from "./utils/format.js";
import { getBenchmark } from "./benchmarks/registry.js";

const LOCAL_LLAMA_API_URL = "http://127.0.0.1:8002/v1";
const LOCAL_LLAMA_MODEL_NAME = "meta-llama/Llama-3-70b-chat-hf";
const LOCAL_LLAMA_MAX_TOKENS = 512;
const ATTACK_FAMILY = "prompt_modification";
const PLOT_COLORS = ["#3f8fc2", "#df4548", "#55a868", "#f0ad4e", "#8172b3", "#4c9f9f"];
const PLOT_FONT = '"Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif';
const REPORT_CHARTS = [
  { value: "category_rank_asr", title: "危害类别 ASR 排名柱状图" },
  { value: "model_category_heatmap", title: "模型 × 危害类别 ASR" },
  { value: "model_radar", title: "模型风险雷达图" },
  { value: "success_pareto", title: "攻击成功样本 Pareto 图" }
];

function getInitialFormValues() {
  return {
    modelPreset: "llama",
    apiUrl: "",
    apiKey: "",
    customModelName: "",
    judgeMode: "single",
    judgePreset: "llama",
    judgeApiUrl: "",
    judgeApiKey: "",
    judgeModelName: "",
    multiJudgeLlama: true,
    multiJudgeGpt: false,
    multiJudgeRule: true,
    multiJudgeGptApiUrl: "",
    multiJudgeGptApiKey: "",
    multiJudgeGptModelName: "",
    caseLimit: "20",
    datasetSubsets: {
      jailbreakbench: "harmful",
      harmbench: "text_test"
    },
    attackFamily: ATTACK_FAMILY,
    attackStrategy: "direct"
  };
}

function normalizeCustomInputCase(item, index, idPrefix) {
  return normalizeSafeCompassCase(item, {
    dataset: "custom",
    source: "自定义",
    subset: null,
    idPrefix,
    index,
    behaviorType: "custom"
  });
}

function parseCsvRows(content) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (quoted) {
      if (char === '"' && nextChar === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }

  row.push(value);
  rows.push(row);
  return rows.filter((cells) => cells.some((cell) => String(cell).trim()));
}

function parseCsv(content) {
  const rows = parseCsvRows(content);
  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((item) => item.trim());
  if (!hasCaseTextField(headers)) {
    throw new Error(`CSV 需要包含 ${CASE_TEXT_FIELDS.join("/")} 列之一`);
  }

  return rows.slice(1).map((columns, index) => {
    const record = Object.fromEntries(
      headers.map((header, columnIndex) => [header, columns[columnIndex]?.trim() || ""])
    );
    return normalizeCustomInputCase(record, index, "csv");
  });
}

function parseJson(content) {
  const json = JSON.parse(content);
  if (Array.isArray(json)) {
    return json.map((item, index) => normalizeCustomInputCase(item, index, "json"));
  }

  if (Array.isArray(json.cases)) {
    return json.cases.map((item, index) => normalizeCustomInputCase(item, index, "case"));
  }

  throw new Error("JSON 需要是数组或包含 cases 数组");
}

export function bootstrapApp() {
  const store = createStore();
  const evaluator = createApiEvaluator();

  const elements = {
    modelPreset: $("#modelPreset"),
    modelApiConfigArea: $("#modelApiConfigArea"),
    apiUrl: $("#apiUrl"),
    apiKey: $("#apiKey"),
    customModelName: $("#customModelName"),
    judgeModeSelect: $("#judgeModeSelect"),
    singleJudgePresetField: $("#singleJudgePresetField"),
    judgePreset: $("#judgePreset"),
    judgeApiConfigArea: $("#judgeApiConfigArea"),
    judgeApiUrl: $("#judgeApiUrl"),
    judgeApiKey: $("#judgeApiKey"),
    judgeModelName: $("#judgeModelName"),
    multiJudgeConfigArea: $("#multiJudgeConfigArea"),
    multiJudgeLlama: $("#multiJudgeLlama"),
    multiJudgeGpt: $("#multiJudgeGpt"),
    multiJudgeRule: $("#multiJudgeRule"),
    multiJudgeGptConfigArea: $("#multiJudgeGptConfigArea"),
    multiJudgeGptApiUrl: $("#multiJudgeGptApiUrl"),
    multiJudgeGptApiKey: $("#multiJudgeGptApiKey"),
    multiJudgeGptModelName: $("#multiJudgeGptModelName"),
    benchmarkOptions: $("#benchmarkOptions"),
    benchmarkSubsetSelect: $("#benchmarkSubsetSelect"),
    datasetTags: $("#datasetTags"),
    customDatasetArea: $("#customDatasetArea"),
    fileUpload: $("#fileUpload"),
    uploadBtn: $("#uploadBtn"),
    fileName: $("#fileName"),
    filePreview: $("#filePreview"),
    newPrompt: $("#newPrompt"),
    addPromptBtn: $("#addPromptBtn"),
    promptList: $("#promptList"),
    customDataStats: $("#customDataStats"),
    attackStrategySelect: $("#attackStrategySelect"),
    categoryFilter: $("#categoryFilter"),
    caseLimit: $("#caseLimit"),
    runBtn: $("#runBtn"),
    resetBtn: $("#resetBtn"),
    progressCard: $("#progressCard"),
    progressFill: $("#progressFill"),
    progressStatus: $("#progressStatus"),
    resultCard: $("#resultCard"),
    statsGrid: $("#statsGrid"),
    topFailureList: $("#topFailureList"),
    judgeReviewList: $("#judgeReviewList"),
    chartTypeSelect: $("#chartTypeSelect"),
    resultChartCanvas: $("#resultChartCanvas"),
    resultTableBody: $("#resultTableBody"),
    exportBtn: $("#exportBtn"),
    exportMarkdownBtn: $("#exportMarkdownBtn"),
    clearLogBtn: $("#clearLogBtn"),
    logArea: $("#logArea")
  };

  const initialForm = getInitialFormValues();

  function addLog(message) {
    const line = document.createElement("span");
    line.className = "log-line";
    line.innerHTML = `[${formatTimestamp()}] ${escapeHtml(message)}`;
    elements.logArea.prepend(line);
  }

  function renderSelects() {
    elements.modelPreset.value = initialForm.modelPreset;
    elements.apiUrl.value = initialForm.apiUrl;
    elements.apiKey.value = initialForm.apiKey;
    elements.customModelName.value = initialForm.customModelName;
    elements.judgeModeSelect.value = initialForm.judgeMode;
    elements.judgePreset.value = initialForm.judgePreset;
    elements.judgeApiUrl.value = initialForm.judgeApiUrl;
    elements.judgeApiKey.value = initialForm.judgeApiKey;
    elements.judgeModelName.value = initialForm.judgeModelName;
    elements.multiJudgeLlama.checked = initialForm.multiJudgeLlama;
    elements.multiJudgeGpt.checked = initialForm.multiJudgeGpt;
    elements.multiJudgeRule.checked = initialForm.multiJudgeRule;
    elements.multiJudgeGptApiUrl.value = initialForm.multiJudgeGptApiUrl;
    elements.multiJudgeGptApiKey.value = initialForm.multiJudgeGptApiKey;
    elements.multiJudgeGptModelName.value = initialForm.multiJudgeGptModelName;
    elements.caseLimit.value = initialForm.caseLimit;
    elements.attackStrategySelect.innerHTML = createOptions(attackStrategyOptions);
    elements.attackStrategySelect.value = initialForm.attackStrategy;
    renderModelConfigArea();
    renderJudgeConfigArea();
  }

  function getSelectedOptionLabel(select) {
    return select.options[select.selectedIndex]?.textContent || select.value;
  }

  function renderFilterOptions(select, values, allLabel) {
    select.innerHTML = [
      `<option value="all">${escapeHtml(allLabel)}</option>`,
      ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    ].join("");
  }

  function isRegisteredBenchmark(datasetId) {
    return Boolean(getBenchmark(datasetId));
  }

  function getSelectedDatasetSubset(datasetId) {
    const benchmark = getBenchmark(datasetId);
    if (!benchmark) {
      return null;
    }
    return elements.benchmarkSubsetSelect.value || benchmark.defaultSubset;
  }

  function getBenchmarkSourceLabel(benchmark) {
    return benchmark.hfDataset || benchmark.repository || benchmark.name;
  }

  function renderBenchmarkSubsetSelect() {
    const { currentDataset } = store.getState();
    const benchmark = getBenchmark(currentDataset);
    if (!benchmark) {
      elements.benchmarkSubsetSelect.innerHTML = "";
      return;
    }

    const previousSubset =
      elements.benchmarkSubsetSelect.value ||
      initialForm.datasetSubsets[currentDataset] ||
      benchmark.defaultSubset;
    const options = Object.values(benchmark.subsets).map((subset) => ({
      value: subset.id,
      label: subset.label
    }));
    elements.benchmarkSubsetSelect.innerHTML = createOptions(options);
    elements.benchmarkSubsetSelect.value = benchmark.subsets[previousSubset]
      ? previousSubset
      : benchmark.defaultSubset;
  }

  async function renderBenchmarkFilters() {
    const { currentDataset } = store.getState();
    const benchmark = getBenchmark(currentDataset);
    if (!benchmark) {
      return;
    }

    const activeSubset = getSelectedDatasetSubset(currentDataset);
    const previousCategory = elements.categoryFilter.value || "all";
    const loaded = await loadBenchmarkCases(currentDataset, activeSubset);
    const categories = [...new Set(loaded.records.map((record) => record.category))]
      .filter((value) => value && value !== "-")
      .sort((left, right) => left.localeCompare(right));

    renderFilterOptions(elements.categoryFilter, categories, "全部危害类别");

    elements.categoryFilter.value = categories.includes(previousCategory) ? previousCategory : "all";
  }

  function renderModelConfigArea() {
    const customModel = elements.modelPreset.value === "custom";
    elements.modelApiConfigArea.classList.toggle("hidden", !customModel);
  }

  function renderJudgeConfigArea() {
    const multiJudge = elements.judgeModeSelect.value === "multi";
    const customJudge = !multiJudge && elements.judgePreset.value === "custom";
    elements.singleJudgePresetField.classList.toggle("hidden", multiJudge);
    elements.judgeApiConfigArea.classList.toggle("hidden", !customJudge);
    elements.multiJudgeConfigArea.classList.toggle("hidden", !multiJudge);
    elements.multiJudgeGptConfigArea.classList.toggle(
      "hidden",
      !multiJudge || !elements.multiJudgeGpt.checked
    );
  }

  function renderDatasetTags() {
    const { currentDataset } = store.getState();
    elements.datasetTags.innerHTML = datasetOptions
      .map((item) => {
        const active = item.value === currentDataset ? "active" : "";
        return `
          <button class="dataset-tag ${active}" data-dataset="${item.value}" type="button">
            <span>${item.icon}</span>
            <span>${item.label}</span>
          </button>
        `;
      })
      .join("");
  }

  function renderPromptList() {
    const { customPrompts } = store.getState();
    if (!customPrompts.length) {
      elements.promptList.innerHTML = '<div class="muted">暂无手动添加的测试用例</div>';
      return;
    }

    elements.promptList.innerHTML = customPrompts
      .map(
        (prompt, index) => `
          <div class="prompt-item">
            <span class="prompt-text">${escapeHtml(prompt)}</span>
            <button class="link-button" data-remove-index="${index}" type="button">删除</button>
          </div>
        `
      )
      .join("");
  }

  function renderCustomDataStats() {
    const { customPrompts, customFileData } = store.getState();
    const total = customPrompts.length + customFileData.length;
    elements.customDataStats.textContent = `已加载 ${total} 条测试用例（手动 ${customPrompts.length} 条 + 文件 ${customFileData.length} 条）`;
  }

  function getAsrGroupKey(item, keys, fallback = "-") {
    for (const key of keys) {
      const value = item?.[key];
      if (typeof value === "string" && value.trim() && value.trim() !== "-") {
        return value.trim();
      }
    }
    return fallback;
  }

  function updateAsrBucket(map, key, item) {
    const bucket = map.get(key) || { key, total: 0, unsafe: 0, safe: 0, ambiguous: 0 };
    bucket.total += 1;
    if (item.label === "unsafe") {
      bucket.unsafe += 1;
    } else if (item.label === "safe") {
      bucket.safe += 1;
    } else {
      bucket.ambiguous += 1;
    }
    bucket.asr = bucket.total ? (bucket.unsafe / bucket.total) * 100 : 0;
    map.set(key, bucket);
  }

  function aggregateBy(results, keyGetter) {
    const groups = new Map();
    results.forEach((item) => {
      updateAsrBucket(groups, keyGetter(item), item);
    });
    return [...groups.values()].sort(
      (left, right) => right.asr - left.asr || right.total - left.total || left.key.localeCompare(right.key)
    );
  }

  function getAttackLabel(item) {
    return getAsrGroupKey(item, ["attack_strategy_label", "attack_strategy", "attack_type"], "未知策略");
  }

  function getCategoryLabel(item) {
    return getAsrGroupKey(item, ["category", "semantic_category", "functional_category"], "未分类");
  }

  function getModelLabel(item) {
    return getAsrGroupKey(item, ["model", "model_name", "target_model", "pair_target_model"], LOCAL_LLAMA_MODEL_NAME);
  }

  function buildAsrMatrix(results, rowGetter) {
    const categories = aggregateBy(results, getCategoryLabel)
      .map((group) => group.key)
      .slice(0, 12);
    const categorySet = new Set(categories);
    const rows = new Map();

    results.forEach((item) => {
      const category = getCategoryLabel(item);
      if (!categorySet.has(category)) {
        return;
      }

      const rowKey = rowGetter(item);
      if (!rows.has(rowKey)) {
        rows.set(rowKey, new Map());
      }
      updateAsrBucket(rows.get(rowKey), category, item);
    });

    return {
      categories,
      rows: [...rows.entries()]
        .map(([key, cells]) => ({
          key,
          cells
        }))
        .sort((left, right) => left.key.localeCompare(right.key))
    };
  }

  function buildMatrix(results, rowGetter, columnGetter, maxRows = 8, maxColumns = 8) {
    const rowKeys = aggregateBy(results, rowGetter)
      .map((group) => group.key)
      .slice(0, maxRows);
    const columnKeys = aggregateBy(results, columnGetter)
      .map((group) => group.key)
      .slice(0, maxColumns);
    const rowSet = new Set(rowKeys);
    const columnSet = new Set(columnKeys);
    const rows = new Map();

    rowKeys.forEach((rowKey) => rows.set(rowKey, new Map()));

    results.forEach((item) => {
      const rowKey = rowGetter(item);
      const columnKey = columnGetter(item);
      if (!rowSet.has(rowKey) || !columnSet.has(columnKey)) {
        return;
      }
      updateAsrBucket(rows.get(rowKey), columnKey, item);
    });

    return {
      rows: rowKeys.map((rowKey) => ({
        key: rowKey,
        cells: rows.get(rowKey)
      })),
      columns: columnKeys
    };
  }

  function aggregateSuccessfulBy(results, keyGetter) {
    const groups = new Map();
    results.forEach((item) => {
      const key = keyGetter(item);
      const bucket = groups.get(key) || { key, unsafe: 0, total: 0 };
      bucket.total += 1;
      if (item.label === "unsafe") {
        bucket.unsafe += 1;
      }
      groups.set(key, bucket);
    });
    return [...groups.values()].sort(
      (left, right) => right.unsafe - left.unsafe || right.total - left.total || left.key.localeCompare(right.key)
    );
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function truncateLabel(value, maxLength = 18) {
    const text = String(value || "-");
    return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3))}...` : text;
  }

  function truncateText(value, maxLength = 120) {
    const text = String(value || "-").replace(/\s+/g, " ").trim();
    return text.length > maxLength ? `${text.slice(0, Math.max(1, maxLength - 3))}...` : text;
  }

  function formatPercent(value, fractionDigits = 1) {
    return `${Number(value || 0).toFixed(fractionDigits)}%`;
  }

  function formatCompactPercent(value) {
    const numeric = Number(value || 0);
    return `${Number.isInteger(numeric) ? numeric.toFixed(0) : numeric.toFixed(1)}%`;
  }

  function getAdaptivePercentAxisMax(values) {
    const maxValue = Math.max(
      0,
      ...values.map((value) => Number(value || 0)).filter((value) => Number.isFinite(value))
    );
    if (maxValue <= 0) {
      return 10;
    }

    const paddedMax = maxValue * 1.15;
    const candidates = [5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100];
    return candidates.find((candidate) => candidate >= paddedMax) || 100;
  }

  function setupPlotCanvas() {
    const canvas = elements.resultChartCanvas;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(760, Math.round(rect.width || canvas.clientWidth || 1120));
    const height = Math.max(420, Math.round(rect.height || canvas.clientHeight || 460));
    const ratio = window.devicePixelRatio || 1;
    const context = canvas.getContext("2d");

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    return { context, width, height };
  }

  function drawNoDataPlot(message) {
    const { context, width, height } = setupPlotCanvas();
    context.fillStyle = "#111827";
    context.font = `600 18px ${PLOT_FONT}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(message, width / 2, height / 2);
  }

  function drawChartTitle(context, width, title) {
    context.fillStyle = "#111827";
    context.font = `700 18px ${PLOT_FONT}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(title, width / 2, 30);
  }

  function drawYAxisLabel(context, label, x, centerY) {
    context.save();
    context.translate(x, centerY);
    context.rotate(-Math.PI / 2);
    context.fillStyle = "#111827";
    context.font = `600 14px ${PLOT_FONT}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(label, 0, 0);
    context.restore();
  }

  function drawAttackAsrPlot(results) {
    const groups = aggregateBy(results, getAttackLabel).slice(0, 12);
    if (!groups.length) {
      drawNoDataPlot("暂无可视化数据");
      return;
    }

    const { context, width, height } = setupPlotCanvas();
    const left = 76;
    const right = 32;
    const top = 64;
    const bottom = groups.length > 6 ? 118 : 88;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const plotBottom = top + plotHeight;
    const rotateLabels = groups.length > 5 || groups.some((group) => group.key.length > 8);

    drawChartTitle(context, width, "不同攻击策略的 ASR");
    drawYAxisLabel(context, "ASR (%)", 24, top + plotHeight / 2);

    context.strokeStyle = "#d9d9d9";
    context.lineWidth = 1;
    context.fillStyle = "#111827";
    context.font = `12px ${PLOT_FONT}`;
    context.textAlign = "right";
    context.textBaseline = "middle";

    for (let tick = 0; tick <= 100; tick += 20) {
      const y = plotBottom - (tick / 100) * plotHeight;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(left + plotWidth, y);
      context.stroke();
      context.fillText(String(tick), left - 10, y);
    }

    context.strokeStyle = "#111827";
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(left, top);
    context.lineTo(left, plotBottom);
    context.lineTo(left + plotWidth, plotBottom);
    context.stroke();

    const legendX = left + plotWidth - 76;
    context.fillStyle = PLOT_COLORS[0];
    context.fillRect(legendX, top - 36, 18, 12);
    context.fillStyle = "#111827";
    context.font = `13px ${PLOT_FONT}`;
    context.textAlign = "left";
    context.fillText("ASR", legendX + 26, top - 30);

    const bandWidth = plotWidth / groups.length;
    const barWidth = Math.min(76, bandWidth * 0.58);

    groups.forEach((group, index) => {
      const value = clamp(group.asr, 0, 100);
      const barHeight = (value / 100) * plotHeight;
      const x = left + bandWidth * index + (bandWidth - barWidth) / 2;
      const y = plotBottom - barHeight;
      const barColor = PLOT_COLORS[index % PLOT_COLORS.length];

      context.fillStyle = barColor;
      context.fillRect(x, y, barWidth, barHeight);

      context.fillStyle = "#111827";
      context.font = `700 12px ${PLOT_FONT}`;
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.fillText(formatPercent(group.asr), x + barWidth / 2, Math.max(top + 16, y - 5));

      context.save();
      context.translate(x + barWidth / 2, plotBottom + 18);
      if (rotateLabels) {
        context.rotate(-Math.PI / 5);
        context.textAlign = "right";
      } else {
        context.textAlign = "center";
      }
      context.fillStyle = "#111827";
      context.font = `13px ${PLOT_FONT}`;
      context.textBaseline = "top";
      context.fillText(truncateLabel(group.key, rotateLabels ? 16 : 12), 0, 0);
      context.restore();
    });
  }

  function drawGroupedBarPlot({ title, yLabel, groups, series, maxValue = 100, valueFormatter = formatPercent }) {
    if (!groups.length || !series.length) {
      drawNoDataPlot("暂无可视化数据");
      return;
    }

    const { context, width, height } = setupPlotCanvas();
    const left = 76;
    const right = 28;
    const top = 70;
    const bottom = groups.length > 4 ? 122 : 88;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const plotBottom = top + plotHeight;
    const rotateLabels = groups.length > 4 || groups.some((group) => group.length > 8);

    drawChartTitle(context, width, title);
    drawYAxisLabel(context, yLabel, 24, top + plotHeight / 2);

    context.strokeStyle = "#d9d9d9";
    context.lineWidth = 1;
    context.fillStyle = "#111827";
    context.font = `12px ${PLOT_FONT}`;
    context.textAlign = "right";
    context.textBaseline = "middle";

    for (let tick = 0; tick <= maxValue; tick += maxValue / 5) {
      const y = plotBottom - (tick / maxValue) * plotHeight;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(left + plotWidth, y);
      context.stroke();
      context.fillText(String(Math.round(tick)), left - 10, y);
    }

    context.strokeStyle = "#111827";
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(left, top);
    context.lineTo(left, plotBottom);
    context.lineTo(left + plotWidth, plotBottom);
    context.stroke();

    const legendStartX = left + Math.max(0, plotWidth - Math.min(plotWidth, series.length * 132));
    series.forEach((item, index) => {
      const x = legendStartX + index * 132;
      context.fillStyle = item.color;
      context.fillRect(x, top - 36, 16, 11);
      context.fillStyle = "#111827";
      context.font = `12px ${PLOT_FONT}`;
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(truncateLabel(item.name, 13), x + 22, top - 30);
    });

    const bandWidth = plotWidth / groups.length;
    const innerGap = Math.min(4, bandWidth * 0.04);
    const barWidth = Math.min(42, (bandWidth * 0.74 - innerGap * (series.length - 1)) / series.length);
    const groupBarWidth = barWidth * series.length + innerGap * (series.length - 1);

    groups.forEach((group, groupIndex) => {
      const groupX = left + bandWidth * groupIndex + (bandWidth - groupBarWidth) / 2;
      series.forEach((item, seriesIndex) => {
        const value = clamp(item.values[groupIndex] || 0, 0, maxValue);
        const barHeight = (value / maxValue) * plotHeight;
        const x = groupX + seriesIndex * (barWidth + innerGap);
        const y = plotBottom - barHeight;

        context.fillStyle = item.color;
        context.fillRect(x, y, barWidth, barHeight);

        if (barWidth >= 18) {
          context.fillStyle = "#111827";
          context.font = `700 10px ${PLOT_FONT}`;
          context.textAlign = "center";
          context.textBaseline = "bottom";
          context.fillText(valueFormatter(value, 0), x + barWidth / 2, Math.max(top + 12, y - 4));
        }
      });

      context.save();
      context.translate(left + bandWidth * groupIndex + bandWidth / 2, plotBottom + 18);
      if (rotateLabels) {
        context.rotate(-Math.PI / 5);
        context.textAlign = "right";
      } else {
        context.textAlign = "center";
      }
      context.fillStyle = "#111827";
      context.font = `13px ${PLOT_FONT}`;
      context.textBaseline = "top";
      context.fillText(truncateLabel(group, rotateLabels ? 16 : 12), 0, 0);
      context.restore();
    });
  }

  function drawModelAttackGroupedPlot(results) {
    const matrix = buildMatrix(results, getModelLabel, getAttackLabel, 8, 5);
    const groups = matrix.rows.map((row) => row.key);
    const series = matrix.columns.map((column, index) => ({
      name: column,
      color: PLOT_COLORS[index % PLOT_COLORS.length],
      values: matrix.rows.map((row) => row.cells.get(column)?.asr || 0)
    }));
    drawGroupedBarPlot({
      title: "模型 × 攻击策略 ASR",
      yLabel: "ASR (%)",
      groups,
      series
    });
  }

  function drawHorizontalBarPlot({ title, xLabel, groups, valueKey, color = "#3f8fc2", maxValue, valueFormatter }) {
    if (!groups.length) {
      drawNoDataPlot("暂无可视化数据");
      return;
    }

    const { context, width, height } = setupPlotCanvas();
    const left = 190;
    const right = 48;
    const top = 70;
    const bottom = 62;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const plotRight = left + plotWidth;
    const maxAxisValue = Math.max(1, maxValue || Math.max(...groups.map((group) => group[valueKey] || 0)));
    const barGap = 10;
    const barHeight = Math.min(34, (plotHeight - barGap * (groups.length - 1)) / groups.length);
    const totalHeight = groups.length * barHeight + (groups.length - 1) * barGap;
    const startY = top + Math.max(0, (plotHeight - totalHeight) / 2);
    const formatter = valueFormatter || ((value) => String(value));

    drawChartTitle(context, width, title);

    context.strokeStyle = "#d9d9d9";
    context.lineWidth = 1;
    context.fillStyle = "#111827";
    context.font = `12px ${PLOT_FONT}`;
    context.textAlign = "center";
    context.textBaseline = "top";

    for (let tick = 0; tick <= maxAxisValue; tick += maxAxisValue / 5) {
      const x = left + (tick / maxAxisValue) * plotWidth;
      context.beginPath();
      context.moveTo(x, top);
      context.lineTo(x, top + plotHeight);
      context.stroke();
      context.fillText(String(Math.round(tick)), x, top + plotHeight + 10);
    }

    context.strokeStyle = "#111827";
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(left, top);
    context.lineTo(left, top + plotHeight);
    context.lineTo(plotRight, top + plotHeight);
    context.stroke();

    context.fillStyle = "#111827";
    context.font = `600 13px ${PLOT_FONT}`;
    context.fillText(xLabel, left + plotWidth / 2, height - 24);

    groups.forEach((group, index) => {
      const y = startY + index * (barHeight + barGap);
      const value = group[valueKey] || 0;
      const barWidth = (value / maxAxisValue) * plotWidth;

      context.fillStyle = "#111827";
      context.font = `13px ${PLOT_FONT}`;
      context.textAlign = "right";
      context.textBaseline = "middle";
      context.fillText(truncateLabel(group.key, 22), left - 12, y + barHeight / 2);

      context.fillStyle = Array.isArray(color) ? color[index % color.length] : color;
      context.fillRect(left, y, barWidth, barHeight);

      context.fillStyle = "#111827";
      context.font = `700 12px ${PLOT_FONT}`;
      context.textAlign = "left";
      context.fillText(formatter(value), left + barWidth + 8, y + barHeight / 2);
    });
  }

  function drawCategoryRankPlot(results) {
    const groups = aggregateBy(results, getCategoryLabel).slice(0, 12);
    drawHorizontalBarPlot({
      title: "危害类别 ASR 排名",
      xLabel: "ASR (%)",
      groups,
      valueKey: "asr",
      color: "#df4548",
      maxValue: 100,
      valueFormatter: (value) => formatPercent(value)
    });
  }

  function drawRadarPlot(results, rowGetter, title) {
    const matrix = buildMatrix(results, rowGetter, getCategoryLabel, 4, 6);
    const axes = matrix.columns;
    const rows = matrix.rows.filter((row) => axes.some((axis) => row.cells.get(axis)?.total));
    const asrValues = rows.flatMap((row) => axes.map((axis) => row.cells.get(axis)?.asr || 0));
    const maxAxisValue = getAdaptivePercentAxisMax(asrValues);

    if (axes.length < 3 || !rows.length) {
      drawNoDataPlot("雷达图至少需要 3 个危害类别");
      return;
    }

    const { context, width, height } = setupPlotCanvas();
    const centerX = width / 2;
    const centerY = height / 2 + 18;
    const radius = Math.min(width * 0.28, height * 0.31);

    drawChartTitle(context, width, title);
    context.fillStyle = "#4b5563";
    context.font = `12px ${PLOT_FONT}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(`径向上限 ${formatCompactPercent(maxAxisValue)}`, width / 2, 54);

    context.strokeStyle = "#d9d9d9";
    context.lineWidth = 1;
    context.fillStyle = "#111827";
    context.font = `12px ${PLOT_FONT}`;
    context.textAlign = "center";
    context.textBaseline = "middle";

    for (let level = 1; level <= 5; level += 1) {
      const levelRadius = (radius * level) / 5;
      context.beginPath();
      axes.forEach((_, axisIndex) => {
        const angle = -Math.PI / 2 + (axisIndex / axes.length) * Math.PI * 2;
        const x = centerX + Math.cos(angle) * levelRadius;
        const y = centerY + Math.sin(angle) * levelRadius;
        if (axisIndex === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.closePath();
      context.stroke();
      context.fillText(
        formatCompactPercent((maxAxisValue * level) / 5),
        centerX + 4,
        centerY - levelRadius
      );
    }

    axes.forEach((axis, axisIndex) => {
      const angle = -Math.PI / 2 + (axisIndex / axes.length) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      context.beginPath();
      context.moveTo(centerX, centerY);
      context.lineTo(x, y);
      context.stroke();

      context.fillStyle = "#111827";
      context.font = `12px ${PLOT_FONT}`;
      context.textAlign = x < centerX - 8 ? "right" : x > centerX + 8 ? "left" : "center";
      context.textBaseline = y < centerY ? "bottom" : "top";
      context.fillText(truncateLabel(axis, 14), centerX + Math.cos(angle) * (radius + 20), centerY + Math.sin(angle) * (radius + 20));
    });

    rows.forEach((row, rowIndex) => {
      const color = PLOT_COLORS[rowIndex % PLOT_COLORS.length];
      context.beginPath();
      axes.forEach((axis, axisIndex) => {
        const asr = row.cells.get(axis)?.asr || 0;
        const angle = -Math.PI / 2 + (axisIndex / axes.length) * Math.PI * 2;
        const pointRadius = (clamp(asr, 0, maxAxisValue) / maxAxisValue) * radius;
        const x = centerX + Math.cos(angle) * pointRadius;
        const y = centerY + Math.sin(angle) * pointRadius;
        if (axisIndex === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      });
      context.closePath();
      context.fillStyle = `${color}33`;
      context.fill();
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.stroke();
    });

    const legendX = 24;
    const legendY = 62;
    rows.forEach((row, index) => {
      const y = legendY + index * 22;
      context.fillStyle = PLOT_COLORS[index % PLOT_COLORS.length];
      context.fillRect(legendX, y - 7, 16, 10);
      context.fillStyle = "#111827";
      context.font = `12px ${PLOT_FONT}`;
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(truncateLabel(row.key, 22), legendX + 24, y);
    });
  }

  function drawSuccessParetoPlot(results) {
    const groups = aggregateSuccessfulBy(results, getCategoryLabel)
      .filter((group) => group.unsafe > 0)
      .slice(0, 12);

    if (!groups.length) {
      drawNoDataPlot("暂无攻击成功样本");
      return;
    }

    const totalUnsafe = groups.reduce((sum, group) => sum + group.unsafe, 0);
    let cumulative = 0;
    const paretoGroups = groups.map((group) => {
      cumulative += group.unsafe;
      return {
        ...group,
        cumulativePercent: totalUnsafe ? (cumulative / totalUnsafe) * 100 : 0
      };
    });

    const { context, width, height } = setupPlotCanvas();
    const left = 78;
    const right = 86;
    const top = 70;
    const bottom = paretoGroups.length > 5 ? 122 : 88;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const plotBottom = top + plotHeight;
    const plotRight = left + plotWidth;
    const maxCount = Math.max(1, ...paretoGroups.map((group) => group.unsafe));
    const countAxisMax = Math.max(1, Math.ceil(maxCount));
    const countTicks = Array.from({ length: countAxisMax + 1 }, (_, index) => index);
    const rotateLabels = paretoGroups.length > 4 || paretoGroups.some((group) => group.key.length > 10);
    const linePoints = [];

    drawChartTitle(context, width, "攻击成功样本 Pareto 图");
    drawYAxisLabel(context, "unsafe 数量", 24, top + plotHeight / 2);

    context.strokeStyle = "#d9d9d9";
    context.lineWidth = 1;
    context.fillStyle = "#111827";
    context.font = `12px ${PLOT_FONT}`;
    context.textAlign = "right";
    context.textBaseline = "middle";

    countTicks.forEach((tick) => {
      const y = plotBottom - (tick / countAxisMax) * plotHeight;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(plotRight, y);
      context.stroke();
      context.fillText(String(tick), left - 10, y);
    });

    context.strokeStyle = "#111827";
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(left, top);
    context.lineTo(left, plotBottom);
    context.lineTo(plotRight, plotBottom);
    context.stroke();

    context.strokeStyle = "#111827";
    context.beginPath();
    context.moveTo(plotRight, top);
    context.lineTo(plotRight, plotBottom);
    context.stroke();

    context.fillStyle = "#111827";
    context.font = `12px ${PLOT_FONT}`;
    context.textAlign = "left";
    context.textBaseline = "middle";
    for (let tick = 0; tick <= 100; tick += 20) {
      const y = plotBottom - (tick / 100) * plotHeight;
      context.fillText(String(tick), plotRight + 10, y);
    }

    const bandWidth = plotWidth / paretoGroups.length;
    const barWidth = Math.min(72, bandWidth * 0.58);

    paretoGroups.forEach((group, index) => {
      const x = left + bandWidth * index + (bandWidth - barWidth) / 2;
      const barHeight = (group.unsafe / countAxisMax) * plotHeight;
      const y = plotBottom - barHeight;
      const lineX = x + barWidth / 2;
      const lineY = plotBottom - (group.cumulativePercent / 100) * plotHeight;

      context.fillStyle = "#3f8fc2";
      context.fillRect(x, y, barWidth, barHeight);
      context.fillStyle = "#111827";
      context.font = `700 12px ${PLOT_FONT}`;
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.fillText(String(group.unsafe), x + barWidth / 2, Math.max(top + 14, y - 5));

      context.save();
      context.translate(x + barWidth / 2, plotBottom + 18);
      if (rotateLabels) {
        context.rotate(-Math.PI / 5);
        context.textAlign = "right";
      } else {
        context.textAlign = "center";
      }
      context.fillStyle = "#111827";
      context.font = `12px ${PLOT_FONT}`;
      context.textBaseline = "top";
      context.fillText(truncateLabel(group.key, rotateLabels ? 16 : 12), 0, 0);
      context.restore();

      linePoints.push({ x: lineX, y: lineY, value: group.cumulativePercent });
    });

    context.strokeStyle = "#df4548";
    context.lineWidth = 2;
    context.beginPath();
    linePoints.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
    context.stroke();

    linePoints.forEach((point) => {
      context.fillStyle = "#df4548";
      context.beginPath();
      context.arc(point.x, point.y, 4, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = "#111827";
      context.font = `700 11px ${PLOT_FONT}`;
      context.textAlign = "center";
      context.textBaseline = "bottom";
      context.fillText(formatPercent(point.value, 0), point.x, point.y - 7);
    });

    context.fillStyle = "#111827";
    context.font = `600 12px ${PLOT_FONT}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("危害类别", left + plotWidth / 2, height - 24);
    context.save();
    context.translate(width - 24, top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillText("累计占比 (%)", 0, 0);
    context.restore();

    context.fillStyle = "#3f8fc2";
    context.fillRect(left, top - 36, 16, 11);
    context.fillStyle = "#111827";
    context.font = `12px ${PLOT_FONT}`;
    context.textAlign = "left";
    context.fillText("unsafe 数量", left + 22, top - 30);
    context.strokeStyle = "#df4548";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(left + 112, top - 30);
    context.lineTo(left + 138, top - 30);
    context.stroke();
    context.fillStyle = "#df4548";
    context.beginPath();
    context.arc(left + 125, top - 30, 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#111827";
    context.fillText("累计占比", left + 146, top - 30);
  }

  function getHeatFill(asr) {
    const t = clamp(asr / 100, 0, 1);
    const start = [248, 250, 252];
    const end = [223, 69, 72];
    const rgb = start.map((value, index) => Math.round(value + (end[index] - value) * t));
    return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
  }

  function drawHeatmapPlot(results, rowGetter, title) {
    const matrix = buildAsrMatrix(results, rowGetter);
    const categories = matrix.categories.slice(0, 10);
    const rows = matrix.rows.slice(0, 10);

    if (!categories.length || !rows.length) {
      drawNoDataPlot("暂无热力图数据");
      return;
    }

    const { context, width, height } = setupPlotCanvas();
    const left = 178;
    const right = 92;
    const top = 72;
    const bottom = 118;
    const availableWidth = width - left - right;
    const availableHeight = height - top - bottom;
    const cellWidth = availableWidth / categories.length;
    const cellHeight = Math.min(54, Math.max(34, availableHeight / rows.length));
    const heatmapWidth = cellWidth * categories.length;
    const heatmapHeight = cellHeight * rows.length;

    drawChartTitle(context, width, title);

    context.fillStyle = "#111827";
    context.font = `600 13px ${PLOT_FONT}`;
    context.textAlign = "right";
    context.textBaseline = "middle";

    rows.forEach((row, rowIndex) => {
      const y = top + rowIndex * cellHeight;
      context.fillText(truncateLabel(row.key, 20), left - 12, y + cellHeight / 2);

      categories.forEach((category, categoryIndex) => {
        const x = left + categoryIndex * cellWidth;
        const cell = row.cells.get(category);
        const asr = cell?.asr || 0;
        const total = cell?.total || 0;

        context.fillStyle = total ? getHeatFill(asr) : "#f3f4f6";
        context.fillRect(x, y, cellWidth, cellHeight);
        context.strokeStyle = "#ffffff";
        context.lineWidth = 2;
        context.strokeRect(x, y, cellWidth, cellHeight);

        context.fillStyle = total && asr >= 62 ? "#ffffff" : "#111827";
        context.font = `700 12px ${PLOT_FONT}`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(total ? formatPercent(asr, 0) : "-", x + cellWidth / 2, y + cellHeight / 2 - 5);
        context.font = `11px ${PLOT_FONT}`;
        context.fillText(total ? `${cell.unsafe}/${cell.total}` : "", x + cellWidth / 2, y + cellHeight / 2 + 11);
      });
    });

    context.strokeStyle = "#111827";
    context.lineWidth = 1.2;
    context.strokeRect(left, top, heatmapWidth, heatmapHeight);

    categories.forEach((category, index) => {
      const x = left + index * cellWidth + cellWidth / 2;
      context.save();
      context.translate(x, top + heatmapHeight + 18);
      context.rotate(-Math.PI / 5);
      context.fillStyle = "#111827";
      context.font = `12px ${PLOT_FONT}`;
      context.textAlign = "right";
      context.textBaseline = "top";
      context.fillText(truncateLabel(category, 15), 0, 0);
      context.restore();
    });

    const legendX = left + heatmapWidth + 28;
    const legendY = top;
    const legendWidth = 14;
    const legendHeight = Math.min(heatmapHeight, 180);

    for (let offset = 0; offset < legendHeight; offset += 1) {
      const value = 100 - (offset / Math.max(1, legendHeight - 1)) * 100;
      context.fillStyle = getHeatFill(value);
      context.fillRect(legendX, legendY + offset, legendWidth, 1);
    }
    context.strokeStyle = "#111827";
    context.strokeRect(legendX, legendY, legendWidth, legendHeight);
    context.fillStyle = "#111827";
    context.font = `12px ${PLOT_FONT}`;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText("100", legendX + 22, legendY);
    context.fillText("0", legendX + 22, legendY + legendHeight);
    context.save();
    context.translate(legendX + 58, legendY + legendHeight / 2);
    context.rotate(-Math.PI / 2);
    context.textAlign = "center";
    context.fillText("ASR (%)", 0, 0);
    context.restore();
  }

  function renderSelectedChart(results) {
    const chartType = elements.chartTypeSelect.value || "category_rank_asr";
    if (chartType === "category_rank_asr") {
      drawCategoryRankPlot(results);
      return;
    }
    if (chartType === "model_category_heatmap") {
      drawHeatmapPlot(results, getModelLabel, "模型 × 危害类别 的 ASR");
      return;
    }
    if (chartType === "model_radar") {
      drawRadarPlot(results, getModelLabel, "模型风险雷达图");
      return;
    }
    if (chartType === "success_pareto") {
      drawSuccessParetoPlot(results);
      return;
    }
    drawCategoryRankPlot(results);
  }

  async function captureReportCharts(results) {
    const previousChartType = elements.chartTypeSelect.value || "category_rank_asr";
    const charts = [];

    for (const chart of REPORT_CHARTS) {
      elements.chartTypeSelect.value = chart.value;
      renderSelectedChart(results);
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      charts.push({
        title: chart.title,
        dataUrl: elements.resultChartCanvas.toDataURL("image/png")
      });
    }

    elements.chartTypeSelect.value = previousChartType;
    renderSelectedChart(results);
    return charts;
  }

  function renderDatasetArea() {
    const { currentDataset } = store.getState();
    const benchmarkVisible = isRegisteredBenchmark(currentDataset);
    elements.customDatasetArea.classList.toggle("hidden", currentDataset !== "custom");
    elements.benchmarkOptions.classList.toggle(
      "hidden",
      !benchmarkVisible
    );
    if (benchmarkVisible) {
      renderBenchmarkSubsetSelect();
    }
    renderBenchmarkFilters().catch((error) => {
      addLog(`Benchmark 筛选项加载失败: ${error.message}`);
    });
  }

  function renderReportPanels(results) {
    const topFailures = getTopFailureCases(results, 6);
    elements.topFailureList.innerHTML = topFailures.length
      ? topFailures
          .map(
            (item) => `
              <div class="report-item">
                <div class="report-item-title">
                  <span>${escapeHtml(item.id)}</span>
                  <span class="score-unsafe">${escapeHtml(item.score)}</span>
                </div>
                <div class="report-item-meta">${escapeHtml(item.category || "未分类")} · ${escapeHtml(item.result || "unsafe")}</div>
                <div class="report-item-text">${escapeHtml(truncateText(item.prompt, 130))}</div>
              </div>
            `
          )
          .join("")
      : '<div class="muted">暂无失败案例</div>';

    const reviewCases = getJudgeReviewCases(results, 6);
    elements.judgeReviewList.innerHTML = reviewCases.length
      ? reviewCases
          .map((item) => {
            const votes = Array.isArray(item.judge_votes) ? item.judge_votes : [];
            const voteSummary = votes.length
              ? votes.map((vote) => `${vote.name || vote.id}: ${vote.status === "error" ? "error" : vote.label}`).join(" | ")
              : item.judge_label || "-";
            const agreement = Number.isFinite(Number(item.judge_agreement))
              ? formatPercent(Number(item.judge_agreement) * 100, 0)
              : "-";
            return `
              <div class="report-item">
                <div class="report-item-title">
                  <span>${escapeHtml(item.id)}</span>
                  <span class="score-ambiguous">${escapeHtml(item.label)}</span>
                </div>
                <div class="report-item-meta">${escapeHtml(`一致率 ${agreement} · unknown ${item.judge_unknown_votes || 0} · error ${item.judge_error_votes || 0}`)}</div>
                <div class="report-item-text">${escapeHtml(truncateText(voteSummary, 150))}</div>
              </div>
            `;
          })
          .join("")
      : '<div class="muted">暂无 Judge 分歧或不确定样本</div>';
  }

  function renderResults(results) {
    const summary = summarizeResults(results);
    elements.statsGrid.innerHTML = `
      <div class="stat-card"><div class="stat-value">${summary.total}</div><div class="stat-label">总用例数</div></div>
      <div class="stat-card"><div class="stat-value score-safe">${summary.safe}</div><div class="stat-label">安全拒绝</div></div>
      <div class="stat-card"><div class="stat-value score-unsafe">${summary.unsafe}</div><div class="stat-label">越狱成功</div></div>
      <div class="stat-card"><div class="stat-value score-ambiguous">${summary.ambiguous}</div><div class="stat-label">需复核</div></div>
      <div class="stat-card"><div class="stat-value score-unsafe">${summary.behaviorAsr.toFixed(1)}%</div><div class="stat-label">原始样本 ASR</div></div>
    `;

    elements.resultTableBody.innerHTML = results
      .map((item) => {
        const scoreClass =
          item.label === "safe"
            ? "score-safe"
            : item.label === "unsafe"
              ? "score-unsafe"
              : "score-ambiguous";
        const judgeVotes = Array.isArray(item.judge_votes) ? item.judge_votes : [];
        const judgeSummary = judgeVotes.length
          ? judgeVotes
              .map((vote) => `${vote.name || vote.id}: ${vote.status === "error" ? "error" : vote.label}`)
              .join(" | ")
          : item.judge_model || "-";
        const agreement =
          Number.isFinite(Number(item.judge_agreement))
            ? `${Math.round(Number(item.judge_agreement) * 100)}%`
            : "-";

        return `
          <tr>
            <td>${escapeHtml(item.id)}</td>
            <td>${escapeHtml(item.source)}</td>
            <td>${escapeHtml(item.attack_strategy_label || item.attack_type || "-")}</td>
            <td>${escapeHtml(item.category || "-")}</td>
            <td class="${scoreClass}">${escapeHtml(item.score)}</td>
            <td class="${scoreClass}">${escapeHtml(item.error?.message || item.result)}</td>
            <td>
              <div>${escapeHtml(`${item.judge_safe_votes ?? 0} safe / ${item.judge_unsafe_votes ?? 0} unsafe`)}</div>
              <div class="judge-votes">${escapeHtml(`一致率 ${agreement} | ${judgeSummary}`)}</div>
            </td>
          </tr>
        `;
      })
      .join("");

    renderReportPanels(results);
    elements.resultCard.classList.remove("hidden");
    window.requestAnimationFrame(() => renderSelectedChart(results));
  }

  function collectModelConfig() {
    if (elements.modelPreset.value === "llama") {
      return {
        preset: "llama",
        modelName: LOCAL_LLAMA_MODEL_NAME,
        apiUrl: LOCAL_LLAMA_API_URL,
        apiKey: ""
      };
    }

    return {
      preset: "custom",
      modelName: elements.customModelName.value.trim(),
      apiUrl: elements.apiUrl.value.trim(),
      apiKey: elements.apiKey.value.trim()
    };
  }

  function collectJudgeConfig(targetModelConfig) {
    if (elements.judgeModeSelect.value === "multi") {
      const judges = [];
      if (elements.multiJudgeLlama.checked) {
        judges.push({
          id: "llama",
          name: "Local Llama judge",
          preset: "llama",
          type: "llm",
          mode: "official_jbb",
          apiUrl: LOCAL_LLAMA_API_URL,
          apiKey: "",
          modelName: LOCAL_LLAMA_MODEL_NAME
        });
      }
      if (elements.multiJudgeGpt.checked) {
        judges.push({
          id: "gpt_compatible",
          name: "GPT-compatible judge",
          preset: "custom",
          type: "llm",
          mode: "official_jbb",
          apiUrl: elements.multiJudgeGptApiUrl.value.trim(),
          apiKey: elements.multiJudgeGptApiKey.value.trim(),
          modelName: elements.multiJudgeGptModelName.value.trim()
        });
      }
      if (elements.multiJudgeRule.checked) {
        judges.push({
          id: "rule_based",
          name: "Rule-based fallback",
          preset: "rule_based",
          type: "rule_based",
          mode: "rule_based",
          modelName: "safecompass-rule-based"
        });
      }

      return {
        preset: "multi",
        mode: "multi_judge",
        aggregation: "majority_vote",
        primaryJudgeId: judges.find((judge) => judge.type === "llm")?.id || judges[0]?.id || null,
        judges
      };
    }

    if (elements.judgePreset.value === "same_as_target") {
      return {
        preset: "same_as_target",
        mode: "official_jbb",
        apiUrl: targetModelConfig.apiUrl,
        apiKey: targetModelConfig.apiKey,
        modelName: targetModelConfig.modelName
      };
    }

    if (elements.judgePreset.value === "custom") {
      return {
        preset: "custom",
        mode: "official_jbb",
        apiUrl: elements.judgeApiUrl.value.trim(),
        apiKey: elements.judgeApiKey.value.trim(),
        modelName: elements.judgeModelName.value.trim()
      };
    }

    return {
      preset: "llama",
      mode: "official_jbb",
      apiUrl: LOCAL_LLAMA_API_URL,
      apiKey: "",
      modelName: LOCAL_LLAMA_MODEL_NAME
    };
  }

  function collectEvaluationOptions() {
    const targetModelConfig = collectModelConfig();
    const judgeConfig = collectJudgeConfig(targetModelConfig);
    return {
      limit: Number(elements.caseLimit.value || 20),
      temperature: 0,
      maxTokens: LOCAL_LLAMA_MAX_TOKENS,
      disableReasoning: true,
      attackFamily: ATTACK_FAMILY,
      attackStrategy: elements.attackStrategySelect.value,
      filters: {
        category: elements.categoryFilter.value
      },
      judge: judgeConfig
    };
  }

  function getJudgeConfigSummary(judgeConfig) {
    if (judgeConfig.mode === "multi_judge") {
      const names = (judgeConfig.judges || []).map((judge) => judge.name || judge.modelName || judge.id);
      return `多 Judge majority vote: ${names.join(" / ") || "未配置"}`;
    }
    return `单 Judge: ${judgeConfig.modelName || judgeConfig.preset || "未配置"}`;
  }

  function getConfiguredJudgeModels(judgeConfig) {
    if (judgeConfig.mode === "multi_judge") {
      return (judgeConfig.judges || [])
        .map((judge) => judge.modelName || judge.name || judge.id)
        .filter(Boolean)
        .join(", ");
    }
    return judgeConfig.modelName || "";
  }

  function validateJudgeConfig(judgeConfig) {
    if (judgeConfig.mode === "multi_judge") {
      const judges = judgeConfig.judges || [];
      if (!judges.length) {
        return "请至少选择一个 Judge";
      }
      const invalidJudge = judges.find(
        (judge) => judge.type !== "rule_based" && (!judge.apiUrl || !judge.modelName)
      );
      if (invalidJudge) {
        return `${invalidJudge.name || invalidJudge.id} 缺少 API Base URL 或模型名称`;
      }
      return "";
    }
    if (!judgeConfig.apiUrl) {
      return "请填写 Judge API Base URL";
    }
    if (!judgeConfig.modelName) {
      return "请填写 Judge 模型名称";
    }
    return "";
  }

  function buildExportContext() {
    const targetModelConfig = collectModelConfig();
    const evaluationOptions = collectEvaluationOptions();
    const currentDataset = store.getState().currentDataset;
    return {
      targetModelConfig,
      judgeConfig: evaluationOptions.judge,
      evaluationOptions,
      dataset: currentDataset,
      datasetSubset: getSelectedDatasetSubset(currentDataset)
    };
  }

  function getCustomCases() {
    const { customPrompts, customFileData } = store.getState();
    return [
      ...customPrompts.map((prompt, index) =>
        normalizeCustomInputCase(
          {
            id: `manual_${index}`,
            prompt,
            source: "自定义",
            source_type: "manual"
          },
          index,
          "manual"
        )
      ),
      ...customFileData.map((item) => ({
        ...item,
        source: "自定义",
        attack_type: item.attack_type || "-",
        category: item.category || "-"
      }))
    ];
  }

  async function handleFileUpload(file) {
    const content = await file.text();
    const parsed = file.name.toLowerCase().endsWith(".json") ? parseJson(content) : parseCsv(content);
    store.setState({ customFileData: parsed });
    elements.fileName.textContent = file.name;
    elements.filePreview.textContent = `已加载 ${parsed.length} 条`;
    renderCustomDataStats();
    addLog(`已导入并规范化文件 ${file.name}，共 ${parsed.length} 条测试用例`);
  }

  async function handleRun() {
    const { currentDataset, isRunning } = store.getState();
    if (isRunning) {
      return;
    }

    const modelConfig = collectModelConfig();
    const evaluationOptions = collectEvaluationOptions();
    const judgeConfig = evaluationOptions.judge || {};
    if (!modelConfig.apiUrl) {
      addLog("缺少被测模型 API Base URL");
      window.alert("请填写被测模型 API Base URL");
      return;
    }
    if (!modelConfig.modelName) {
      addLog("缺少被测模型名称");
      window.alert("请填写被测模型名称");
      return;
    }
    const judgeConfigError = validateJudgeConfig(judgeConfig);
    if (judgeConfigError) {
      addLog(judgeConfigError);
      window.alert(judgeConfigError);
      return;
    }

    const customCases = getCustomCases();
    if (currentDataset === "custom" && !customCases.length) {
      addLog("自定义数据集为空");
      window.alert("请先导入文件或添加测试用例");
      return;
    }

    store.setState({ isRunning: true, results: [] });
    elements.progressCard.classList.remove("hidden");
    elements.resultCard.classList.add("hidden");
    elements.progressFill.dataset.percent = "0";
    elements.progressFill.style.width = "0%";
    elements.progressStatus.textContent = "评测进度 0%";

    const datasetSubset = getSelectedDatasetSubset(currentDataset);
    addLog(
      `开始评测，被测模型 ${modelConfig.modelName}，数据集 ${currentDataset}${datasetSubset ? `/${datasetSubset}` : ""}`
    );
    addLog(
      `评测参数: 最大样本 ${evaluationOptions.limit}`
    );
    if (isRegisteredBenchmark(currentDataset)) {
      addLog(
        `筛选条件: 危害类别 ${evaluationOptions.filters.category || "all"}`
      );
    }
    addLog(`攻击方法: ${getSelectedOptionLabel(elements.attackStrategySelect)}`);
    if (evaluationOptions.attackStrategy === "human_jailbreaks") {
      addLog("Human Jailbreaks 使用 HarmBench 官方模板，并会跳过估算超过 2048 上下文预算的超长模板");
    }
    addLog(`判分方式: ${getJudgeConfigSummary(judgeConfig)}`);
    addLog(modelConfig.apiKey ? "检测到被测模型 API 密钥" : "被测模型未提供 API 密钥，默认视为本地或免鉴权服务");
    const hasJudgeApiKey =
      judgeConfig.mode === "multi_judge"
        ? (judgeConfig.judges || []).some((judge) => judge.apiKey)
        : Boolean(judgeConfig.apiKey);
    addLog(hasJudgeApiKey ? "检测到 Judge API 密钥" : "Judge 未提供 API 密钥，默认视为本地或免鉴权服务");
    addLog(`Judge 模型: ${getConfiguredJudgeModels(judgeConfig) || "rule-based"}`);

    if (isRegisteredBenchmark(currentDataset)) {
      const benchmark = getBenchmark(currentDataset);
      addLog(
        `${benchmark.name} 已接入，来源 ${getBenchmarkSourceLabel(benchmark)}，当前子集 ${datasetSubset || benchmark.defaultSubset}`
      );
    }

    try {
      const results = await evaluator.run({
        dataset: currentDataset,
        customCases,
        datasetSubset,
        modelConfig,
        targetModelConfig: modelConfig,
        evaluationOptions,
        onProgress(progress) {
          const progressInfo =
            typeof progress === "number"
              ? {
                  percent: progress,
                  message: `正在执行评测... ${progress}%`
                }
              : progress || {};
          const currentPercent = Number.parseFloat(elements.progressFill.dataset.percent || "0");
          const nextPercent = clamp(Number(progressInfo.percent || 0), 0, 100);
          const percent = Math.max(currentPercent, nextPercent);
          elements.progressFill.dataset.percent = String(percent);
          elements.progressFill.style.width = `${percent}%`;
          elements.progressStatus.textContent = `评测进度 ${Math.round(percent)}%`;
        }
      });

      store.setState({ isRunning: false, results });
      renderResults(results);
      elements.progressCard.classList.add("hidden");

      const summary = summarizeResults(results);
      const asr = summary.total ? ((summary.unsafe / summary.total) * 100).toFixed(1) : "0.0";
      addLog(`评测完成，ASR ${asr}%${summary.ambiguous ? `，需复核 ${summary.ambiguous} 条` : ""}`);
      if (results.runId || results.runPath) {
        addLog(`运行记录已保存: ${results.runPath || results.runId}`);
      }
    } catch (error) {
      store.setState({ isRunning: false, results: [] });
      elements.progressCard.classList.add("hidden");
      addLog(`评测失败: ${error.message}`);
      window.alert(`评测失败: ${error.message}`);
    }
  }

  function resetWorkspace() {
    store.reset();
    elements.fileName.textContent = "未选择文件";
    elements.filePreview.textContent = "";
    renderDatasetTags();
    renderPromptList();
    renderCustomDataStats();
    renderDatasetArea();
    renderSelects();
    elements.progressCard.classList.add("hidden");
    elements.resultCard.classList.add("hidden");
    addLog("已重置工作区配置");
  }

  function bindEvents() {
    elements.datasetTags.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-dataset]");
      if (!trigger) {
        return;
      }

      store.setState({ currentDataset: trigger.dataset.dataset });
      renderDatasetTags();
      renderDatasetArea();
      addLog(`已切换到数据集 ${trigger.dataset.dataset}`);
    });

    elements.uploadBtn.addEventListener("click", () => {
      elements.fileUpload.click();
    });

    elements.fileUpload.addEventListener("change", async (event) => {
      const [file] = event.target.files || [];
      if (!file) {
        return;
      }

      try {
        await handleFileUpload(file);
      } catch (error) {
        addLog(`文件解析失败: ${error.message}`);
        window.alert(`文件解析失败: ${error.message}`);
      }
    });

    elements.addPromptBtn.addEventListener("click", () => {
      const value = elements.newPrompt.value.trim();
      if (!value) {
        return;
      }

      const { customPrompts } = store.getState();
      store.setState({ customPrompts: [...customPrompts, value] });
      elements.newPrompt.value = "";
      renderPromptList();
      renderCustomDataStats();
      addLog("已添加手动测试用例");
    });

    elements.promptList.addEventListener("click", (event) => {
      const trigger = event.target.closest("[data-remove-index]");
      if (!trigger) {
        return;
      }

      const { customPrompts } = store.getState();
      const nextPrompts = customPrompts.filter(
        (_, index) => index !== Number(trigger.dataset.removeIndex)
      );
      store.setState({ customPrompts: nextPrompts });
      renderPromptList();
      renderCustomDataStats();
      addLog("已删除手动测试用例");
    });

    elements.runBtn.addEventListener("click", handleRun);
    elements.modelPreset.addEventListener("change", renderModelConfigArea);
    elements.judgeModeSelect.addEventListener("change", renderJudgeConfigArea);
    elements.judgePreset.addEventListener("change", renderJudgeConfigArea);
    elements.multiJudgeGpt.addEventListener("change", renderJudgeConfigArea);
    elements.chartTypeSelect.addEventListener("change", () => {
      renderSelectedChart(store.getState().results || []);
    });
    window.addEventListener("resize", () => {
      const { results } = store.getState();
      if (!results?.length || elements.resultCard.classList.contains("hidden")) {
        return;
      }
      window.requestAnimationFrame(() => renderSelectedChart(results));
    });
    elements.benchmarkSubsetSelect.addEventListener("change", () => {
      renderBenchmarkFilters().catch((error) => {
        addLog(`Benchmark 筛选项加载失败: ${error.message}`);
      });
    });
    elements.resetBtn.addEventListener("click", resetWorkspace);
    elements.clearLogBtn.addEventListener("click", () => {
      elements.logArea.innerHTML = "";
      addLog("日志已清空");
    });
    elements.exportBtn.addEventListener("click", () => {
      const results = store.getState().results || [];
      const exportContext = buildExportContext();
      const payload = {
        exportedAt: new Date().toISOString(),
        config: exportContext.targetModelConfig,
        ...exportContext,
        runId: results.runId || null,
        runPath: results.runPath || null,
        results
      };
      exportJson("safecompass-results.json", payload);
      addLog("已导出结果 JSON");
    });
    elements.exportMarkdownBtn.addEventListener("click", async () => {
      const results = store.getState().results || [];
      const exportedAt = new Date().toISOString();
      const charts = await captureReportCharts(results);
      const report = buildMarkdownReport({
        results,
        config: buildExportContext(),
        exportedAt,
        charts
      });
      exportMarkdown("safecompass-report.md", report);
      addLog("已导出 Markdown 报告");
    });
  }

  renderSelects();
  renderDatasetTags();
  renderPromptList();
  renderCustomDataStats();
  renderDatasetArea();
  bindEvents();
  addLog("SafeCompass Framework 已初始化");
}
