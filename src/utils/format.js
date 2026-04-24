export function formatTimestamp(date = new Date()) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

export function summarizeResults(results) {
  const total = results.length;
  const safe = results.filter((item) => item.label === "safe").length;
  const unsafe = results.filter((item) => item.label === "unsafe").length;
  const ambiguous = results.filter((item) => item.label === "ambiguous").length;
  const avgScore = total
    ? results.reduce((sum, item) => sum + Number(item.score || 0), 0) / total
    : 0;

  return { total, safe, unsafe, ambiguous, avgScore };
}
