<script setup lang="ts">
import { useMcpStore, DEFAULT_AI_PROVIDERS } from "@/store/mcp";
import { useNotificationStore } from "@/store/notification";
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

function isIpcError(v: unknown): v is IpcErrorResult {
  return (
    typeof v === "object" &&
    v !== null &&
    "__ipcError" in v &&
    (v as IpcErrorResult).__ipcError === true
  );
}

function ensurePromptKeys(c: McpConfig): void {
  if (!c.customPrompts) c.customPrompts = {};
  (["prd", "requirements", "ui", "design"] as const).forEach((k) => {
    if (c.customPrompts![k] === undefined) c.customPrompts![k] = "";
  });
}

const { t } = useI18n();
const mcpStore = useMcpStore();
const notificationStore = useNotificationStore();

const tabKey = ref<"basic" | "ai" | "prompt" | "backup">("basic");
const draft = ref<McpConfig>({
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
  const raw = mcpStore.config;
  const next = JSON.parse(JSON.stringify(raw)) as McpConfig;
  ensurePromptKeys(next);
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

function onCollapseChange(keys: string | string[]) {
  aiOpenKey.value = keys;
  const openIds = Array.isArray(keys) ? keys : [keys];
  for (const id of openIds) {
    const p = draft.value.aiProviders.find((x) => x.id === id);
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
      await mcpStore.setConfig({ ...draft.value });
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
  await mcpStore.fetchConfig();
  applyDraftFromStore();
  await nextTick();
  ignoreWatch.value = false;
  pushNotify("success", t("common.success"), t("settings.importSuccess"));
}

onMounted(async () => {
  await mcpStore.fetchConfig();
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
          <a-space
            direction="vertical"
            :size="12"
            style="width: 100%"
            align="start"
          >
            <a-form
              layout="vertical"
              class="settings-form"
            >
              <a-form-item :label="t('settings.projectPath')">
                <a-input-group compact>
                  <a-input
                    v-model:value="draft.projectPath"
                    style="width: calc(100% - 88px)"
                    :placeholder="t('settings.projectPath')"
                  />
                  <a-button @click="selectDir('projectPath')">
                    {{ t("common.selectDir") }}
                  </a-button>
                </a-input-group>
              </a-form-item>
              <a-form-item :label="t('settings.outputPath')">
                <a-input-group compact>
                  <a-input
                    v-model:value="draft.outputPath"
                    style="width: calc(100% - 88px)"
                    :placeholder="t('settings.outputPath')"
                  />
                  <a-button @click="selectDir('outputPath')">
                    {{ t("common.selectDir") }}
                  </a-button>
                </a-input-group>
              </a-form-item>
              <a-form-item :label="t('settings.cachePath')">
                <a-input-group compact>
                  <a-input
                    v-model:value="draft.cachePath"
                    style="width: calc(100% - 88px)"
                    :placeholder="t('settings.cachePathPlaceholder')"
                  />
                  <a-button @click="selectDir('cachePath')">
                    {{ t("common.selectDir") }}
                  </a-button>
                </a-input-group>
              </a-form-item>
              <a-form-item>
                <a-popconfirm
                  :title="t('settings.clearAllCachesConfirm')"
                  :ok-text="t('common.confirm')"
                  :cancel-text="t('common.cancel')"
                  @confirm="onClearAllCaches"
                >
                  <a-button
                    danger
                    :loading="clearingCaches"
                  >
                    {{ t("settings.clearAllCaches") }}
                  </a-button>
                </a-popconfirm>
              </a-form-item>
            </a-form>
          </a-space>
        </a-tab-pane>
        <a-tab-pane
          key="ai"
          :tab="t('settings.tabAi')"
        >
          <a-space
            direction="vertical"
            :size="12"
            style="width: 100%"
          >
            <a-button
              type="dashed"
              block
              @click="addCustomProvider"
            >
              {{ t("settings.addCustom") }}
            </a-button>
            <a-collapse
              v-model:activeKey="aiOpenKey"
              @change="onCollapseChange"
            >
              <a-collapse-panel
                v-for="(p, idx) in draft.aiProviders"
                :key="p.id"
                :header="p.name"
              >
                <a-space
                  direction="vertical"
                  :size="8"
                  style="width: 100%"
                >
                  <a-space>
                    <span>{{ t("settings.providerName") }}:</span>
                    <a-input
                      v-model:value="p.name"
                      style="min-width: 200px"
                    />
                    <span>{{ t("settings.providerEnabled") }}</span>
                    <a-switch v-model:checked="p.enabled" />
                  </a-space>
                  <a-form-item
                    :label="t('settings.apiKey')"
                    class="form-item-embed"
                  >
                    <a-input-password
                      v-model:value="p.apiKey"
                      autocomplete="off"
                    />
                  </a-form-item>
                  <a-form-item
                    :label="t('settings.baseUrl')"
                    class="form-item-embed"
                  >
                    <a-input v-model:value="p.baseUrl" />
                  </a-form-item>
                  <a-form-item
                    :label="t('settings.model')"
                    class="form-item-embed"
                  >
                    <a-auto-complete
                      v-model:value="p.model"
                      :options="(modelOptionsMap[p.id] || []).map((m: string) => ({ value: m, label: m }))"
                      :placeholder="t('settings.model')"
                      allow-clear
                      :filter-option="filterModelOption"
                      style="width: 100%"
                    />
                    <a-button
                      v-if="p.apiKey?.trim()"
                      size="small"
                      type="link"
                      :loading="modelLoadingId === p.id"
                      style="padding: 0; margin-top: 4px"
                      @click="modelOptionsMap[p.id] = []; fetchModels(p)"
                    >
                      {{ modelLoadingId === p.id ? t('settings.testing') : t("settings.refreshModels") }}
                    </a-button>
                  </a-form-item>
                  <a-space wrap>
                    <a-button
                      type="primary"
                      :loading="testingId === p.id"
                      @click="testProvider(p)"
                    >
                      {{ t("settings.testConnection") }}
                    </a-button>
                    <a-button
                      :disabled="idx === 0"
                      @click="moveProvider(idx, -1)"
                    >
                      {{ t("settings.moveUp") }}
                    </a-button>
                    <a-button
                      :disabled="idx === draft.aiProviders.length - 1"
                      @click="moveProvider(idx, 1)"
                    >
                      {{ t("settings.moveDown") }}
                    </a-button>
                    <a-popconfirm
                      v-if="!BUILTIN_IDS.has(p.id)"
                      :title="t('settings.deleteProviderConfirm')"
                      :ok-text="t('common.confirm')"
                      :cancel-text="t('common.cancel')"
                      @confirm="removeProvider(idx)"
                    >
                      <a-button danger>
                        {{ t("common.delete") }}
                      </a-button>
                    </a-popconfirm>
                  </a-space>
                </a-space>
              </a-collapse-panel>
            </a-collapse>
          </a-space>
        </a-tab-pane>
        <a-tab-pane
          key="prompt"
          :tab="t('settings.tabPrompt')"
        >
          <a-space
            direction="vertical"
            :size="16"
            style="width: 100%"
          >
            <a-form
              layout="vertical"
            >
              <a-form-item :label="t('settings.promptPrd')">
                <a-textarea
                  v-model:value="draft.customPrompts.prd"
                  :rows="6"
                  :placeholder="t('settings.promptPrdPh')"
                />
              </a-form-item>
              <a-form-item :label="t('settings.promptReq')">
                <a-textarea
                  v-model:value="draft.customPrompts.requirements"
                  :rows="6"
                  :placeholder="t('settings.promptReqPh')"
                />
              </a-form-item>
              <a-form-item :label="t('settings.promptUi')">
                <a-textarea
                  v-model:value="draft.customPrompts.ui"
                  :rows="6"
                  :placeholder="t('settings.promptUiPh')"
                />
              </a-form-item>
              <a-form-item :label="t('settings.promptDesign')">
                <a-textarea
                  v-model:value="draft.customPrompts.design"
                  :rows="6"
                  :placeholder="t('settings.promptDesignPh')"
                />
              </a-form-item>
            </a-form>
          </a-space>
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
  max-width: 900px;
  margin: 0 auto;
  padding: 0 4px 24px;
  position: relative;
  z-index: 1;
}

.settings-header {
  padding: 4px 0 16px;
  &__title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    background: var(--app-primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
}

.settings-body {
  border-radius: var(--app-radius-lg);
  background: var(--app-glass-bg);
  backdrop-filter: blur(var(--app-glass-blur));
  border: 1px solid var(--app-glass-border);
  padding: 20px 24px;
}

.settings-tabs {
  :deep(.ant-tabs-nav) {
    margin-bottom: 20px;
  }
}

.settings-form {
  max-width: 640px;
}

.form-item-embed {
  margin-bottom: 0;
  width: 100%;
}

.settings-backup-hint {
  margin: 0 0 12px;
  color: var(--app-text, rgba(15, 23, 42, 0.88));
  max-width: 52em;
  line-height: 1.7;
}

.settings-backup-title {
  margin: 0;
  font-size: 12px;
  color: var(--app-text-tertiary, rgba(100, 116, 139, 0.65));
  font-weight: 500;
}
</style>
