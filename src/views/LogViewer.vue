<template>
  <div class="page-container log-viewer">
    <a-typography-title :level="4" class="page-title">
      {{ t("logs.title") }}
    </a-typography-title>
    <div class="toolbar">
      <a-button @click="refreshNow">{{ t("common.refresh") }}</a-button>
      <a-button danger @click="onClear">
        {{ t("logs.clear") }}
      </a-button>
      <a-button @click="onExport">{{ t("logs.export") }}</a-button>
      <span class="auto-hint">{{ t("logs.autoRefresh") }}</span>
    </div>
    <div class="filters">
      <span class="filter-label">{{ t("logs.filter") }}</span>
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
    </div>
    <a-typography-text v-if="rawLogs.length" class="log-stats" type="secondary">
      {{ t("logs.statsSummary", logStats) }}
    </a-typography-text>
    <a-typography-text type="secondary" class="display-limit">
      {{ t("logs.displayLimit", { n: maxDisplay }) }}
    </a-typography-text>
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

type McpLogLevel = "info" | "warn" | "error";

interface McpLogEntry {
  timestamp: string;
  level: McpLogLevel;
  message: string;
  source: string;
}

function isIpcError(v: unknown): v is { __ipcError: true; message: string } {
  return typeof v === "object" && v !== null && (v as { __ipcError?: boolean }).__ipcError === true;
}

const maxDisplay = 1000;
const levelFilter = ref<"all" | McpLogLevel>("all");
const sourceFilter = ref<string | undefined>(undefined);
const searchText = ref("");
const rawLogs = ref<McpLogEntry[]>([]);
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

function levelColor(level: McpLogLevel): string {
  if (level === "error") return "red";
  if (level === "warn") return "gold";
  return "blue";
}

function levelLabel(level: McpLogLevel): string {
  if (level === "error") return t("logs.error");
  if (level === "warn") return t("logs.warn");
  return t("logs.info");
}

async function fetchLogs(silent = false) {
  const api = window.electronAPI?.mcp;
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
    rawLogs.value = Array.isArray(res) ? (res as McpLogEntry[]) : [];
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
      const api = window.electronAPI?.mcp;
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

onMounted(() => {
  void fetchLogs(false);
  pollTimer = setInterval(() => {
    void fetchLogs(true);
  }, 3000);
});

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<style lang="less" scoped>
.page-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 16px 24px;
  box-sizing: border-box;
}

.page-title {
  margin: 0 0 16px !important;
  flex-shrink: 0;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 12px;
}

.auto-hint {
  font-size: 12px;
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.45));
  margin-left: 4px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-bottom: 8px;
}

.filter-label {
  font-size: 13px;
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.45));
}

.search-input {
  max-width: 280px;
  min-width: 160px;
}

.log-stats {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
}

.display-limit {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
}

.log-scroller {
  border: 1px solid var(--ant-color-border-secondary, #f0f0f0);
  border-radius: 6px;
  max-height: min(60vh, 640px);
  overflow: auto;
  contain: content;
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
  background: var(--ant-color-bg-layout, #fafafa);
}

.log-header {
  display: grid;
  grid-template-columns: 180px 72px minmax(80px, 160px) 1fr;
  gap: 8px;
  padding: 8px 10px;
  font-weight: 600;
  color: var(--ant-color-text, rgba(0, 0, 0, 0.88));
  border-bottom: 1px solid var(--ant-color-border, #d9d9d9);
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--ant-color-bg-elevated, #fff);
}

.log-line {
  display: grid;
  grid-template-columns: 180px 72px minmax(80px, 160px) 1fr;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0);
  align-items: start;
}

.log-line:nth-child(odd) {
  background: var(--ant-color-bg-container, #fff);
}

.log-time {
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.45));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-level {
  margin-inline-end: 0 !important;
  justify-self: start;
}

.log-source {
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.45));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-msg {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
