import {
  attackTypeOptions,
  categoryOptions,
  datasetOptions
} from "./config/datasets.js";
import { exportJson } from "./services/exporter.js";
import { createApiEvaluator } from "./services/evaluator.js";
import { createStore } from "./state/store.js";
import { $, createOptions, escapeHtml } from "./utils/dom.js";
import { formatTimestamp, summarizeResults } from "./utils/format.js";
import { getBenchmark } from "./benchmarks/registry.js";

function getInitialFormValues() {
  return {
    apiUrl: "https://api.openai.com/v1",
    apiKey: "",
    customModelName: "",
    caseLimit: "20",
    datasetSubset: "behaviors"
  };
}

function parseCsv(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (!lines.length) {
    return [];
  }

  const headers = lines[0].split(",").map((item) => item.trim());
  const promptIndex = headers.findIndex((item) => item === "prompt");
  if (promptIndex === -1) {
    throw new Error("CSV 需要包含 prompt 列");
  }

  return lines.slice(1).map((line, index) => {
    const columns = line.split(",");
    return {
      id: `csv_${index}`,
      prompt: columns[promptIndex] || ""
    };
  });
}

function parseJson(content) {
  const json = JSON.parse(content);
  if (Array.isArray(json)) {
    return json.map((item, index) => ({
      id: item.id || `json_${index}`,
      prompt: item.prompt || ""
    }));
  }

  if (Array.isArray(json.cases)) {
    return json.cases.map((item, index) => ({
      id: item.id || `case_${index}`,
      prompt: item.prompt || ""
    }));
  }

  throw new Error("JSON 需要是数组或包含 cases 数组");
}

export function bootstrapApp() {
  const store = createStore();
  const evaluator = createApiEvaluator();

  const elements = {
    apiUrl: $("#apiUrl"),
    apiKey: $("#apiKey"),
    customModelName: $("#customModelName"),
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
    attackTypeFilter: $("#attackTypeFilter"),
    categoryFilter: $("#categoryFilter"),
    datasetSubsetField: $("#datasetSubsetField"),
    datasetSubsetSelect: $("#datasetSubsetSelect"),
    caseLimit: $("#caseLimit"),
    runBtn: $("#runBtn"),
    resetBtn: $("#resetBtn"),
    progressCard: $("#progressCard"),
    progressFill: $("#progressFill"),
    progressStatus: $("#progressStatus"),
    resultCard: $("#resultCard"),
    statsGrid: $("#statsGrid"),
    resultTableBody: $("#resultTableBody"),
    exportBtn: $("#exportBtn"),
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
    elements.attackTypeFilter.innerHTML = createOptions(attackTypeOptions);
    elements.categoryFilter.innerHTML = createOptions(categoryOptions);

    elements.apiUrl.value = initialForm.apiUrl;
    elements.apiKey.value = initialForm.apiKey;
    elements.customModelName.value = initialForm.customModelName;
    elements.caseLimit.value = initialForm.caseLimit;
    elements.datasetSubsetSelect.value = initialForm.datasetSubset;
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

  function renderDatasetArea() {
    const { currentDataset } = store.getState();
    elements.customDatasetArea.classList.toggle("hidden", currentDataset !== "custom");
    elements.datasetSubsetField.classList.toggle("hidden", currentDataset !== "jailbreakbench");
  }

  function renderResults(results) {
    const summary = summarizeResults(results);
    elements.statsGrid.innerHTML = `
      <div class="stat-card"><div class="stat-value">${summary.total}</div><div class="stat-label">总用例数</div></div>
      <div class="stat-card"><div class="stat-value score-safe">${summary.safe}</div><div class="stat-label">安全拒绝</div></div>
      <div class="stat-card"><div class="stat-value score-unsafe">${summary.unsafe}</div><div class="stat-label">越狱成功</div></div>
      <div class="stat-card"><div class="stat-value">${summary.avgScore.toFixed(1)}</div><div class="stat-label">平均得分</div></div>
    `;

    elements.resultTableBody.innerHTML = results
      .map((item) => {
        const scoreClass =
          item.label === "safe"
            ? "score-safe"
            : item.label === "unsafe"
              ? "score-unsafe"
              : "score-ambiguous";

        return `
          <tr>
            <td>${escapeHtml(item.id)}</td>
            <td>${escapeHtml(item.source)}</td>
            <td>${escapeHtml(item.attack_type || "-")}</td>
            <td>${escapeHtml(item.category || "-")}</td>
            <td class="${scoreClass}">${escapeHtml(item.score)}</td>
            <td class="${scoreClass}">${escapeHtml(item.result)}</td>
          </tr>
        `;
      })
      .join("");

    elements.resultCard.classList.remove("hidden");
  }

  function collectModelConfig() {
    const modelName = elements.customModelName.value.trim();

    return {
      modelName,
      apiUrl: elements.apiUrl.value.trim(),
      apiKey: elements.apiKey.value.trim()
    };
  }

  function getSelectedDatasetSubset(datasetId) {
    if (datasetId !== "jailbreakbench") {
      return null;
    }
    return elements.datasetSubsetSelect.value;
  }

  function collectEvaluationOptions() {
    return {
      limit: Number(elements.caseLimit.value || 20),
      temperature: 0
    };
  }

  function getCustomCases() {
    const { customPrompts, customFileData } = store.getState();
    return [
      ...customPrompts.map((prompt, index) => ({
        id: `manual_${index}`,
        prompt,
        source: "自定义",
        attack_type: "-",
        category: "-"
      })),
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
    const parsed = file.name.endsWith(".json") ? parseJson(content) : parseCsv(content);
    store.setState({ customFileData: parsed });
    elements.fileName.textContent = file.name;
    elements.filePreview.textContent = `已加载 ${parsed.length} 条`;
    renderCustomDataStats();
    addLog(`已导入文件 ${file.name}，共 ${parsed.length} 条测试用例`);
  }

  async function handleRun() {
    const { currentDataset, isRunning } = store.getState();
    if (isRunning) {
      return;
    }

    const modelConfig = collectModelConfig();
    const evaluationOptions = collectEvaluationOptions();
    if (!modelConfig.apiUrl) {
      addLog("缺少 API Base URL");
      window.alert("请填写 API Base URL");
      return;
    }
    if (!modelConfig.modelName) {
      addLog("缺少模型名称");
      window.alert("请填写模型名称");
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
    elements.progressFill.style.width = "0%";
    elements.progressStatus.textContent = "准备执行评测";

    const datasetSubset = getSelectedDatasetSubset(currentDataset);
    addLog(
      `开始评测，模型 ${modelConfig.modelName}，数据集 ${currentDataset}${datasetSubset ? `/${datasetSubset}` : ""}`
    );
    addLog(
      `评测参数: 最大样本 ${evaluationOptions.limit}`
    );
    addLog(modelConfig.apiKey ? "检测到 API 密钥" : "未提供 API 密钥，默认视为本地或免鉴权服务");

    if (currentDataset === "jailbreakbench") {
      const benchmark = getBenchmark(currentDataset);
      addLog(
        `JailbreakBench 已接入，来源 ${benchmark.hfDataset}，当前子集 ${datasetSubset || benchmark.defaultSubset}`
      );
    }

    try {
      const results = await evaluator.run({
        dataset: currentDataset,
        customCases,
        datasetSubset,
        modelConfig,
        evaluationOptions,
        onProgress(progress) {
          elements.progressFill.style.width = `${progress}%`;
          elements.progressStatus.textContent = `正在执行评测... ${progress}%`;
        }
      });

      store.setState({ isRunning: false, results });
      renderResults(results);
      elements.progressCard.classList.add("hidden");

      const summary = summarizeResults(results);
      const asr = summary.total ? ((summary.unsafe / summary.total) * 100).toFixed(1) : "0.0";
      addLog(`评测完成，ASR ${asr}%`);
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
    elements.resetBtn.addEventListener("click", resetWorkspace);
    elements.clearLogBtn.addEventListener("click", () => {
      elements.logArea.innerHTML = "";
      addLog("日志已清空");
    });
    elements.exportBtn.addEventListener("click", () => {
      const payload = {
        exportedAt: new Date().toISOString(),
        config: collectModelConfig(),
        evaluationOptions: collectEvaluationOptions(),
        dataset: store.getState().currentDataset,
        datasetSubset: getSelectedDatasetSubset(store.getState().currentDataset),
        results: store.getState().results
      };
      exportJson("safecompass-results.json", payload);
      addLog("已导出结果 JSON");
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
