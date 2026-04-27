<template>
  <div class="page-container methodology-page">
    <a-typography-title :level="4" class="page-title">
      {{ t("methodology.title") }}
    </a-typography-title>
    <div class="methodology-body">
      <aside class="methodology-sider">
        <div class="sider-header">{{ t("methodology.fileList") }}</div>
        <a-spin :spinning="listLoading" :tip="t('methodology.loading')">
          <a-alert
            v-if="listError"
            type="error"
            :message="listError"
            show-icon
            class="list-error-alert"
            closable
            @close="listError = ''"
          />
          <a-empty
            v-else-if="!listLoading && files.length === 0"
            :description="t('methodology.noFiles')"
          />
          <a-list
            v-else
            size="small"
            :data-source="files"
            :bordered="false"
            class="file-list"
          >
            <template #renderItem="{ item }">
              <a-list-item
                :class="['file-item', { 'file-item--active': selectedPath === item.path }]"
                tabindex="0"
                role="button"
                @click="onSelectFile(item)"
                @keydown.enter="onSelectFile(item)"
                @keydown.space.prevent="onSelectFile(item)"
              >
                <span class="file-name" :title="item.name">{{ item.name }}</span>
                <span class="file-size">{{ formatSize(item.size) }}</span>
              </a-list-item>
            </template>
          </a-list>
        </a-spin>
      </aside>
      <main class="methodology-main">
        <a-spin :spinning="contentLoading" :tip="t('methodology.loading')">
          <a-empty
            v-if="!contentLoading && !selectedPath"
            :description="t('methodology.selectHint')"
          />
          <div v-else-if="!contentLoading && selectedPath" class="markdown-wrap">
            <a-alert
              v-if="readError"
              type="error"
              :message="t('methodology.readError')"
              :description="readError"
              show-icon
              class="read-alert"
            />
            <div
              v-else
              class="markdown-content"
              v-html="sanitizedHtml"
            />
          </div>
        </a-spin>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { marked } from "marked";
import DOMPurify from "dompurify";

const { t } = useI18n();

interface MethodologyFileInfo {
  name: string;
  path: string;
  size: number;
}

function isIpcError(v: unknown): v is { __ipcError: true; message: string } {
  return typeof v === "object" && v !== null && (v as { __ipcError?: boolean }).__ipcError === true;
}

const files = ref<MethodologyFileInfo[]>([]);
const listLoading = ref(false);
const contentLoading = ref(false);
const selectedPath = ref<string | null>(null);
const rawMarkdown = ref("");
const readError = ref("");
const listError = ref("");

const sanitizedHtml = computed(() => {
  if (readError.value || !rawMarkdown.value) return "";
  return DOMPurify.sanitize(marked.parse(rawMarkdown.value, { async: false }) as string);
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function loadFileList() {
  const api = window.electronAPI?.app;
  if (!api) return;
  listLoading.value = true;
  try {
    const res = await api.getMethodologyFiles();
    if (isIpcError(res)) {
      files.value = [];
      listError.value = res.message || t("common.error");
      return;
    }
    listError.value = "";
    files.value = Array.isArray(res) ? (res as MethodologyFileInfo[]) : [];
  } finally {
    listLoading.value = false;
  }
}

async function onSelectFile(item: MethodologyFileInfo) {
  selectedPath.value = item.path;
  readError.value = "";
  rawMarkdown.value = "";
  const api = window.electronAPI?.app;
  if (!api) {
    readError.value = t("common.error");
    return;
  }
  contentLoading.value = true;
  try {
    const res = await api.readMethodologyFile(item.path);
    if (isIpcError(res)) {
      readError.value = res.message;
      return;
    }
    if (typeof res !== "string") {
      readError.value = t("methodology.readError");
      return;
    }
    rawMarkdown.value = res;
  } finally {
    contentLoading.value = false;
  }
}

onMounted(() => {
  void loadFileList();
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

.methodology-page {
  .methodology-body {
    display: flex;
    flex: 1;
    min-height: 0;
    gap: 16px;
    border: 1px solid var(--ant-color-border-secondary, #f0f0f0);
    border-radius: 8px;
    overflow: hidden;
    background: var(--ant-color-bg-container, #fff);
  }

  .methodology-sider {
    width: 280px;
    min-width: 200px;
    border-right: 1px solid var(--ant-color-border-secondary, #f0f0f0);
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--ant-color-bg-layout, #fafafa);
  }

  .sider-header {
    padding: 12px 16px;
    font-weight: 600;
    border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0);
  }

  :deep(.ant-spin-nested-loading) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  :deep(.ant-spin-container) {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }

  .file-list {
    padding: 8px 0;
  }

  .file-item {
    cursor: pointer;
    padding: 10px 16px !important;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    border: none !important;
    border-radius: var(--app-radius-sm, 8px);
    margin: 2px 6px;
    transition: background var(--app-transition, 0.2s ease);
  }

  .file-item:hover {
    background: var(--app-bg-hover, rgba(59, 130, 246, 0.06));
  }

  .file-item--active {
    background: color-mix(in srgb, var(--app-primary) 10%, transparent);
    box-shadow: inset 3px 0 0 var(--app-primary);
  }

  .file-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  }

  .file-size {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--app-text-tertiary, rgba(0, 0, 0, 0.45));
    font-family: 'JetBrains Mono', 'Fira Code', Menlo, monospace;
  }

  .methodology-main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: auto;
    padding: 20px 24px;
  }

  .markdown-wrap {
    max-width: 960px;
  }

  .read-alert {
    margin-bottom: 0;
  }

  .markdown-content {
    line-height: 1.8;
  }

  .markdown-content :deep(h1),
  .markdown-content :deep(h2),
  .markdown-content :deep(h3) {
    margin-top: 1.4em;
    margin-bottom: 0.6em;
    font-weight: 700;
  }

  .markdown-content :deep(pre) {
    padding: 16px 20px;
    overflow: auto;
    border-radius: var(--app-radius-md, 12px);
    background: var(--app-bg-spotlight, #f8fafc);
    border: 1px solid var(--app-border-secondary);
  }

  .markdown-content :deep(code) {
    font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Consolas, monospace;
  }

  .markdown-content :deep(ul),
  .markdown-content :deep(ol) {
    padding-left: 1.5em;
  }

  .markdown-content :deep(table) {
    border-collapse: collapse;
    width: 100%;
    border-radius: var(--app-radius-sm, 8px);
    overflow: hidden;
  }

  .markdown-content :deep(th),
  .markdown-content :deep(td) {
    border: 1px solid var(--app-border-secondary, #f0f0f0);
    padding: 10px 14px;
  }

  .markdown-content :deep(th) {
    background: var(--app-bg-spotlight, #f8fafc);
    font-weight: 600;
  }
}
</style>
