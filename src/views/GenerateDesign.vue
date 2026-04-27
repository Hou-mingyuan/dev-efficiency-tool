<template>
  <div class="page-container generator-page">
    <div class="generator-page__header">
      <a-typography-title :level="4">{{ t("gen.design.title") }}</a-typography-title>
      <p class="generator-page__desc">{{ t("gen.design.description") }}</p>
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

        <!-- 方法论文档面板 -->
        <a-collapse
          v-model:activeKey="methodologyPanelKey"
          :bordered="false"
          class="methodology-collapse"
          @change="onMethodologyPanelChange"
        >
          <a-collapse-panel key="methodology" :header="t('methodology.panelTitle')">
            <div class="meth-dir-bar">
              <a-input
                :value="methDirPath"
                :placeholder="t('settings.methodologyPath')"
                size="small"
                style="flex: 1"
                readonly
              />
              <a-button size="small" @click="pickMethDir">
                {{ t("common.selectDir") }}
              </a-button>
              <a-button
                size="small"
                type="link"
                :loading="methListLoading"
                @click="refreshMethFiles"
              >
                {{ t("common.refresh") }}
              </a-button>
            </div>
            <a-spin :spinning="methListLoading" :tip="t('methodology.loading')">
              <a-empty v-if="!methListLoading && methFiles.length === 0" :description="t('methodology.noFiles')" />
              <a-list
                v-else
                size="small"
                :data-source="methFiles"
                :bordered="false"
                class="meth-file-list"
              >
                <template #renderItem="{ item }">
                  <a-list-item class="meth-file-item">
                    <span class="meth-file-name" :title="item.name">{{ item.name }}</span>
                    <a-space size="small">
                      <a-button
                        size="small"
                        type="link"
                        @click="previewMethFile(item)"
                      >
                        {{ t("methodology.previewTitle") }}
                      </a-button>
                      <a-button
                        v-if="!isMethFileReferenced(item.path)"
                        size="small"
                        type="primary"
                        ghost
                        @click="addMethAsReference(item)"
                      >
                        {{ t("methodology.useAsRef") }}
                      </a-button>
                      <a-tag v-else color="green">
                        {{ t("methodology.alreadyRef") }}
                      </a-tag>
                    </a-space>
                  </a-list-item>
                </template>
              </a-list>
            </a-spin>
          </a-collapse-panel>
        </a-collapse>

        <a-space wrap class="generator-actions">
          <a-button type="primary" :loading="generating" @click="generate">
            {{ t("gen.common.generate") }}
          </a-button>
          <span class="shortcut-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>
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
          <a-button @click="importFromPreviousResult">
            {{ t("gen.common.importPrev") }}
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
          <a-space>
            <span v-if="generating" class="gen-status">{{ t("gen.common.generating") }}</span>
            <a-button
              v-if="renderedHtml"
              type="text"
              size="small"
              @click="fullscreenPreview = true"
            >
              <FullscreenOutlined />
            </a-button>
          </a-space>
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

    <a-modal
      v-model:open="fullscreenPreview"
      :title="t('gen.common.preview')"
      width="90vw"
      :footer="null"
      centered
      class="fullscreen-preview-modal"
    >
      <div class="markdown-body fullscreen-preview-body" v-html="renderedHtml" />
    </a-modal>

    <!-- 方法论文档预览抽屉 -->
    <a-drawer
      v-model:open="methPreviewOpen"
      :title="methPreviewName"
      placement="right"
      width="640"
    >
      <a-spin :spinning="methContentLoading">
        <a-alert
          v-if="methReadError"
          type="error"
          :message="t('methodology.readError')"
          :description="methReadError"
          show-icon
        />
        <div
          v-else-if="methPreviewHtml"
          class="markdown-body"
          v-html="methPreviewHtml"
        />
      </a-spin>
    </a-drawer>

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
import { computed, ref, onMounted } from "vue";
import { Modal, message } from "ant-design-vue";
import { FullscreenOutlined } from "@ant-design/icons-vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useAiGenerator } from "@/composables/useAiGenerator";
import { useAppStore } from "@/store/app";

import "@/styles/generator.less";

defineOptions({ name: "GenerateDesign" });
const fullscreenPreview = ref(false);

const { t } = useI18n();
const route = useRoute();
const appStore = useAppStore();

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
  importFromPreviousResult,
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
} = useAiGenerator("design");

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

const historyRows = computed(() => historyList.value.filter((r) => r.docType === "design"));

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

// ── 方法论文档集成 ──

interface MethFileInfo {
  name: string;
  path: string;
  size: number;
}

const methodologyPanelKey = ref<string[]>([]);
const methFiles = ref<MethFileInfo[]>([]);
const methListLoading = ref(false);
const methListLoaded = ref(false);

const methDirPath = computed(() => appStore.config.methodologyPath || "");

const methPreviewOpen = ref(false);
const methPreviewName = ref("");
const methContentLoading = ref(false);
const methReadError = ref("");
const methPreviewHtml = ref("");

function isMethFileReferenced(filePath: string): boolean {
  return referenceFiles.value.includes(filePath);
}

async function loadMethFiles() {
  if (methListLoaded.value) return;
  const api = window.electronAPI?.app;
  if (!api) return;
  methListLoading.value = true;
  try {
    const res = await api.getMethodologyFiles();
    if (isIpcErr(res)) {
      methFiles.value = [];
      return;
    }
    methFiles.value = Array.isArray(res) ? (res as MethFileInfo[]) : [];
    methListLoaded.value = true;
  } finally {
    methListLoading.value = false;
  }
}

function onMethodologyPanelChange(keys: string | string[]) {
  const arr = Array.isArray(keys) ? keys : [keys];
  if (arr.includes("methodology")) {
    void loadMethFiles();
  }
}

async function pickMethDir() {
  const e = window.electronAPI;
  if (!e) return;
  const dir = await e.app.selectDirectory(t("settings.methodologyPath"));
  if (isIpcErr(dir)) return;
  if (typeof dir === "string" && dir) {
    const cfg = { ...appStore.config, methodologyPath: dir };
    await appStore.setConfig(cfg);
    methListLoaded.value = false;
    void loadMethFiles();
  }
}

function refreshMethFiles() {
  methListLoaded.value = false;
  void loadMethFiles();
}

onMounted(() => {
  void appStore.fetchConfig();
});

async function previewMethFile(item: MethFileInfo) {
  methPreviewOpen.value = true;
  methPreviewName.value = item.name;
  methContentLoading.value = true;
  methReadError.value = "";
  methPreviewHtml.value = "";
  try {
    const api = window.electronAPI?.app;
    if (!api) {
      methReadError.value = "API unavailable";
      return;
    }
    const res = await api.readMethodologyFile(item.path);
    if (isIpcErr(res)) {
      methReadError.value = res.message;
      return;
    }
    if (typeof res !== "string") {
      methReadError.value = t("methodology.readError");
      return;
    }
    methPreviewHtml.value = DOMPurify.sanitize(marked.parse(res, { async: false }) as string);
  } finally {
    methContentLoading.value = false;
  }
}

async function addMethAsReference(item: MethFileInfo) {
  if (isMethFileReferenced(item.path)) return;
  const api = window.electronAPI?.app;
  if (!api) return;
  const res = await api.readMethodologyFile(item.path);
  if (isIpcErr(res)) {
    message.error(res.message);
    return;
  }
  if (typeof res === "string") {
    referenceItems.value = [...referenceItems.value, { path: item.path, content: res }];
    message.success(t("gen.common.referenceLoaded"));
  }
}
</script>

<style lang="less" scoped>
.methodology-collapse {
  margin: 12px 0 4px;
  background: transparent;
}

.meth-dir-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.meth-file-list {
  max-height: 240px;
  overflow-y: auto;
}

.meth-file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0 !important;
}

.meth-file-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 8px;
}
</style>
