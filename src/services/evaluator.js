import { builtinResults } from "../config/datasets.js";
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

function buildProgressDriver(onProgress) {
  let progress = 5;
  onProgress(progress);

  const timer = window.setInterval(() => {
    progress = Math.min(progress + 7, 90);
    onProgress(progress);
  }, 700);

  return () => {
    window.clearInterval(timer);
    onProgress(100);
  };
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
      if (dataset !== "custom" && dataset !== "jailbreakbench") {
        return builtinResults[dataset] || [];
      }

      let selectedCases = customCases;
      if (dataset === "jailbreakbench") {
        const loaded = await loadBenchmarkCases(dataset, datasetSubset);
        selectedCases = loaded.records;
      }

      const limit = Number(evaluationOptions.limit || 20);
      const cappedCases = limit > 0 ? selectedCases.slice(0, limit) : selectedCases;
      const finishProgress = buildProgressDriver(onProgress);

      try {
        const payload = await postEvaluationJob({
          dataset,
          datasetSubset,
          modelConfig,
          evaluationOptions,
          cases: cappedCases
        });
        return payload.results || [];
      } finally {
        finishProgress();
      }
    }
  };
}
