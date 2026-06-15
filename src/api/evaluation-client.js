import { buildAttackAttempts } from "../attacks/strategies.js";
import { loadBenchmarkCases } from "../benchmarks/loader.js";

async function postEvaluationJob(payload) {
  const response = await fetch("/api/evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "评测服务调用失败");
  }

  return data;
}

async function postStreamingEvaluationJob(payload, onProgress) {
  const response = await fetch("/api/evaluate-stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "评测服务调用失败");
  }

  if (!response.body) {
    return postEvaluationJob(payload);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalPayload = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      const event = JSON.parse(trimmed);
      if (event.type === "error") {
        throw new Error(event.message || "评测服务调用失败");
      }
      if (event.type === "complete") {
        finalPayload = event.payload;
      }
      reportProgress(onProgress, event);
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    const event = JSON.parse(trailing);
    if (event.type === "error") {
      throw new Error(event.message || "评测服务调用失败");
    }
    if (event.type === "complete") {
      finalPayload = event.payload;
    }
    reportProgress(onProgress, event);
  }

  if (!finalPayload) {
    throw new Error("评测流结束但缺少完成结果");
  }

  return finalPayload;
}

function matchesFilter(value, selectedValue) {
  if (!selectedValue || selectedValue === "all") {
    return true;
  }
  return String(value || "-") === selectedValue;
}

function reportProgress(onProgress, progress) {
  if (typeof onProgress === "function") {
    onProgress(progress);
  }
}

export function createApiEvaluator() {
  return {
    async run({
      dataset,
      customCases,
      datasetSubset,
      modelConfig,
      evaluationOptions,
      onProgress
    }) {
      reportProgress(onProgress, {
        phase: "prepare",
        percent: 0,
        completed: 0,
        total: 0,
        message: "正在准备评测数据"
      });

      let selectedCases = customCases;
      if (dataset !== "custom") {
        const loaded = await loadBenchmarkCases(dataset, datasetSubset);
        selectedCases = loaded.records;
      }

      const filters = evaluationOptions.filters || {};
      selectedCases = selectedCases.filter(
        (testCase) => matchesFilter(testCase.category, filters.category)
      );

      const limit = Number(evaluationOptions.limit || 20);
      const cappedBaseCases = limit > 0 ? selectedCases.slice(0, limit) : selectedCases;
      const attackStrategy = evaluationOptions.attackStrategy || "direct";
      const cappedCases = cappedBaseCases.flatMap((testCase) =>
        buildAttackAttempts(testCase, attackStrategy)
      );

      if (!cappedCases.length) {
        reportProgress(onProgress, {
          phase: "complete",
          percent: 100,
          completed: 0,
          total: 0,
          message: "没有符合条件的评测样本"
        });
        return [];
      }

      reportProgress(onProgress, {
        phase: "run",
        percent: 0,
        completed: 0,
        total: cappedCases.length,
        message: `正在执行评测 0/${cappedCases.length}（0%）`
      });

      const payload = await postStreamingEvaluationJob({
        dataset,
        datasetSubset,
        modelConfig,
        targetModelConfig: modelConfig,
        evaluationOptions,
        cases: cappedCases
      }, onProgress);
      const results = [];
      results.push(...(payload.results || []));
      results.runId = payload.runId;
      results.runPath = payload.runPath;
      results.summary = payload.summary;

      reportProgress(onProgress, {
        phase: "complete",
        percent: 100,
        completed: cappedCases.length,
        total: cappedCases.length,
        message: `评测完成 ${cappedCases.length}/${cappedCases.length}（100%）`
      });

      return results;
    }
  };
}
