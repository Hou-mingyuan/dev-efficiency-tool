import { ref } from "vue";
import { defineStore } from "pinia";

function isIpcError(value: unknown): value is IpcErrorResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "__ipcError" in value &&
    (value as IpcErrorResult).__ipcError === true
  );
}

/** Default AI provider list (mirrors `electron/mcp-manager` `DEFAULT_AI_PROVIDERS`). */
export const DEFAULT_AI_PROVIDERS: AiProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o",
    enabled: false,
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    apiKey: "",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-6",
    enabled: false,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    apiKey: "",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-v4-flash",
    enabled: false,
  },
  {
    id: "qwen",
    name: "通义千问 (Qwen)",
    apiKey: "",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.6-plus",
    enabled: false,
  },
  {
    id: "zhipu",
    name: "智谱 (GLM)",
    apiKey: "",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-5",
    enabled: false,
  },
  {
    id: "moonshot",
    name: "月之暗面 (Kimi)",
    apiKey: "",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "kimi-k2.6",
    enabled: false,
  },
  {
    id: "doubao",
    name: "豆包 (Doubao)",
    apiKey: "",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-2.0-pro",
    enabled: false,
  },
  {
    id: "custom",
    name: "自定义 (OpenAI 兼容)",
    apiKey: "",
    baseUrl: "",
    model: "",
    enabled: false,
  },
];

const defaultConfig = (): McpConfig => ({
  port: 3100,
  transport: "sse",
  methodologyPath: "",
  projectPath: "",
  outputPath: "",
  cachePath: "",
  autoStart: false,
  aiProviders: DEFAULT_AI_PROVIDERS.map((p) => ({ ...p })),
  activeProviderId: "",
  customPrompts: {},
  projects: [],
  activeProjectId: "",
});

let pollTimer: ReturnType<typeof setInterval> | null = null;
let pollIntervalMs = 5000;
let pollDepth = 0;
let configListenerStop: (() => void) | null = null;

export const useMcpStore = defineStore("mcp", () => {
  const status = ref<McpStatus | null>(null);
  const config = ref<McpConfig>(defaultConfig());
  const logs = ref<McpLogEntry[]>([]);
  const needMcpRestart = ref(false);
  const lastGenResult = ref<string | null>(null);
  const lastGenType = ref<string | null>(null);
  const lastStatusFetchError = ref(false);

  const api = (): ElectronAPI | undefined => (typeof window !== "undefined" ? window.electronAPI : undefined);

  function ensureConfigListener(): void {
    const e = api();
    if (!e || configListenerStop) return;
    configListenerStop = e.mcp.onConfigChanged((next) => {
      config.value = JSON.parse(JSON.stringify(next));
      needMcpRestart.value = true;
    });
  }

  async function fetchStatus(): Promise<void> {
    const e = api();
    if (!e) {
      return;
    }
    const res = await e.mcp.getStatus();
    if (isIpcError(res)) {
      lastStatusFetchError.value = true;
      return;
    }
    lastStatusFetchError.value = false;
    status.value = res as McpStatus;
  }

  async function fetchConfig(): Promise<void> {
    const e = api();
    if (!e) return;
    ensureConfigListener();
    const res = await e.mcp.getConfig();
    if (isIpcError(res)) return;
    config.value = JSON.parse(JSON.stringify(res));
  }

  async function fetchLogs(): Promise<void> {
    const e = api();
    if (!e) return;
    const res = await e.mcp.getLogs();
    if (isIpcError(res)) return;
    logs.value = Array.isArray(res) ? (res as McpLogEntry[]) : [];
  }

  async function startMcp(): Promise<void> {
    const e = api();
    if (!e) return;
    await e.mcp.start();
    needMcpRestart.value = false;
    await fetchStatus();
  }

  async function stopMcp(): Promise<void> {
    const e = api();
    if (!e) return;
    await e.mcp.stop();
    await fetchStatus();
  }

  async function setConfig(partial: Partial<McpConfig>): Promise<void> {
    const e = api();
    if (!e) return;
    const next: McpConfig = JSON.parse(JSON.stringify({ ...config.value, ...partial }));
    await e.mcp.setConfig(next);
    await fetchConfig();
    if (status.value?.running) needMcpRestart.value = true;
  }

  function startPolling(interval = 5000): void {
    if (pollDepth === 0) {
      void fetchStatus();
      pollIntervalMs = interval;
      pollTimer = setInterval(() => {
        void fetchStatus();
      }, pollIntervalMs);
    }
    pollDepth++;
  }

  function stopPolling(): void {
    pollDepth = Math.max(0, pollDepth - 1);
    if (pollDepth > 0) return;
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  return {
    status,
    lastStatusFetchError,
    config,
    logs,
    needMcpRestart,
    lastGenResult,
    lastGenType,
    fetchStatus,
    fetchConfig,
    fetchLogs,
    startMcp,
    stopMcp,
    setConfig,
    startPolling,
    stopPolling,
  };
});

