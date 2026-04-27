<template>
  <div class="page-container doc-parser">
    <a-typography-title :level="4" class="page-title">
      {{ t("parser.title") }}
    </a-typography-title>
    <a-card size="small" class="parser-card">
      <div
        class="drop-zone"
        :class="{ 'drop-zone--active': dragOver }"
        @dragover.prevent="onDragOver"
        @dragleave.prevent="onDragLeave"
        @drop.prevent="onDrop"
      >
        <a-button type="primary" @click="onSelectFile">{{ t("parser.selectFile") }}</a-button>
        <p class="drop-hint">{{ t("parser.dragHint") }}</p>
      </div>
    </a-card>
    <a-card v-if="filePath" :title="t('parser.result')" class="result-card" size="small">
      <a-spin :spinning="parsing" :tip="t('parser.parsing')">
        <div v-if="!parsing" class="meta">
          <div>
            <span class="meta-label">{{ t("parser.fileName") }}:</span>
            <span>{{ displayName }}</span>
          </div>
          <div>
            <span class="meta-label">{{ t("parser.fileType") }}:</span>
            <a-tag>{{ typeLabel }}</a-tag>
          </div>
        </div>
        <a-empty
          v-if="!parsing && !parseError && !parsedContent"
          :description="t('parser.empty')"
        />
        <a-alert
          v-else-if="parseError"
          type="error"
          :message="t('parser.parseError')"
          :description="parseError"
          show-icon
        />
        <pre v-else-if="parsedContent" class="parsed-text">{{ parsedContent }}</pre>
      </a-spin>
    </a-card>
    <a-card v-else :title="t('parser.result')" class="result-card" size="small">
      <a-empty :description="t('parser.empty')" />
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";

const { t, te } = useI18n();

type DocumentParseType = "markdown" | "docx" | "xlsx" | "unknown" | "error";

interface DocumentParseResult {
  content: string;
  type: DocumentParseType;
}

function isIpcError(v: unknown): v is { __ipcError: true; message: string } {
  return typeof v === "object" && v !== null && (v as { __ipcError?: boolean }).__ipcError === true;
}

const filePath = ref("");
const dragOver = ref(false);
const parsing = ref(false);
const parsedContent = ref("");
const resultType = ref<DocumentParseType | "">("");
const parseError = ref("");

const displayName = computed(() => {
  const p = filePath.value;
  if (!p) return "";
  const parts = p.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || p;
});

const typeLabel = computed(() => {
  const typ = resultType.value;
  if (!typ) return "—";
  const key = `parser.types.${typ}`;
  return te(key) ? t(key) : typ;
});

async function parsePath(p: string) {
  if (!p) return;
  filePath.value = p;
  parseError.value = "";
  parsedContent.value = "";
  resultType.value = "";
  const api = window.electronAPI?.app;
  if (!api) {
    message.error(t("common.error"));
    return;
  }
  parsing.value = true;
  try {
    const res = await api.parseDocument(p);
    if (isIpcError(res)) {
      parseError.value = res.message;
      return;
    }
    if (res == null) {
      parseError.value = t("parser.parseError");
      return;
    }
    const doc = res as DocumentParseResult;
    resultType.value = doc.type;
    if (doc.type === "error") {
      parseError.value = doc.content || t("parser.parseError");
      return;
    }
    parsedContent.value = doc.content;
  } finally {
    parsing.value = false;
  }
}

async function onSelectFile() {
  const api = window.electronAPI?.app;
  if (!api) return;
  const p = await api.selectFile();
  if (isIpcError(p)) {
    message.error(p.message || t("common.error"));
    return;
  }
  if (p) {
    await parsePath(p);
  }
}

function onDragOver() {
  dragOver.value = true;
}

function onDragLeave() {
  dragOver.value = false;
}

function onDrop(e: DragEvent) {
  dragOver.value = false;
  const f = e.dataTransfer?.files?.[0] as (File & { path?: string }) | undefined;
  const p = f?.path;
  if (p) {
    void parsePath(p);
  } else {
    message.warning(t("parser.noPath"));
  }
}
</script>

<style lang="less" scoped>
.page-container {
  padding: 16px 24px;
  box-sizing: border-box;
  max-width: 960px;
}

.page-title {
  margin: 0 0 16px !important;
}

.parser-card {
  margin-bottom: 16px;
}

.drop-zone {
  text-align: center;
  padding: 40px 20px;
  border: 2px dashed var(--app-border, rgba(226, 232, 240, 0.8));
  border-radius: var(--app-radius-lg, 16px);
  background: var(--app-bg-spotlight, #f8fafc);
  transition: border-color var(--app-transition, 0.2s ease), background var(--app-transition, 0.2s ease), box-shadow var(--app-transition, 0.2s ease);
}

.drop-zone--active {
  border-color: var(--app-primary, #3b82f6);
  background: color-mix(in srgb, var(--app-primary) 5%, transparent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--app-primary) 10%, transparent);
}

.drop-hint {
  margin: 14px 0 0;
  color: var(--app-text-tertiary, rgba(0, 0, 0, 0.45));
  font-size: 13px;
}

.result-card {
  min-height: 120px;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  margin-bottom: 14px;
}

.meta-label {
  color: var(--app-text-tertiary, rgba(0, 0, 0, 0.45));
  margin-right: 6px;
  font-weight: 500;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.parsed-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 50vh;
  overflow: auto;
  padding: 16px 20px;
  background: var(--app-bg-spotlight, #f8fafc);
  border: 1px solid var(--app-border-secondary, rgba(241, 245, 249, 0.9));
  border-radius: var(--app-radius-md, 12px);
  font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
}
</style>
