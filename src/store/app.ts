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
    name: "Qwen (Tongyi)",
    apiKey: "",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3.6-plus",
    enabled: false,
  },
  {
    id: "zhipu",
    name: "Zhipu (GLM)",
    apiKey: "",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-5",
    enabled: false,
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    apiKey: "",
    baseUrl: "https://api.moonshot.cn/v1",
    model: "kimi-k2.6",
    enabled: false,
  },
  {
    id: "doubao",
    name: "Doubao (ByteDance)",
    apiKey: "",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-2.0-pro",
    enabled: false,
  },
  {
    id: "custom",
    name: "Custom (OpenAI Compatible)",
    apiKey: "",
    baseUrl: "",
    model: "",
    enabled: false,
  },
];

const defaultConfig = (): AppConfig => ({
  methodologyPath: "",
  projectPath: "",
  outputPath: "",
  cachePath: "",
  aiProviders: DEFAULT_AI_PROVIDERS.map((p) => ({ ...p })),
  activeProviderId: "",
  customPrompts: {},
  projects: [],
  activeProjectId: "",
});

let configListenerStop: (() => void) | null = null;

export const useAppStore = defineStore("app", () => {
  const config = ref<AppConfig>(defaultConfig());
  const lastGenResult = ref<string | null>(null);
  const lastGenType = ref<string | null>(null);

  const api = (): ElectronAPI | undefined => (typeof window !== "undefined" ? window.electronAPI : undefined);

  function ensureConfigListener(): void {
    const e = api();
    if (!e || configListenerStop) return;
    configListenerStop = e.app.onConfigChanged((next) => {
      config.value = JSON.parse(JSON.stringify(next));
    });
  }

  async function fetchConfig(): Promise<void> {
    const e = api();
    if (!e) return;
    ensureConfigListener();
    const res = await e.app.getConfig();
    if (isIpcError(res)) return;
    config.value = JSON.parse(JSON.stringify(res));
  }

  async function setConfig(partial: Partial<AppConfig>): Promise<void> {
    const e = api();
    if (!e) return;
    const next: AppConfig = JSON.parse(JSON.stringify({ ...config.value, ...partial }));
    await e.app.setConfig(next);
    await fetchConfig();
  }

  return {
    config,
    lastGenResult,
    lastGenType,
    fetchConfig,
    setConfig,
  };
});
