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
          <a-form-item :label="t('gen.prd.referenceImages')">
            <div
              class="ref-drop-zone"
              :class="{ 'ref-drop-zone--active': imgDragOver }"
              @dragover.prevent="imgDragOver = true"
              @dragleave.prevent="imgDragOver = false"
              @drop.prevent="onImageDrop"
            >
              <a-space wrap>
                <a-button @click="pickRefImages">
                  {{ t("gen.prd.addReferenceImages") }}
                </a-button>
                <span class="ref-drop-hint">{{ t("gen.prd.dropImageHint") }}</span>
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
          <AiProviderInline
            v-model="imageProviderId"
            :all-providers="allProviders"
            :selected-provider="selectedImageProvider"
            :save-provider-field="saveProviderField"
            :label="t('gen.prd.imageAi')"
            :placeholder="t('gen.prd.imageAiPlaceholder')"
            :hint="t('gen.prd.imageAiHint')"
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
          <a-button
            :disabled="!result"
            :loading="prdImageGenerating"
            @click="generatePrdImages"
          >
            {{ t("gen.prd.generateImages") }}
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
import { FullscreenOutlined } from "@ant-design/icons-vue";
import { useI18n } from "vue-i18n";
import { useRoute } from "vue-router";
import { useAiGenerator } from "@/composables/useAiGenerator";
import { useAppStore } from "@/store/app";

import "@/styles/generator.less";

defineOptions({ name: "GeneratePRD" });

const { t } = useI18n();
const fullscreenPreview = ref(false);
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
  generationImages,
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

const refImages = ref<Array<{ name: string; dataUrl: string; base64: string; mimeType: string }>>([]);
const imgDragOver = ref(false);
const prdImageGenerating = ref(false);
const prdImageOutputPaths = ref<string[]>([]);
const imageProviderId = ref(localStorage.getItem("devtool-prd-image-provider-id") || "");
const selectedImageProvider = computed(() => {
  if (!imageProviderId.value) return null;
  return allProviders.value.find((p) => p.id === imageProviderId.value) ?? null;
});
const REF_IMAGE_MAX_EDGE = 1600;
const REF_IMAGE_COMPRESS_MIN_BYTES = 900 * 1024;
const REF_IMAGE_JPEG_QUALITY = 0.82;

watch(refImages, (images) => {
  generationImages.value = images.map((img) => ({
    base64: img.base64,
    mimeType: img.mimeType,
  }));
}, { deep: true });

watch(imageProviderId, (value) => {
  try {
    if (value) localStorage.setItem("devtool-prd-image-provider-id", value);
    else localStorage.removeItem("devtool-prd-image-provider-id");
  } catch {
    /* ignore */
  }
});

async function pickOutputDir() {
  const dir = await selectOutputDir();
  if (dir) customOutputPath.value = dir;
}

const refDragOver = ref(false);

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

function estimateBase64Bytes(base64: string): number {
  return Math.floor((base64.length * 3) / 4);
}

function compressImageDataUrl(payload: {
  base64: string;
  dataUrl: string;
  mimeType: string;
}): Promise<{ base64: string; dataUrl: string; mimeType: string }> {
  if (!/^image\/(png|jpe?g|webp)$/i.test(payload.mimeType)) {
    return Promise.resolve(payload);
  }

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxEdge = Math.max(image.naturalWidth, image.naturalHeight);
      const sourceBytes = estimateBase64Bytes(payload.base64);
      if (maxEdge <= REF_IMAGE_MAX_EDGE && sourceBytes <= REF_IMAGE_COMPRESS_MIN_BYTES) {
        resolve(payload);
        return;
      }

      const scale = Math.min(1, REF_IMAGE_MAX_EDGE / Math.max(1, maxEdge));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(payload);
        return;
      }
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", REF_IMAGE_JPEG_QUALITY);
      const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
      if (!match) {
        resolve(payload);
        return;
      }
      resolve({ dataUrl, mimeType: match[1], base64: match[2] });
    };
    image.onerror = () => resolve(payload);
    image.src = payload.dataUrl;
  });
}

async function pickRefImages() {
  const paths = await window.electronAPI.app.selectImages();
  if (isIpcErr(paths) || !Array.isArray(paths) || !paths.length) return;
  for (const fp of paths as string[]) {
    const imgData = await window.electronAPI.app.readImageAsBase64(fp);
    if (!imgData || isIpcErr(imgData)) {
      message.error(t("gen.prd.imageReadFail"));
      continue;
    }
    const data = imgData as { base64: string; mimeType: string; name: string; dataUrl: string };
    const compressed = await compressImageDataUrl(data);
    refImages.value = [...refImages.value, {
      name: data.name,
      dataUrl: compressed.dataUrl,
      base64: compressed.base64,
      mimeType: compressed.mimeType,
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
      const { base64, dataUrl, mimeType } = await compressImageDataUrl(await readFileAsBase64(f));
      refImages.value = [...refImages.value, { name: f.name, dataUrl, base64, mimeType }];
    } catch {
      /* ignore */
    }
  }
}

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

async function generatePrdImages() {
  if (!result.value.trim()) {
    message.warning(t("gen.prd.needPrdResult"));
    return;
  }
  const outputDir = customOutputPath.value || appStore.config.outputPath || (await selectOutputDir());
  if (!outputDir) return;

  prdImageGenerating.value = true;
  try {
    const res = await window.electronAPI.ai.generatePrdImages({
      projectName: projectName.value,
      prdContent: result.value,
      providerId: imageProviderId.value || undefined,
      outputDir,
      imageFormat: "png",
    });
    if (isIpcErr(res)) {
      if (/trusted paths|可信路径/.test(res.message)) {
        customOutputPath.value = "";
        message.warning(t("gen.common.outputPathUntrusted"));
      }
      message.error(res.message);
      return;
    }

    const data = res as {
      savedFiles: string[];
      images: Array<{ name: string; imagePath: string; dataUrl: string }>;
      recordId: string;
    };
    prdImageOutputPaths.value = data.savedFiles;
    const imageMarkdown = [
      "",
      "## PRD 附加图",
      "",
      ...data.images.flatMap((img) => [
        `### ${img.name}`,
        "",
        `![${img.name}](${img.dataUrl})`,
        "",
        `> 已保存到：${img.imagePath}`,
        "",
      ]),
    ].join("\n");
    result.value = `${result.value.trim()}\n\n${imageMarkdown}`;
    const raw = marked.parse(result.value) as string;
    renderedHtml.value = DOMPurify.sanitize(raw);
    lastRecordId.value = data.recordId;
    message.success(t("gen.prd.imageGenSuccess", { count: data.images.length }));
  } finally {
    prdImageGenerating.value = false;
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
.page-container { position: relative; z-index: 1; }

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
  margin-top: 4px;
  overflow: hidden;
  color: var(--app-text-secondary, rgba(255, 255, 255, 0.62));
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
