import { buildAttackAttempts } from "./attack-strategies.js";
import { loadBenchmarkCases } from "./benchmark-loader.js";

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

      const results = [];
      reportProgress(onProgress, {
        phase: "run",
        percent: 0,
        completed: 0,
        total: cappedCases.length,
        message: `正在执行评测 0/${cappedCases.length}（0%）`
      });

      for (let index = 0; index < cappedCases.length; index += 1) {
        const testCase = cappedCases[index];
        const payload = await postEvaluationJob({
          dataset,
          datasetSubset,
          modelConfig,
          evaluationOptions,
          cases: [testCase]
        });

        results.push(...(payload.results || []));
        const completed = index + 1;
        const percent = Math.round((completed / cappedCases.length) * 100);
        reportProgress(onProgress, {
          phase: completed === cappedCases.length ? "complete" : "run",
          percent,
          completed,
          total: cappedCases.length,
          currentId: testCase.id,
          message: `正在执行评测 ${completed}/${cappedCases.length}（${percent}%）`
        });
      }

      return results;
    }
  };
}
