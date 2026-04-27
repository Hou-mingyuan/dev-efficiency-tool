<template>
  <div class="page-logs">
    <div class="logs-header">
      <div class="logs-header__text">
        <h2 class="logs-header__title">{{ t("logs.title") }}</h2>
        <span class="logs-header__hint">{{ t("logs.autoRefresh") }}</span>
      </div>
      <div class="logs-header__actions">
        <a-button @click="refreshNow">{{ t("common.refresh") }}</a-button>
        <a-button danger @click="onClear">{{ t("logs.clear") }}</a-button>
        <a-button @click="onExport">{{ t("logs.export") }}</a-button>
      </div>
    </div>
    <div class="logs-filters">
      <a-radio-group v-model:value="levelFilter" button-style="solid" size="small">
        <a-radio-button value="all">{{ t("logs.all") }}</a-radio-button>
        <a-radio-button value="info">{{ t("logs.info") }}</a-radio-button>
        <a-radio-button value="warn">{{ t("logs.warn") }}</a-radio-button>
        <a-radio-button value="error">{{ t("logs.error") }}</a-radio-button>
      </a-radio-group>
      <a-select
        v-model:value="sourceFilter"
        :placeholder="t('logs.source')"
        allow-clear
        style="min-width: 120px"
      >
        <a-select-option v-for="s in sources" :key="s" :value="s">{{ s }}</a-select-option>
      </a-select>
      <a-input
        v-model:value="searchText"
        :placeholder="t('logs.search')"
        allow-clear
        class="search-input"
      />
      <span v-if="rawLogs.length" class="logs-filters__stats">
        {{ t("logs.statsSummary", logStats) }}
      </span>
    </div>
    <a-spin :spinning="loading" :tip="t('common.loading')">
      <a-empty v-if="!loading && displayEntries.length === 0" :description="t('logs.noLogs')" />
      <div
        v-else
        class="log-scroller"
        :aria-label="t('logs.title')"
      >
        <div class="log-header" role="row">
          <span>{{ t("logs.timestamp") }}</span>
          <span>{{ t("logs.level") }}</span>
          <span>{{ t("logs.source") }}</span>
          <span>{{ t("logs.message") }}</span>
        </div>
        <div
          v-for="(entry, index) in displayEntries"
          :key="`${entry.timestamp}-${index}`"
          class="log-line"
        >
          <span class="log-time">{{ entry.timestamp }}</span>
          <a-tag :color="levelColor(entry.level)" class="log-level">
            {{ levelLabel(entry.level) }}
          </a-tag>
          <span class="log-source" :title="entry.source">{{ entry.source }}</span>
          <span class="log-msg">{{ entry.message }}</span>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { Modal, message } from "ant-design-vue";

const { t } = useI18n();

type AppLogLevel = "info" | "warn" | "error";

interface AppLogEntry {
  timestamp: string;
  level: AppLogLevel;
  message: string;
  source: string;
}

function isIpcError(v: unknown): v is { __ipcError: true; message: string } {
  return typeof v === "object" && v !== null && (v as { __ipcError?: boolean }).__ipcError === true;
}

const maxDisplay = 500;
const levelFilter = ref<"all" | AppLogLevel>("all");
const sourceFilter = ref<string | undefined>(undefined);
const searchText = ref("");
const rawLogs = ref<AppLogEntry[]>([]);
const loading = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const sources = computed(() => {
  const set = new Set(rawLogs.value.map((l) => l.source));
  return Array.from(set).sort();
});

const baseFiltered = computed(() => {
  const q = searchText.value.trim().toLowerCase();
  let list = rawLogs.value;
  if (levelFilter.value !== "all") {
    list = list.filter((e) => e.level === levelFilter.value);
  }
  if (sourceFilter.value) {
    list = list.filter((e) => e.source === sourceFilter.value);
  }
  if (q) {
    list = list.filter(
      (e) =>
        e.message.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q) ||
        e.timestamp.toLowerCase().includes(q),
    );
  }
  return list;
});

const logStats = computed(() => {
  const list = baseFiltered.value;
  let info = 0;
  let warn = 0;
  let error = 0;
  for (const e of list) {
    if (e.level === "info") info++;
    else if (e.level === "warn") warn++;
    else if (e.level === "error") error++;
  }
  return { total: list.length, info, warn, error };
});

const displayEntries = computed(() => baseFiltered.value.slice(-maxDisplay));

function levelColor(level: AppLogLevel): string {
  if (level === "error") return "red";
  if (level === "warn") return "gold";
  return "blue";
}

function levelLabel(level: AppLogLevel): string {
  if (level === "error") return t("logs.error");
  if (level === "warn") return t("logs.warn");
  return t("logs.info");
}

async function fetchLogs(silent = false) {
  const api = window.electronAPI?.app;
  if (!api) return;
  if (!silent) {
    loading.value = true;
  }
  try {
    const res = await api.getLogs();
    if (isIpcError(res)) {
      rawLogs.value = [];
      return;
    }
    rawLogs.value = Array.isArray(res) ? (res as AppLogEntry[]) : [];
  } finally {
    if (!silent) {
      loading.value = false;
    }
  }
}

function refreshNow() {
  void fetchLogs(false);
}

function onClear() {
  Modal.confirm({
    title: t("logs.clear"),
    content: t("logs.clearConfirm"),
    okType: "danger",
    onOk: async () => {
      const api = window.electronAPI?.app;
      if (!api) return;
      await api.clearLogs();
      message.success(t("logs.clearSuccess"));
      await fetchLogs(false);
    },
  });
}

async function onExport() {
  const app = window.electronAPI?.app;
  if (!app) return;
  const res = await app.exportLogs();
  if (isIpcError(res)) {
    message.error(res.message || t("common.error"));
    return;
  }
  if (res) {
    message.success(t("logs.exportSuccess"));
  }
}

function startLogPoll(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    void fetchLogs(true);
  }, 5000);
}

function stopLogPoll(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function onVisibility(): void {
  if (document.visibilityState === "visible") {
    void fetchLogs(true);
    startLogPoll();
  } else {
    stopLogPoll();
  }
}

onMounted(() => {
  void fetchLogs(false);
  startLogPoll();
  document.addEventListener("visibilitychange", onVisibility);
});

onUnmounted(() => {
  stopLogPoll();
  document.removeEventListener("visibilitychange", onVisibility);
});
</script>

<style lang="less" scoped>
.page-logs {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 4px 24px;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.logs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;

  &__text {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }
  &__title {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    background: var(--app-primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  &__hint {
    font-size: 12px;
    color: var(--app-text-quaternary);
  }
  &__actions {
    display: flex;
    gap: 8px;
  }
}

.logs-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-radius: var(--app-radius-lg);
  background: var(--app-glass-bg);
  backdrop-filter: blur(var(--app-glass-blur));
  border: 1px solid var(--app-glass-border);

  &__stats {
    font-size: 12px;
    color: var(--app-text-tertiary);
    margin-left: auto;
  }
}

.search-input {
  max-width: 240px;
  min-width: 140px;
}

.log-scroller {
  border: 1px solid var(--app-glass-border);
  border-radius: var(--app-radius-lg);
  max-height: min(65vh, 700px);
  overflow: auto;
  contain: content;
  font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  background: var(--app-glass-bg);
  backdrop-filter: blur(var(--app-glass-blur));
}

.log-header {
  display: grid;
  grid-template-columns: 180px 72px minmax(80px, 160px) 1fr;
  gap: 8px;
  padding: 12px 16px;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--app-text-tertiary);
  border-bottom: 1px solid var(--app-glass-border);
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--app-bg-spotlight);
  backdrop-filter: blur(var(--app-glass-blur));
}

.log-line {
  display: grid;
  grid-template-columns: 180px 72px minmax(80px, 160px) 1fr;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid color-mix(in srgb, var(--app-glass-border) 50%, transparent);
  align-items: start;
  transition: background var(--app-transition);
  content-visibility: auto;
  contain-intrinsic-size: auto 36px;

  &:hover {
    background: var(--app-bg-hover);
  }
  &:nth-child(odd) {
    background: color-mix(in srgb, var(--app-bg-spotlight) 50%, transparent);
    &:hover {
      background: var(--app-bg-hover);
    }
  }
}

.log-time {
  color: var(--app-text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-level {
  margin-inline-end: 0 !important;
  justify-self: start;
}

.log-source {
  color: var(--app-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-msg {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.6;
  color: var(--app-text);
}
</style>
