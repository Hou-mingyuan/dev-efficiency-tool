<script setup lang="ts">
import { useAppStore, DEFAULT_AI_PROVIDERS } from "@/store/app";
import { useNotificationStore } from "@/store/notification";
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import SettingsAiProvidersTab from "@/components/settings/SettingsAiProvidersTab.vue";
import SettingsBasicTab from "@/components/settings/SettingsBasicTab.vue";
import SettingsPromptTab from "@/components/settings/SettingsPromptTab.vue";

function isIpcError(v: unknown): v is IpcErrorResult {
  return (
    typeof v === "object" &&
    v !== null &&
    "__ipcError" in v &&
    (v as IpcErrorResult).__ipcError === true
  );
}

function ensurePromptKeys(c: AppConfig): void {
  if (!c.customPrompts) c.customPrompts = {};
  (["prd", "requirements", "ui", "design"] as const).forEach((k) => {
    if (c.customPrompts![k] === undefined) c.customPrompts![k] = "";
  });
}

function ensureFigmaConnector(c: AppConfig): void {
  c.figmaConnector = {
    ...{
      enabled: false,
      defaultFileName: "{projectName}-UI设计-{timestamp}",
      mode: "plugin-json" as const,
    },
    ...c.figmaConnector,
  };
}

const { t } = useI18n();
const appStore = useAppStore();
const notificationStore = useNotificationStore();

const tabKey = ref<"basic" | "ai" | "prompt" | "backup">("basic");
const draft = ref<AppConfig>({
  methodologyPath: "",
  projectPath: "",
  outputPath: "",
  cachePath: "",
  aiProviders: DEFAULT_AI_PROVIDERS.map((p) => ({ ...p })),
  activeProviderId: "",
  customPrompts: {},
  projects: [],
  activeProjectId: "",
  figmaConnector: {
    enabled: false,
    defaultFileName: "{projectName}-UI设计-{timestamp}",
    mode: "plugin-json",
  },
});

const clearingCaches = ref(false);

async function onClearAllCaches() {
  clearingCaches.value = true;
  try {
    const e = window.electronAPI;
    if (!e) return;
    const count = await e.project.clearAllCaches();
    const n = typeof count === "number" ? count : 0;
    pushNotify("success", t("common.success"), t("settings.cachesCleared", { count: n }));
  } catch {
    pushNotify("error", t("common.error"), t("gen.cache.clearFailed"));
  } finally {
    clearingCaches.value = false;
  }
}

const ignoreWatch = ref(true);
const aiOpenKey = ref<string | string[]>([]);
const testingId = ref<string | null>(null);
const modelOptionsMap = ref<Record<string, string[]>>({});
const modelLoadingId = ref<string | null>(null);
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function pushNotify(
  type: "success" | "error" | "warning" | "info",
  title: string,
  message: string,
) {
  notificationStore.addNotification({ type, title, message });
}

function applyDraftFromStore() {
  const raw = appStore.config;
  const next = JSON.parse(JSON.stringify(raw)) as AppConfig;
  ensurePromptKeys(next);
  ensureFigmaConnector(next);
  draft.value = next;
}

async function selectDir(
  which: "methodologyPath" | "projectPath" | "outputPath" | "cachePath",
) {
  const e = window.electronAPI;
  if (!e) {
    return;
  }
  const r = await e.app.selectDirectory(t("common.selectDir"));
  if (r && typeof r === "object" && "__ipcError" in r) {
    return;
  }
  if (typeof r === "string" && r) {
    draft.value[which] = r;
  }
}

function moveProvider(index: number, dir: -1 | 1) {
  const arr = draft.value.aiProviders;
  const j = index + dir;
  if (j < 0 || j >= arr.length) {
    return;
  }
  const copy = [...arr];
  [copy[index], copy[j]] = [copy[j], copy[index]];
  draft.value.aiProviders = copy;
}

const BUILTIN_IDS = new Set(DEFAULT_AI_PROVIDERS.map((p) => p.id));
const builtinProviderIds = DEFAULT_AI_PROVIDERS.map((p) => p.id);

function addCustomProvider() {
  const n = draft.value.aiProviders.length;
  draft.value.aiProviders = [
    ...draft.value.aiProviders,
    {
      id: `custom_ext_${Date.now()}`,
      name: `${t("settings.customProvider")} ${n + 1}`,
      apiKey: "",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4o",
      enabled: false,
    },
  ];
}

function removeProvider(index: number) {
  const p = draft.value.aiProviders[index];
  if (!p || BUILTIN_IDS.has(p.id)) return;
  draft.value.aiProviders = draft.value.aiProviders.filter((_, i) => i !== index);
}

async function fetchModels(p: AiProvider) {
  if (!p.apiKey?.trim()) return;

  const existing = modelOptionsMap.value[p.id];
  if (existing && existing.length > 0) return;

  const e = window.electronAPI;
  if (!e) return;

  modelLoadingId.value = p.id;
  try {
    const plain = { id: p.id, name: p.name, apiKey: p.apiKey, baseUrl: p.baseUrl, model: p.model, enabled: p.enabled };
    const res = await e.ai.listModels(plain);
    if (isIpcError(res)) {
      console.warn("[Settings] listModels IPC error:", (res as IpcErrorResult).message);
      return;
    }
    if (Array.isArray(res) && res.length > 0) {
      modelOptionsMap.value = { ...modelOptionsMap.value, [p.id]: res as string[] };
    }
  } catch (err) {
    console.warn("[Settings] listModels failed:", err);
  } finally {
    modelLoadingId.value = null;
  }
}

function filterModelOption(input: string, option: { value: string }) {
  return option.value.toLowerCase().includes(input.toLowerCase());
}

function onCollapseChange(keys: string | number | Array<string | number>) {
  aiOpenKey.value = Array.isArray(keys) ? keys.map(String) : String(keys);
  const openIds = Array.isArray(keys) ? keys : [keys];
  for (const id of openIds) {
    const p = draft.value.aiProviders.find((x) => x.id === String(id));
    if (p?.apiKey?.trim()) {
      void fetchModels(p);
    }
  }
}

async function testProvider(p: AiProvider) {
  const e = window.electronAPI;
  if (!e) {
    return;
  }
  testingId.value = p.id;
  try {
    const plain = { id: p.id, name: p.name, apiKey: p.apiKey, baseUrl: p.baseUrl, model: p.model, enabled: p.enabled };
    const res = await e.ai.testConnection(plain);
    if (isIpcError(res)) {
      pushNotify("error", t("settings.testFail"), res.message);
      return;
    }
    pushNotify("success", t("common.success"), t("settings.testSuccess"));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    pushNotify("error", t("settings.testFail"), msg);
  } finally {
    testingId.value = null;
  }
}

function scheduleSave() {
  if (ignoreWatch.value) {
    return;
  }
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    void (async () => {
      saveTimer = null;
      await appStore.setConfig({ ...draft.value });
      pushNotify("success", t("common.success"), t("settings.saveSuccess"));
    })();
  }, 600);
}

watch(
  () => draft.value,
  () => {
    scheduleSave();
  },
  { deep: true },
);

async function onExportConfig() {
  const e = window.electronAPI;
  if (!e) {
    return;
  }
  const r = await e.app.exportConfig();
  if (r === false) {
    pushNotify("warning", t("common.warning"), t("settings.exportFailed"));
    return;
  }
  pushNotify("success", t("common.success"), t("settings.exportConfig"));
}

async function onImportConfig() {
  const e = window.electronAPI;
  if (!e) {
    return;
  }
  ignoreWatch.value = true;
  const r = await e.app.importConfig();
  if (r == null || (typeof r === "object" && r !== null && isIpcError(r))) {
    ignoreWatch.value = false;
    pushNotify("error", t("common.error"), t("settings.importFailed"));
    return;
  }
  await appStore.fetchConfig();
  applyDraftFromStore();
  await nextTick();
  ignoreWatch.value = false;
  pushNotify("success", t("common.success"), t("settings.importSuccess"));
}

onMounted(async () => {
  await appStore.fetchConfig();
  applyDraftFromStore();
  await nextTick();
  ignoreWatch.value = false;
});

onUnmounted(() => {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
});
</script>

<template>
  <div class="page-settings">
    <div class="settings-header">
      <h2 class="settings-header__title">{{ t('settings.title') }}</h2>
    </div>
    <div class="settings-body">
      <a-tabs v-model:activeKey="tabKey" class="settings-tabs">
        <a-tab-pane
          key="basic"
          :tab="t('settings.tabBasic')"
        >
          <SettingsBasicTab
            v-model:draft="draft"
            :clearing-caches="clearingCaches"
            @select-dir="selectDir"
            @clear-all-caches="onClearAllCaches"
          />
        </a-tab-pane>
        <a-tab-pane
          key="ai"
          :tab="t('settings.tabAi')"
        >
          <SettingsAiProvidersTab
            v-model:providers="draft.aiProviders"
            v-model:active-key="aiOpenKey"
            :built-in-ids="builtinProviderIds"
            :testing-id="testingId"
            :model-options-map="modelOptionsMap"
            :model-loading-id="modelLoadingId"
            :filter-model-option="filterModelOption"
            @add-custom="addCustomProvider"
            @collapse-change="onCollapseChange"
            @clear-models="(providerId) => { modelOptionsMap[providerId] = []; }"
            @fetch-models="fetchModels"
            @test-provider="testProvider"
            @move-provider="moveProvider"
            @remove-provider="removeProvider"
          />
        </a-tab-pane>
        <a-tab-pane
          key="prompt"
          :tab="t('settings.tabPrompt')"
        >
          <SettingsPromptTab v-model:prompts="draft.customPrompts" />
        </a-tab-pane>
        <a-tab-pane
          key="backup"
          :tab="t('settings.tabBackup')"
        >
          <a-space
            direction="vertical"
            :size="12"
            style="width: 100%"
          >
            <p class="settings-backup-hint">
              {{ t("settings.backupHint") }}
            </p>
            <a-space>
              <a-button
                type="primary"
                @click="onExportConfig"
              >
                {{ t("settings.exportConfig") }}
              </a-button>
              <a-button @click="onImportConfig">
                {{ t("settings.importConfig") }}
              </a-button>
            </a-space>
            <p class="settings-backup-title">
              {{ t("settings.backupTitle") }}
            </p>
          </a-space>
        </a-tab-pane>
      </a-tabs>
    </div>
  </div>
</template>

<style lang="less" scoped>
.page-settings {
  max-width: 1040px;
  margin: 0 auto;
  padding: 0 4px 24px;
  position: relative;
  z-index: 1;
}

.settings-header {
  padding: 4px 0 22px;
  &__title {
    margin: 0;
    font-family: var(--app-font-display);
    font-size: clamp(34px, 4vw, 52px);
    line-height: 1;
    font-weight: 950;
    letter-spacing: -0.065em;
    color: rgba(248, 250, 252, 0.94);
    text-shadow: 0 0 30px color-mix(in srgb, var(--app-primary) 16%, transparent);
  }
}

.settings-body {
  border-radius: 0;
  background:
    linear-gradient(135deg, rgba(96, 165, 250, 0.055), transparent 38%),
    linear-gradient(90deg, rgba(216, 255, 122, 0.04), transparent 55%),
    rgba(4, 8, 14, 0.12);
  backdrop-filter: none;
  border: 0;
  padding: 18px 20px 20px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(rgba(148, 163, 184, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148, 163, 184, 0.028) 1px, transparent 1px);
    background-size: 38px 38px;
    opacity: 0.5;
    mask-image: linear-gradient(90deg, rgba(0, 0, 0, 0.85), transparent 74%);
  }
}

.settings-tabs {
  position: relative;
  z-index: 1;

  :deep(.ant-tabs-nav) {
    margin-bottom: 24px;

    &::before {
      border: none !important;
    }
  }
  :deep(.ant-tabs-nav-list) {
    background: transparent;
    border-radius: 0;
    padding: 0;
    gap: 8px;
  }
  :deep(.ant-tabs-tab) {
    border-radius: 0 !important;
    padding: 8px 4px !important;
    margin: 0 !important;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    border: none !important;
    background: transparent;
    &::before,
    &::after {
      display: none !important;
    }
  }
  :deep(.ant-tabs-tab-active) {
    background: transparent !important;
    box-shadow: none;
  }
  :deep(.ant-tabs-tab-btn) {
    font-family: var(--app-font-mono);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: rgba(203, 213, 225, 0.78);
  }
  :deep(.ant-tabs-tab-active .ant-tabs-tab-btn) {
    color: var(--app-primary) !important;
    text-shadow: 0 0 18px color-mix(in srgb, var(--app-primary) 26%, transparent);
  }
  :deep(.ant-tabs-ink-bar) {
    display: block !important;
    height: 1px !important;
    background: var(--app-primary-gradient) !important;
    box-shadow: 0 0 12px color-mix(in srgb, var(--app-primary) 36%, transparent);
  }
  :deep(.ant-card),
  :deep(.ant-collapse),
  :deep(.ant-list),
  :deep(.ant-descriptions-view) {
    background:
      linear-gradient(135deg, rgba(96, 165, 250, 0.04), transparent 42%),
      rgba(4, 8, 14, 0.2) !important;
    border-color: transparent !important;
    box-shadow: none !important;
  }

  :deep(.ant-collapse-header),
  :deep(.ant-card-head-title),
  :deep(.ant-list-item-meta-title),
  :deep(.ant-descriptions-item-label) {
    color: rgba(248, 250, 252, 0.92) !important;
  }

  :deep(.ant-card-body),
  :deep(.ant-list-item-meta-description),
  :deep(.ant-descriptions-item-content),
  :deep(.ant-collapse-content-box) {
    color: rgba(203, 213, 225, 0.76) !important;
  }
}

.settings-backup-hint {
  margin: 0 0 12px;
  color: rgba(203, 213, 225, 0.78);
  max-width: 52em;
  line-height: 1.7;
  font-weight: 600;
}

.settings-backup-title {
  margin: 0;
  font-size: 12px;
  color: rgba(148, 163, 184, 0.82);
  font-family: var(--app-font-mono);
  font-weight: 800;
  letter-spacing: 0.06em;
}
</style>
