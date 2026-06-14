import { $, escapeHtml } from "./utils/dom.js";

const STORAGE_KEY = "safecompass.llamaChat.messages";
const MODEL_NAME = "meta-llama/Llama-3-70b-chat-hf";

const elements = {
  chatStatus: $("#chatStatus"),
  chatMessages: $("#chatMessages"),
  chatForm: $("#chatForm"),
  chatInput: $("#chatInput"),
  sendChatBtn: $("#sendChatBtn"),
  clearChatBtn: $("#clearChatBtn"),
  temperatureInput: $("#temperatureInput"),
  maxTokensInput: $("#maxTokensInput")
};

function loadMessages() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

let messages = loadMessages();

function saveMessages() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
}

function setStatus(text, kind = "neutral") {
  elements.chatStatus.textContent = text;
  elements.chatStatus.dataset.kind = kind;
}

function renderMessages() {
  if (!messages.length) {
    elements.chatMessages.innerHTML = `
      <div class="empty-chat">
        <div class="empty-chat-title">开始和本地 Llama 对话</div>
        <div class="muted">消息会通过 SafeCompass 后端代理到 127.0.0.1:8002/v1。</div>
      </div>
    `;
    return;
  }

  elements.chatMessages.innerHTML = messages
    .map(
      (message) => `
        <article class="chat-message ${message.role}">
          <div class="chat-message-role">${message.role === "user" ? "你" : "Llama"}</div>
          <div class="chat-message-content">${escapeHtml(message.content)}</div>
        </article>
      `
    )
    .join("");
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function getChatOptions() {
  return {
    temperature: Number(elements.temperatureInput.value || 0.7),
    maxTokens: Number(elements.maxTokensInput.value || 512)
  };
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    setStatus(MODEL_NAME, "ready");
  } catch {
    setStatus("平台服务不可用", "error");
  }
}

async function sendMessage(content) {
  const userMessage = { role: "user", content };
  messages = [...messages, userMessage];
  saveMessages();
  renderMessages();
  setStatus("生成中", "working");
  elements.sendChatBtn.disabled = true;

  try {
    const response = await fetch("/api/llama-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messages,
        ...getChatOptions()
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || "Llama 对话失败");
    }

    messages = [...messages, payload.message];
    saveMessages();
    renderMessages();
    setStatus(MODEL_NAME, "ready");
  } catch (error) {
    messages = [
      ...messages,
      {
        role: "assistant",
        content: `调用失败：${error.message}`
      }
    ];
    saveMessages();
    renderMessages();
    setStatus("调用失败", "error");
  } finally {
    elements.sendChatBtn.disabled = false;
    elements.chatInput.focus();
  }
}

elements.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const content = elements.chatInput.value.trim();
  if (!content || elements.sendChatBtn.disabled) {
    return;
  }
  elements.chatInput.value = "";
  sendMessage(content);
});

elements.chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
    elements.chatForm.requestSubmit();
  }
});

elements.clearChatBtn.addEventListener("click", () => {
  messages = [];
  saveMessages();
  renderMessages();
  setStatus(MODEL_NAME, "ready");
});

renderMessages();
checkHealth();
