<template>
  <div class="page-container generator-page">
    <div class="generator-page__header">
      <a-typography-title :level="4">{{ t("gen.ui.title") }}</a-typography-title>
      <p class="generator-page__desc">{{ t("gen.ui.description") }}</p>
    </div>

    <div class="generator-page__grid">
      <a-card class="generator-page__panel" :title="t('gen.common.input')" size="small">
        <a-form layout="vertical" :disabled="generating || imageGenerating">
          <a-form-item :label="t('gen.common.scopeLevel')">
            <a-radio-group v-model:value="scopeLevel">
              <a-radio-button value="project">{{ t('gen.common.scopeProject') }}</a-radio-button>
              <a-radio-button value="module">{{ t('gen.common.scopeModule') }}</a-radio-button>
            </a-radio-group>
          </a-form-item>
          <a-form-item :label="t('gen.ui.genMode')">
            <a-radio-group v-model:value="genMode">
              <a-radio-button value="doc">{{ t('gen.ui.modeDoc') }}</a-radio-button>
              <a-radio-button value="image">{{ t('gen.ui.modeImage') }}</a-radio-button>
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
              :placeholder="genMode === 'image' ? t('gen.ui.imageContentPlaceholder') : t('gen.common.contentPlaceholder')"
              :rows="8"
              show-count
            />
          </a-form-item>

          <a-form-item v-if="genMode === 'image'" :label="t('gen.ui.refImages')">
            <div
              class="ref-drop-zone"
              :class="{ 'ref-drop-zone--active': imgDragOver }"
              @dragover.prevent="imgDragOver = true"
              @dragleave.prevent="imgDragOver = false"
              @drop.prevent="onImageDrop"
            >
              <a-space wrap>
                <a-button @click="pickRefImages">
                  {{ t('gen.ui.uploadImages') }}
                </a-button>
                <span class="ref-drop-hint">{{ t('gen.ui.dropImageHint') }}</span>
              </a-space>
              <div v-if="refImages.length" class="ref-image-grid">
                <div v-for="(img, idx) in refImages" :key="idx" class="ref-image-item">
                  <img :src="img.dataUrl" :alt="img.name" class="ref-image-thumb" />
                  <a-button
                    class="ref-image-remove"
                    size="small"
                    type="text"
                    danger
                    @click="refImages.splice(idx, 1)"
                  >×</a-button>
                  <span class="ref-image-name">{{ img.name }}</span>
                </div>
              </div>
            </div>
          </a-form-item>

          <a-form-item v-if="genMode === 'image'" :label="t('gen.ui.imageFormat')">
            <a-radio-group v-model:value="imageFormat">
              <a-radio-button value="png">PNG</a-radio-button>
              <a-radio-button value="jpeg">JPEG</a-radio-button>
            </a-radio-group>
          </a-form-item>

          <a-form-item v-if="genMode === 'doc'" :label="t('gen.common.reference')">
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
          <a-form-item v-if="genMode === 'doc'" :label="t('gen.common.outputFormat')">
            <a-radio-group v-model:value="outputFormat">
              <a-radio-button value="md">{{ t('gen.common.formatMd') }}</a-radio-button>
              <a-radio-button value="docx">{{ t('gen.common.formatDocx') }}</a-radio-button>
              <a-radio-button value="pdf">{{ t('gen.common.formatPdf') }}</a-radio-button>
              <a-radio-button value="png">{{ t('gen.common.formatPng') }}</a-radio-button>
              <a-radio-button value="jpeg">{{ t('gen.common.formatJpeg') }}</a-radio-button>
              <a-radio-button value="gif">{{ t('gen.common.formatGif') }}</a-radio-button>
              <a-radio-button value="svg">{{ t('gen.common.formatSvg') }}</a-radio-button>
              <a-radio-button value="html">{{ t('gen.common.formatHtml') }}</a-radio-button>
            </a-radio-group>
          </a-form-item>
        </a-form>

        <a-space wrap class="generator-actions">
          <a-button
            type="primary"
            :loading="generating || imageGenerating"
            @click="genMode === 'image' ? generateUIImage() : generate()"
          >
            {{ genMode === 'image' ? t('gen.ui.generateImage') : t('gen.common.generate') }}
          </a-button>
          <span class="shortcut-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>
          <a-button v-if="generating || imageGenerating" danger @click="genMode === 'image' ? stopImageGenerate() : stopGenerate()">
            {{ t("gen.common.stopGenerate") }}
          </a-button>
          <a-button v-if="genMode === 'doc'" :disabled="generating || !userContent.trim()" @click="onRegenerate">
            {{ t("gen.common.regenerate") }}
          </a-button>
          <a-button v-if="genMode === 'doc'" :disabled="!result" @click="saveDocument">
            {{ t("gen.common.save") }}
          </a-button>
          <a-button :disabled="!result" @click="copyResult">
            {{ t("gen.common.copy") }}
          </a-button>
          <a-button v-if="genMode === 'doc'" @click="importFromPreviousResult">
            {{ t("gen.common.importPrev") }}
          </a-button>
          <a-button v-if="genMode === 'doc'" :disabled="!result" @click="setResultForNextStep">
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
            <span v-if="generating || imageGenerating" class="gen-status">{{ imageProgress?.message || t("gen.common.generating") }}</span>
            <a-button v-if="generatedPages.length && !imageGenerating" size="small" @click="refreshPreview">
              {{ t("gen.ui.refreshPreview") || "刷新预览" }}
            </a-button>
          </a-space>
        </template>
        <div v-if="imageGenerating && imageProgress" class="image-progress-bar">
          <a-progress
            :percent="imageProgress.stage === 'generating' ? undefined : (imageProgress.total > 0 ? Math.round((imageProgress.current / imageProgress.total) * 100) : 0)"
            :status="imageProgress.stage === 'done' ? 'success' : 'active'"
            :stroke-color="{ from: '#108ee9', to: '#87d068' }"
          />
          <div class="image-progress-text">{{ imageProgress.message }}</div>
        </div>
        <a-spin :spinning="generating || imageGenerating" class="preview-spin">
          <div class="generator-page__preview-body">
            <a-empty v-if="!result && !generating && !imageGenerating" :description="t('gen.common.noResult')" />
            <template v-else-if="genMode === 'image' && result">
              <template v-if="generatedPages.length > 1">
                <div v-for="(page, idx) in generatedPages" :key="idx" class="ui-page-section">
                  <div class="ui-page-title">
                    <a-typography-title :level="5" style="margin: 0">{{ page.name }}</a-typography-title>
                    <a-tag color="blue">{{ idx + 1 }}/{{ generatedPages.length }}</a-tag>
                  </div>
                  <div class="ui-page-image">
                    <img :src="'file:///' + page.imagePath.replace(/\\\\/g, '/')" :alt="page.name" style="max-width: 100%; border-radius: 6px;" />
                  </div>
                  <div class="ui-page-files">
                    <a-typography-text type="secondary" style="font-size: 12px">{{ page.imagePath }}</a-typography-text>
                  </div>
                </div>
              </template>
              <template v-else>
                <div class="ui-preview-html" v-html="result" />
              </template>
              <div v-if="generatedImagePaths.length" class="ui-saved-files">
                <a-typography-text type="success">
                  {{ t('gen.ui.savedTo') }}（{{ generatedPages.length || 1 }} {{ t('gen.ui.pagesCount') }}）
                </a-typography-text>
                <div v-for="fp in generatedImagePaths" :key="fp" class="ui-saved-file">
                  {{ fp }}
                </div>
              </div>
            </template>
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
import { computed, ref, watch } from "vue";
import { Modal, message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useAiGenerator } from "@/composables/useAiGenerator";

import "@/styles/generator.less";

defineOptions({ name: "GenerateUI" });

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
  importFromPreviousResult,
  setResultForNextStep,
  selectOutputDir,
  projectCacheStatus,
  projectCacheInfo,
  analyzingProject,
  analyzeProject,
  clearProjectCache,
  referenceProjectPath,
  scopeLevel,
  stopGenerate,
  addReferenceFolder,
  selectReferenceProject,
  teardownListeners,
  setupListeners,
} = useAiGenerator("ui");

const UI_PREFS_KEY = "devtool-ui-prefs";
const savedPrefs = (() => {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    return raw ? JSON.parse(raw) as { genMode?: string; imageFormat?: string } : {};
  } catch { return {}; }
})();

const genMode = ref<"doc" | "image">(savedPrefs.genMode === "image" ? "image" : "doc");
const imageFormat = ref<"png" | "jpeg">(savedPrefs.imageFormat === "jpeg" ? "jpeg" : "png");
const imageGenerating = ref(false);
const imageProgress = ref<{ stage: string; current: number; total: number; message: string } | null>(null);

watch([genMode, imageFormat], () => {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({
      genMode: genMode.value,
      imageFormat: imageFormat.value,
    }));
  } catch { /* ignore */ }
});
const refImages = ref<Array<{ name: string; dataUrl: string; base64: string; mimeType: string }>>([]);
const imgDragOver = ref(false);
const generatedImagePaths = ref<string[]>([]);
const generatedPages = ref<Array<{ name: string; imagePath: string; htmlPath: string }>>([]);
const useAppStoreLazy = () => {
  const store = import("@/store/app").then((m) => m.useAppStore());
  return store;
};

async function pickOutputDir() {
  const dir = await selectOutputDir();
  if (dir) customOutputPath.value = dir;
}

function readFileAsBase64(file: File): Promise<{ base64: string; dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
      if (match) {
        resolve({ base64: match[2], dataUrl, mimeType: match[1] });
      } else {
        reject(new Error("Failed to read image"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function pickRefImages() {
  const paths = await window.electronAPI.app.selectImages();
  if (isIpcErr(paths) || !Array.isArray(paths) || !paths.length) return;
  for (const fp of paths as string[]) {
    const imgData = await window.electronAPI.app.readImageAsBase64(fp);
    if (!imgData || isIpcErr(imgData)) {
      message.error(t("gen.ui.imageReadFail"));
      continue;
    }
    const data = imgData as { base64: string; mimeType: string; name: string; dataUrl: string };
    refImages.value = [...refImages.value, {
      name: data.name,
      dataUrl: data.dataUrl,
      base64: data.base64,
      mimeType: data.mimeType,
    }];
  }
}

async function onImageDrop(e: DragEvent) {
  imgDragOver.value = false;
  const files = e.dataTransfer?.files;
  if (!files?.length) return;
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f.type.startsWith("image/")) continue;
    try {
      const { base64, dataUrl, mimeType } = await readFileAsBase64(f);
      refImages.value = [...refImages.value, { name: f.name, dataUrl, base64, mimeType }];
    } catch {
      /* ignore */
    }
  }
}

async function stopImageGenerate() {
  try {
    await window.electronAPI.ai.stopGenerate();
  } catch { /* ignore */ }
  imageGenerating.value = false;
}

async function generateUIImage() {
  if (!userContent.value.trim() && !refImages.value.length) {
    message.warning(t("gen.ui.needContentOrImage"));
    return;
  }
  if (scopeLevel.value === "module" && !referenceItems.value.length && !referenceProjectPath.value && !refImages.value.length) {
    message.warning(t("gen.common.needRefOrProject"));
    return;
  }
  teardownListeners();
  imageGenerating.value = true;
  imageProgress.value = { stage: "generating", current: 0, total: 0, message: "准备中..." };
  result.value = "";
  renderedHtml.value = "";
  generatedImagePaths.value = [];
  generatedPages.value = [];

  const cleanupProgress = window.electronAPI.ai.onImageProgress((p) => {
    imageProgress.value = p as { stage: string; current: number; total: number; message: string };
  });
  const cleanupPageReady = window.electronAPI.ai.onPageReady((page) => {
    const p = page as { name: string; imagePath: string; htmlPath: string; index: number; total: number };
    generatedPages.value = [...generatedPages.value, { name: p.name, imagePath: p.imagePath, htmlPath: p.htmlPath }];
    generatedImagePaths.value = [...generatedImagePaths.value, p.imagePath, p.htmlPath];
    result.value = `已渲染 ${p.index + 1}/${p.total} 页`;
  });

  try {
    const appStore = (await import("@/store/app")).useAppStore();
    const outputDir = customOutputPath.value || appStore.config.outputPath;
    if (!outputDir) {
      const picked = await selectOutputDir();
      if (!picked) {
        imageGenerating.value = false;
        return;
      }
      customOutputPath.value = picked;
    }

    const images = refImages.value.map((img) => ({
      base64: img.base64,
      mimeType: img.mimeType,
    }));

    let imgUserContent = userContent.value;
    if (scopeLevel.value === "module") {
      imgUserContent = `【模块级别需求】以下描述的是系统中某个模块的 UI，请保持与系统整体的导航风格、设计语言、组件库一致，确保页面能无缝融入现有系统。\n\n${imgUserContent}`;
    }

    const refContent = referenceItems.value.map((r) => r.content).join("\n\n---\n\n");

    const res = await window.electronAPI.ai.generateUIImage({
      projectName: projectName.value,
      userContent: imgUserContent,
      providerId: customProviderId.value || undefined,
      images: images.length ? images : undefined,
      outputDir: customOutputPath.value || appStore.config.outputPath,
      imageFormat: imageFormat.value,
      referenceContent: refContent || undefined,
      projectPath: referenceProjectPath.value || appStore.config.projectPath || undefined,
    });

    if (isIpcErr(res)) {
      message.error((res as IpcErrorResult).message);
    } else {
      const data = res as { htmlResult: string; savedFiles: string[]; recordId: string; pages?: Array<{ name: string; imagePath: string; htmlPath: string }> };
      result.value = data.htmlResult;
      renderedHtml.value = data.htmlResult;
      if (data.pages?.length) generatedPages.value = data.pages;
      if (data.savedFiles?.length) generatedImagePaths.value = data.savedFiles;
      lastRecordId.value = data.recordId;
      const imgCount = data.savedFiles.filter((f) => !f.endsWith(".html")).length;
      message.success(t("gen.ui.imageGenSuccess", { count: imgCount }));
    }
  } catch (err: unknown) {
    const msg = err && typeof err === "object" && "message" in err
      ? String((err as { message: string }).message) : String(err);
    message.error(msg);
  } finally {
    cleanupProgress();
    cleanupPageReady();
    window.electronAPI.ai.offImageProgress();
    window.electronAPI.ai.offPageReady();
    imageGenerating.value = false;
    imageProgress.value = null;
    setupListeners();
  }
}

async function refreshPreview() {
  if (!generatedPages.value.length) return;
  const allPaths = generatedPages.value.flatMap((p) => [p.imagePath, p.htmlPath]);
  try {
    const exists = await window.electronAPI.ai.checkFilesExist(allPaths);
    const remaining = generatedPages.value.filter((p) => exists[p.imagePath]);
    if (remaining.length !== generatedPages.value.length) {
      generatedPages.value = remaining;
      generatedImagePaths.value = generatedImagePaths.value.filter((f) => exists[f]);
      const removed = generatedPages.value.length - remaining.length;
      message.info(`已移除 ${generatedPages.value.length - remaining.length} 个不存在的页面`);
    } else {
      message.success("所有文件均存在");
    }
    if (!remaining.length) {
      result.value = "";
      renderedHtml.value = "";
    }
  } catch {
    message.error("刷新失败");
  }
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

const historyRows = computed(() => historyList.value.filter((r) => r.docType === "ui"));

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
.ref-image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.ref-image-item {
  position: relative;
  width: 120px;
  text-align: center;
}

.ref-image-thumb {
  width: 120px;
  height: 90px;
  object-fit: cover;
  border-radius: var(--app-radius-sm);
  border: 1px solid var(--app-glass-border);
  transition: transform var(--app-transition);
  &:hover {
    transform: scale(1.05);
  }
}

.ref-image-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 14px;
  line-height: 1;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  &:hover {
    background: rgba(255, 0, 0, 0.7);
    color: #fff;
  }
}

.ref-image-name {
  display: block;
  font-size: 11px;
  color: var(--app-text-secondary, rgba(0, 0, 0, 0.55));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 4px;
}

.ui-preview-html {
  border: 1px solid var(--app-glass-border);
  border-radius: var(--app-radius-md);
  overflow: auto;
  max-height: 600px;
  padding: 0;
}

.ui-page-section {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px dashed var(--app-border, #d9d9d9);
  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
}

.ui-page-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.ui-page-image {
  border: 1px solid var(--app-glass-border);
  border-radius: var(--app-radius-md);
  overflow: hidden;
  margin-bottom: 8px;
}

.ui-page-files {
  margin-top: 4px;
}

.ui-saved-files {
  margin-top: 12px;
  padding: 14px 16px;
  background: var(--app-glass-bg);
  backdrop-filter: blur(8px);
  border: 1px solid var(--app-glass-border);
  border-radius: var(--app-radius-md);
}

.ui-saved-file {
  font-size: 12px;
  color: var(--app-text-secondary, rgba(0, 0, 0, 0.55));
  word-break: break-all;
  margin-top: 4px;
}

.image-progress-bar {
  padding: 14px 18px;
  margin-bottom: 12px;
  background: var(--app-glass-bg);
  backdrop-filter: blur(8px);
  border: 1px solid var(--app-glass-border);
  border-radius: var(--app-radius-md);
}

.image-progress-text {
  font-size: 13px;
  color: var(--app-text-secondary, rgba(0, 0, 0, 0.55));
  margin-top: 4px;
}
</style>
