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
          <span class="log-msg" :class="{ 'log-msg--json': isJson(entry.message) }">{{ formatMsg(entry.message) }}</span>
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

function isJson(msg: string): boolean {
  const trimmed = msg.trim();
  return (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));
}

function formatMsg(msg: string): string {
  if (!isJson(msg)) return msg;
  try {
    return JSON.stringify(JSON.parse(msg), null, 2);
  } catch {
    return msg;
  }
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
    font-family: var(--app-font-display);
    font-size: clamp(34px, 4vw, 52px);
    line-height: 1;
    font-weight: 950;
    letter-spacing: -0.065em;
    color: rgba(248, 250, 252, 0.94);
    text-shadow: 0 0 30px color-mix(in srgb, var(--app-primary) 16%, transparent);
  }
  &__hint {
    font-family: var(--app-font-mono);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: rgba(148, 163, 184, 0.8);
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
  border-radius: 0;
  background: rgba(4, 8, 14, 0.16);
  backdrop-filter: none;
  border: 0;

  &__stats {
    font-size: 12px;
    font-family: var(--app-font-mono);
    font-weight: 700;
    letter-spacing: 0.04em;
    color: rgba(148, 163, 184, 0.82);
    margin-left: auto;
  }
}

.search-input {
  max-width: 240px;
  min-width: 140px;
}

.log-scroller {
  border: 0;
  border-radius: 0;
  max-height: min(65vh, 700px);
  overflow: auto;
  contain: content;
  font-family: var(--app-font-mono);
  font-size: 12px;
  line-height: 1.5;
  background: rgba(4, 8, 14, 0.18);
  backdrop-filter: none;
}

.log-header {
  display: grid;
  grid-template-columns: 180px 72px minmax(80px, 160px) 1fr;
  gap: 8px;
  padding: 12px 16px;
  font-weight: 800;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(148, 163, 184, 0.82);
  border-bottom: 0;
  position: sticky;
  top: 0;
  z-index: 1;
  background: rgba(4, 8, 14, 0.28);
  backdrop-filter: none;
}

.log-line {
  display: grid;
  grid-template-columns: 180px 72px minmax(80px, 160px) 1fr;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 0;
  align-items: start;
  transition: background var(--app-transition);
  content-visibility: auto;
  contain-intrinsic-size: auto 36px;

  &:hover {
    background: rgba(96, 165, 250, 0.06);
  }
  &:nth-child(odd) {
    background: rgba(255, 255, 255, 0.018);
    &:hover {
      background: rgba(96, 165, 250, 0.06);
    }
  }
}

.log-time {
  color: rgba(148, 163, 184, 0.82);
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

  &--json {
    font-family: var(--app-font-mono);
    font-size: 11px;
    background: rgba(15, 23, 42, 0.5);
    padding: 4px 8px;
    border-radius: 0;
    border: 0;
  }
}
</style>
