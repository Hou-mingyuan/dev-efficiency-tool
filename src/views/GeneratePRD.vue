<template>
  <div class="page-container generator-page">
    <div class="generator-page__header">
      <a-typography-title :level="4">{{ t("gen.prd.title") }}</a-typography-title>
      <p class="generator-page__desc">{{ t("gen.prd.description") }}</p>
    </div>

    <div class="generator-page__grid">
      <a-card class="generator-page__panel" :title="t('gen.common.input')" size="small">
        <a-form layout="vertical" :disabled="generating">
          <a-form-item :label="t('gen.common.scopeLevel')">
            <a-radio-group v-model:value="scopeLevel">
              <a-radio-button value="project">{{ t('gen.common.scopeProject') }}</a-radio-button>
              <a-radio-button value="module">{{ t('gen.common.scopeModule') }}</a-radio-button>
            </a-radio-group>
          </a-form-item>
          <a-form-item :label="t('gen.common.projectName')">
            <a-input
              v-model:value="projectName"
              :placeholder="t('gen.common.projectNamePlaceholder')"
              allow-clear
            />
          </a-form-item>
          <a-form-item :label="t('gen.common.content')">
            <a-textarea
              v-model:value="userContent"
              :placeholder="t('gen.common.contentPlaceholder')"
              :rows="10"
              show-count
            />
          </a-form-item>
          <a-form-item :label="t('gen.common.reference')">
            <div
              class="ref-drop-zone"
              :class="{ 'ref-drop-zone--active': refDragOver }"
              @dragover.prevent="refDragOver = true"
              @dragleave.prevent="refDragOver = false"
              @drop.prevent="onRefDrop"
            >
              <a-space wrap>
                <a-button @click="addReference">
                  {{ t("gen.common.addReference") }}
                </a-button>
                <a-button @click="addReferenceFolder">
                  {{ t("gen.common.addReferenceFolder") }}
                </a-button>
                <span class="ref-drop-hint">{{ t("gen.common.dropHint") }}</span>
              </a-space>
              <div v-if="referenceItems.length" class="ref-tags">
                <a-tag
                  v-for="p in referenceFiles"
                  :key="p"
                  closable
                  @close.prevent="() => removeReferenceFile(p)"
                >
                  {{ fileBaseName(p) }}
                </a-tag>
              </div>
            </div>
          </a-form-item>
          <a-form-item :label="t('gen.common.referenceProject')">
            <a-input-group compact>
              <a-input
                v-model:value="referenceProjectPath"
                :placeholder="t('gen.common.referenceProjectPlaceholder')"
                style="width: calc(100% - 160px)"
                allow-clear
                readonly
              />
              <a-button @click="selectReferenceProject">
                {{ t('common.selectDir') }}
              </a-button>
              <a-button v-if="referenceProjectPath" @click="referenceProjectPath = ''">
                {{ t('gen.common.clearRefProject') }}
              </a-button>
            </a-input-group>
          </a-form-item>
          <a-form-item :label="t('gen.cache.title')">
            <a-space>
              <a-tag
                :color="projectCacheStatus === 'valid' ? 'green' : projectCacheStatus === 'expired' ? 'orange' : projectCacheStatus === 'analyzing' ? 'blue' : 'default'"
              >
                {{ t(`gen.cache.status${projectCacheStatus.charAt(0).toUpperCase() + projectCacheStatus.slice(1)}`) }}
              </a-tag>
              <a-button
                size="small"
                :loading="analyzingProject"
                @click="analyzeProject"
              >
                {{ projectCacheStatus === 'none' ? t('gen.cache.analyze') : t('gen.cache.reanalyze') }}
              </a-button>
              <a-button
                v-if="projectCacheStatus !== 'none'"
                size="small"
                danger
                @click="clearProjectCache"
              >
                {{ t('gen.cache.clear') }}
              </a-button>
            </a-space>
            <div v-if="projectCacheInfo" class="cache-info-line">
              {{ t('gen.cache.analyzedAt') }}: {{ formatTime(projectCacheInfo.analyzedAt) }}
            </div>
          </a-form-item>
          <AiProviderInline
            v-model="customProviderId"
            :all-providers="allProviders"
            :selected-provider="selectedProvider"
            :save-provider-field="saveProviderField"
          />
          <a-form-item :label="t('gen.common.customOutputPath')">
            <a-input-group compact>
              <a-input
                v-model:value="customOutputPath"
                :placeholder="t('gen.common.customOutputPathPlaceholder')"
                style="width: calc(100% - 100px)"
                allow-clear
              />
              <a-button @click="pickOutputDir">
                {{ t('common.selectDir') }}
              </a-button>
            </a-input-group>
          </a-form-item>
          <a-form-item :label="t('gen.common.outputFormat')">
            <a-radio-group v-model:value="outputFormat">
              <a-radio-button value="md">{{ t('gen.common.formatMd') }}</a-radio-button>
              <a-radio-button value="docx">{{ t('gen.common.formatDocx') }}</a-radio-button>
              <a-radio-button value="pdf">{{ t('gen.common.formatPdf') }}</a-radio-button>
            </a-radio-group>
          </a-form-item>
        </a-form>

        <a-space wrap class="generator-actions">
          <a-button type="primary" :loading="generating" @click="generate">
            {{ t("gen.common.generate") }}
          </a-button>
          <a-button v-if="generating" danger @click="stopGenerate">
            {{ t("gen.common.stopGenerate") }}
          </a-button>
          <a-button :disabled="generating || !userContent.trim()" @click="onRegenerate">
            {{ t("gen.common.regenerate") }}
          </a-button>
          <a-button :disabled="!result" @click="saveDocument">
            {{ t("gen.common.save") }}
          </a-button>
          <a-button :disabled="!result" @click="copyResult">
            {{ t("gen.common.copy") }}
          </a-button>
          <a-button :disabled="!result" @click="setResultForNextStep">
            {{ t("gen.common.importNextStep") }}
          </a-button>
          <a-button @click="historyOpen = true">
            {{ t("gen.common.history") }}
          </a-button>
          <a-button v-if="canOpenInWindow" @click="openThisInWindow">
            {{ t("gen.common.openInWindow") }}
          </a-button>
        </a-space>
      </a-card>

      <a-card
        class="generator-page__panel generator-page__panel--preview generator-page__preview-card"
        :title="t('gen.common.preview')"
        size="small"
      >
        <template #extra>
          <span v-if="generating" class="gen-status">{{ t("gen.common.generating") }}</span>
        </template>
        <a-spin :spinning="generating" class="preview-spin">
          <div class="generator-page__preview-body">
            <a-empty v-if="!result && !generating" :description="t('gen.common.noResult')" />
            <div
              v-else
              class="markdown-body"
              v-html="renderedHtml"
            />
          </div>
        </a-spin>
      </a-card>
    </div>

    <a-drawer
      v-model:open="historyOpen"
      :title="t('gen.common.history')"
      placement="right"
      width="420"
      @after-open-change="onHistoryOpenChange"
    >
      <a-spin :spinning="historyLoading">
        <a-empty v-if="!historyRows.length && !historyLoading" :description="t('gen.common.historyEmpty')" />
        <a-list v-else :data-source="historyRows" item-layout="vertical">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta
                :title="item.projectName || '—'"
                :description="formatTime(item.createdAt)"
              />
              <p class="history-preview">{{ item.preview }}</p>
              <a-button
                size="small"
                type="link"
                :disabled="!item.outputPath"
                @click="loadHistoryRecord(item)"
              >
                {{ t("gen.common.loadHistory") }}
              </a-button>
            </a-list-item>
          </template>
        </a-list>
      </a-spin>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { marked } from "marked";
import DOMPurify from "dompurify";
import { computed, ref } from "vue";
import { Modal, message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useAiGenerator } from "@/composables/useAiGenerator";

import "@/styles/generator.less";

defineOptions({ name: "GeneratePRD" });

const { t } = useI18n();
const route = useRoute();

const {
  projectName,
  userContent,
  referenceFiles,
  referenceItems,
  result,
  renderedHtml,
  generating,
  lastRecordId,
  customProviderId,
  customOutputPath,
  outputFormat,
  allProviders,
  selectedProvider,
  saveProviderField,
  addReference,
  removeReferenceFile,
  generate,
  saveDocument,
  copyResult,
  setResultForNextStep,
  selectOutputDir,
  projectCacheStatus,
  projectCacheInfo,
  analyzingProject,
  analyzeProject,
  referenceProjectPath,
  scopeLevel,
  stopGenerate,
  addReferenceFolder,
  selectReferenceProject,
  clearProjectCache,
} = useAiGenerator("prd");

async function pickOutputDir() {
  const dir = await selectOutputDir();
  if (dir) customOutputPath.value = dir;
}

const refDragOver = ref(false);

async function onRefDrop(e: DragEvent) {
  refDragOver.value = false;
  const files = e.dataTransfer?.files;
  if (!files?.length) return;
  let added = 0;
  for (let i = 0; i < files.length; i++) {
    const f = files[i] as File & { path?: string };
    if (f.path) {
      if (referenceItems.value.some((x) => x.path === f.path)) continue;
      try {
        const parsed = await window.electronAPI.app.parseDocument(f.path!);
        if (isIpcErr(parsed)) {
          message.error(parsed.message);
          continue;
        }
        if (parsed && typeof parsed === "object" && "content" in parsed) {
          const content = String((parsed as { content: string }).content);
          referenceItems.value = [...referenceItems.value, { path: f.path!, content }];
          added++;
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (added) {
    message.success(t("gen.common.referenceLoaded"));
  }
}

const historyOpen = ref(false);
const historyLoading = ref(false);
const historyList = ref<GenerationRecord[]>([]);

const canOpenInWindow = computed(() => Boolean(window.electronAPI?.app?.openInWindow));

function isIpcErr(v: unknown): v is IpcErrorResult {
  return typeof v === "object" && v !== null && (v as IpcErrorResult).__ipcError === true;
}

function fileBaseName(p: string): string {
  const parts = p.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || p;
}

const historyRows = computed(() => historyList.value.filter((r) => r.docType === "prd"));

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function onRegenerate() {
  Modal.confirm({
    title: t("gen.common.regenerate"),
    content: t("gen.common.regenerateConfirm"),
    okText: t("common.confirm"),
    cancelText: t("common.cancel"),
    onOk: () => generate(),
  });
}

function openThisInWindow() {
  const path = route.path.startsWith("/") ? route.path : `/${route.path}`;
  void window.electronAPI?.app.openInWindow(path);
}

async function onHistoryOpenChange(open: boolean) {
  if (!open) return;
  historyLoading.value = true;
  try {
    const res = await window.electronAPI.ai.getHistory();
    if (isIpcErr(res)) {
      message.error(res.message);
      historyList.value = [];
      return;
    }
    historyList.value = Array.isArray(res) ? (res as GenerationRecord[]) : [];
  } finally {
    historyLoading.value = false;
  }
}

async function loadHistoryRecord(item: GenerationRecord) {
  if (!item.outputPath) {
    message.warning(t("gen.common.historyEmpty"));
    return;
  }
  const data = await window.electronAPI.ai.readOutputFile(item.outputPath);
  if (isIpcErr(data)) {
    message.error(data.message);
    return;
  }
  if (typeof data === "string") {
    result.value = data;
    lastRecordId.value = item.id;
    const raw = marked.parse(data) as string;
    renderedHtml.value = DOMPurify.sanitize(raw);
    historyOpen.value = false;
    message.success(t("gen.common.loadHistory"));
  }
}
</script>

<style lang="less" scoped>
.ref-tags {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.generator-actions {
  margin-top: 8px;
}

.gen-status {
  color: var(--app-text-secondary, rgba(0, 0, 0, 0.45));
  font-size: 12px;
}

.preview-spin {
  min-height: 200px;
}

.cache-info-line {
  font-size: 12px;
  color: var(--app-text-secondary, rgba(0, 0, 0, 0.45));
  margin-top: 4px;
}

.history-preview {
  font-size: 12px;
  color: var(--app-text-secondary, rgba(0, 0, 0, 0.55));
  margin: 8px 0;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow: hidden;
}
</style>
