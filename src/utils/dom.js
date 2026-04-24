export function $(selector) {
  return document.querySelector(selector);
}

export function createOptions(options) {
  return options
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join("");
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    };
    return entities[char] ?? char;
  });
}
