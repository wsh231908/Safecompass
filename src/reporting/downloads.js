export function exportBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportJson(filename, payload) {
  exportBlob(filename, JSON.stringify(payload, null, 2), "application/json");
}

export function exportMarkdown(filename, content) {
  exportBlob(filename, content, "text/markdown;charset=utf-8");
}
