<template>
  <div class="page-container generator-page">
    <div class="generator-page__header">
      <a-typography-title :level="4">{{ t("gen.ui.title") }}</a-typography-title>
      <p class="generator-page__desc">{{ t("gen.ui.description") }}</p>
    </div>

    <div class="generator-page__grid">
      <a-card class="generator-page__panel" :title="t('gen.common.input')" size="small">
        <a-form layout="vertical" :disabled="generating || imageGenerating || figmaGenerating || uiPromptAnalyzing">
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
              <a-radio-button value="figma" :disabled="!figmaEnabled">{{ t('gen.ui.modeFigma') }}</a-radio-button>
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

          <a-form-item v-if="genMode !== 'doc'" :label="t('gen.ui.refImages')">
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

          <a-form-item
            v-if="genMode === 'image'"
            :label="t('gen.ui.imageMode')"
            :extra="t('gen.ui.imageModeHint')"
          >
            <a-radio-group v-model:value="uiImageMode">
              <a-radio-button value="fast">{{ t('gen.ui.imageModeFast') }}</a-radio-button>
              <a-radio-button value="quality">{{ t('gen.ui.imageModeQuality') }}</a-radio-button>
            </a-radio-group>
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

          <a-form-item
            v-if="genMode !== 'doc'"
            :label="t('gen.ui.analyzedPrompt')"
            :extra="t('gen.ui.analyzedPromptHint')"
          >
            <a-textarea
              v-model:value="uiAnalyzedPrompt"
              :placeholder="t('gen.ui.analyzedPromptPlaceholder')"
              :rows="8"
              show-count
            />
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
            v-if="genMode === 'image'"
            v-model="imageProviderId"
            :all-providers="allProviders"
            :selected-provider="selectedImageProvider"
            :save-provider-field="saveProviderField"
            :label="t('gen.ui.imageAi')"
            :placeholder="t('gen.ui.imageAiPlaceholder')"
            :hint="t('gen.ui.imageAiHint')"
          />
          <div v-if="genMode === 'image'" class="image-route-hint">
            <a-tag :color="imageRouteHintTone">
              {{ imageRouteHint }}
            </a-tag>
            <a-typography-text v-if="selectedImageProvider && selectedProvider && imageProviderCapability?.outputKind === 'image'" type="secondary">
              {{ t('gen.ui.routeFallbackHint', { model: selectedProvider.model }) }}
            </a-typography-text>
          </div>
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
            :loading="generating || uiPromptAnalyzing"
            @click="genMode === 'doc' ? generate() : analyzeUIPrompt()"
          >
            {{ genMode === 'doc' ? t('gen.common.generate') : t('gen.ui.analyzePrompt') }}
          </a-button>
          <a-button
            v-if="genMode === 'image'"
            type="primary"
            ghost
            :loading="imageGenerating"
            :disabled="uiPromptAnalyzing || imageGenerating || !uiAnalyzedPrompt.trim()"
            @click="generateUIImage"
          >
            {{ t('gen.ui.generateFromPrompt') }}
          </a-button>
          <a-button
            v-if="genMode === 'figma'"
            type="primary"
            ghost
            :loading="figmaGenerating"
            :disabled="uiPromptAnalyzing || figmaGenerating || !uiAnalyzedPrompt.trim() || !figmaEnabled"
            @click="generateFigmaFile"
          >
            {{ t('gen.ui.generateFigmaFromPrompt') }}
          </a-button>
          <span class="shortcut-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd></span>
          <a-button v-if="generating || imageGenerating || figmaGenerating || uiPromptAnalyzing" danger @click="genMode === 'doc' ? stopGenerate() : stopImageGenerate()">
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
        <div v-if="validationLogs.length" class="validation-log">
          <div
            v-for="(log, idx) in validationLogs"
            :key="idx"
            class="validation-log__item"
            :class="`validation-log__item--${log.stage}`"
          >
            {{ log.message }}
          </div>
        </div>
      </a-card>

      <GenerateUIPreview
        :generating="generating"
        :image-generating="imageGenerating"
        :figma-generating="figmaGenerating"
        :ui-prompt-analyzing="uiPromptAnalyzing"
        :ui-analyze-status="uiAnalyzeStatus"
        :image-progress="imageProgress"
        :generated-pages="generatedPages"
        :generated-image-paths="generatedImagePaths"
        :result="result"
        :ui-analyzed-prompt="uiAnalyzedPrompt"
        :gen-mode="genMode"
        :rendered-html="renderedHtml"
        @refresh="refreshPreview"
      />
    </div>

    <GenerateUIHistoryDrawer
      v-model:open="historyOpen"
      :loading="historyLoading"
      :rows="historyRows"
      :format-time="formatTime"
      @after-open-change="onHistoryOpenChange"
      @load="loadHistoryRecord"
    />
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
import { useAppStore } from "@/store/app";
import { getModelCapabilityInfo } from "../../electron/model-capabilities";
import GenerateUIHistoryDrawer from "@/components/generate-ui/GenerateUIHistoryDrawer.vue";
import GenerateUIPreview from "@/components/generate-ui/GenerateUIPreview.vue";
import {
  collectGeneratedPageFiles,
  collectGeneratedPagesFiles,
  type GenerateUIImageResponse,
  type GeneratedUIPage,
  type PageReadyPayload,
  type UIGenMode,
  type UIImageProgress,
} from "@/components/generate-ui/types";

import "@/styles/generator.less";

defineOptions({ name: "GenerateUI" });

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
  validationLogs,
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
    return raw ? JSON.parse(raw) as {
      genMode?: string;
      imageFormat?: string;
      uiImageMode?: string;
      imageProviderId?: string;
    } : {};
  } catch { return {}; }
})();

const genMode = ref<UIGenMode>(
  savedPrefs.genMode === "image" || savedPrefs.genMode === "figma" ? savedPrefs.genMode : "doc",
);
const imageFormat = ref<"png" | "jpeg">(savedPrefs.imageFormat === "jpeg" ? "jpeg" : "png");
const uiImageMode = ref<"fast" | "quality">(savedPrefs.uiImageMode === "quality" ? "quality" : "fast");
const imageProviderId = ref(savedPrefs.imageProviderId || "");
const uiPromptAnalyzing = ref(false);
const uiAnalyzeStatus = ref("");
const uiAnalyzedPrompt = ref("");
const imageGenerating = ref(false);
const figmaGenerating = ref(false);
const imageProgress = ref<UIImageProgress | null>(null);
const figmaEnabled = computed(() => Boolean(appStore.config.figmaConnector?.enabled));
const selectedImageProvider = computed(() => {
  if (!imageProviderId.value) return null;
  return (appStore.config.aiProviders ?? []).find((p) => p.id === imageProviderId.value) ?? null;
});
const activeProvider = computed(() => {
  const id = appStore.config.activeProviderId;
  return (appStore.config.aiProviders ?? []).find((p) => p.id === id) ?? null;
});
const effectiveImageProvider = computed(() => selectedImageProvider.value ?? selectedProvider.value ?? activeProvider.value);
const imageProviderCapability = computed(() => {
  const provider = effectiveImageProvider.value;
  return provider ? getModelCapabilityInfo(provider.model) : null;
});
const imageRouteHint = computed(() => {
  const info = imageProviderCapability.value;
  if (!info) return t("gen.ui.routeUnknown");
  if (info.outputKind === "image") {
    return t("gen.ui.routeDirectImage", { model: info.model });
  }
  if (info.outputKind === "text") {
    return t("gen.ui.routeHtmlRender", { model: info.model });
  }
  return t("gen.ui.routeUnknownModel", { model: info.model });
});
const imageRouteHintTone = computed<"success" | "processing" | "warning">(() => {
  const kind = imageProviderCapability.value?.outputKind;
  if (kind === "image") return "success";
  if (kind === "text") return "processing";
  return "warning";
});

watch([genMode, imageFormat, uiImageMode, imageProviderId], () => {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify({
      genMode: genMode.value,
      imageFormat: imageFormat.value,
      uiImageMode: uiImageMode.value,
      imageProviderId: imageProviderId.value,
    }));
  } catch { /* ignore */ }
});
const refImages = ref<Array<{ name: string; dataUrl: string; base64: string; mimeType: string }>>([]);
const imgDragOver = ref(false);
const generatedImagePaths = ref<string[]>([]);
const generatedPages = ref<GeneratedUIPage[]>([]);
const activeImageRequestId = ref<string | null>(null);
const activeUiAuxRequestId = ref<string | null>(null);
const REF_IMAGE_MAX_EDGE = 1600;
const REF_IMAGE_COMPRESS_MIN_BYTES = 900 * 1024;
const REF_IMAGE_JPEG_QUALITY = 0.82;

function createUIRequestId(prefix: string): string {
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
}
watch(uiAnalyzedPrompt, (value) => {
  if (genMode.value === "doc" || generatedPages.value.length) return;
  result.value = value;
  const raw = marked.parse(value || "") as string;
  renderedHtml.value = DOMPurify.sanitize(raw);
});

watch(figmaEnabled, (enabled) => {
  if (!enabled && genMode.value === "figma") {
    genMode.value = "doc";
  }
});

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
      message.error(t("gen.ui.imageReadFail"));
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

async function stopImageGenerate() {
  try {
    await window.electronAPI.ai.stopGenerate();
  } catch { /* ignore */ }
  uiPromptAnalyzing.value = false;
  uiAnalyzeStatus.value = "";
  imageGenerating.value = false;
  figmaGenerating.value = false;
  activeImageRequestId.value = null;
  activeUiAuxRequestId.value = null;
}

async function analyzeUIPrompt() {
  if (!userContent.value.trim() && !refImages.value.length && !referenceItems.value.length && !referenceProjectPath.value) {
    message.warning(t("gen.ui.needContentOrImage"));
    return;
  }
  if (scopeLevel.value === "module" && !referenceItems.value.length && !referenceProjectPath.value && !refImages.value.length) {
    message.warning(t("gen.common.needRefOrProject"));
    return;
  }

  teardownListeners();
  const analyzeRequestId = createUIRequestId("ui-analyze");
  activeUiAuxRequestId.value = analyzeRequestId;
  uiPromptAnalyzing.value = true;
  uiAnalyzeStatus.value = t("gen.ui.analyzingPrompt");
  uiAnalyzedPrompt.value = "";
  result.value = "";
  renderedHtml.value = "";
  generatedImagePaths.value = [];
  generatedPages.value = [];

  try {
    const appStore = (await import("@/store/app")).useAppStore();
    const images = refImages.value.map((img) => ({
      base64: img.base64,
      mimeType: img.mimeType,
    }));
    const refContent = referenceItems.value.map((r) => r.content).join("\n\n---\n\n");
    const res = await window.electronAPI.ai.analyzeUIPrompt({
      projectName: projectName.value,
      userContent: userContent.value,
      providerId: customProviderId.value || undefined,
      images: images.length ? images : undefined,
      referenceContent: refContent || undefined,
      projectPath: referenceProjectPath.value || appStore.config.projectPath || undefined,
      isModuleScope: scopeLevel.value === "module",
    });

    if (activeUiAuxRequestId.value !== analyzeRequestId) return;
    if (isIpcErr(res)) {
      message.error(res.message);
      return;
    }

    uiAnalyzedPrompt.value = String(res.analyzedPrompt || "").trim();
    result.value = uiAnalyzedPrompt.value;
    const raw = marked.parse(uiAnalyzedPrompt.value) as string;
    renderedHtml.value = DOMPurify.sanitize(raw);
    message.success(t("gen.ui.analyzePromptSuccess"));
  } catch (err: unknown) {
    const msg = err && typeof err === "object" && "message" in err
      ? String((err as { message: string }).message) : String(err);
    if (activeUiAuxRequestId.value === analyzeRequestId) message.error(msg);
  } finally {
    if (activeUiAuxRequestId.value === analyzeRequestId) {
      activeUiAuxRequestId.value = null;
      uiPromptAnalyzing.value = false;
      uiAnalyzeStatus.value = "";
    }
    setupListeners();
  }
}

async function generateUIImage() {
  if (!uiAnalyzedPrompt.value.trim()) {
    message.warning(t("gen.ui.needAnalyzePrompt"));
    return;
  }
  if (!userContent.value.trim() && !refImages.value.length && !referenceItems.value.length && !referenceProjectPath.value) {
    message.warning(t("gen.ui.needContentOrImage"));
    return;
  }
  if (scopeLevel.value === "module" && !referenceItems.value.length && !referenceProjectPath.value && !refImages.value.length) {
    message.warning(t("gen.common.needRefOrProject"));
    return;
  }
  teardownListeners();
  const requestId = createUIRequestId("ui-image");
  activeImageRequestId.value = requestId;
  imageGenerating.value = true;
  imageProgress.value = { stage: "generating", current: 0, total: 0, message: t("gen.ui.preparing") };
  result.value = "";
  renderedHtml.value = "";
  generatedImagePaths.value = [];
  generatedPages.value = [];

  const cleanupProgress = window.electronAPI.ai.onImageProgress((p) => {
    const progress = p as UIImageProgress;
    if (progress.requestId !== requestId) return;
    imageProgress.value = progress;
  });
  const cleanupPageReady = window.electronAPI.ai.onPageReady((page) => {
    const p = page as PageReadyPayload;
    if (p.requestId !== requestId) return;
    generatedPages.value = [...generatedPages.value, { name: p.name, imagePath: p.imagePath, htmlPath: p.htmlPath }];
    generatedImagePaths.value = [...generatedImagePaths.value, ...collectGeneratedPageFiles(p)];
    result.value = t("gen.ui.renderedPages", { current: p.index + 1, total: p.total });
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

    const refContent = referenceItems.value.map((r) => r.content).join("\n\n---\n\n");

    const res = await window.electronAPI.ai.generateUIImage({
      requestId,
      projectName: projectName.value,
      userContent: uiAnalyzedPrompt.value,
      analyzedPrompt: uiAnalyzedPrompt.value,
      providerId: imageProviderId.value || customProviderId.value || undefined,
      fallbackProviderId: imageProviderId.value ? customProviderId.value || undefined : undefined,
      images: images.length ? images : undefined,
      outputDir: customOutputPath.value || appStore.config.outputPath,
      imageFormat: imageFormat.value,
      imageMode: uiImageMode.value,
      referenceContent: refContent || undefined,
      projectPath: referenceProjectPath.value || appStore.config.projectPath || undefined,
      isModuleScope: scopeLevel.value === "module",
    });

    if (activeImageRequestId.value !== requestId) return;
    if (isIpcErr(res)) {
      handleOutputPathError(res.message);
      message.error((res as IpcErrorResult).message);
    } else {
      const data = res as GenerateUIImageResponse;
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
    if (activeImageRequestId.value === requestId) message.error(msg);
  } finally {
    cleanupProgress();
    cleanupPageReady();
    if (activeImageRequestId.value === requestId) {
      imageGenerating.value = false;
      activeImageRequestId.value = null;
      imageProgress.value = null;
    }
    setupListeners();
  }
}

async function generateFigmaFile() {
  if (!figmaEnabled.value) {
    message.warning(t("gen.ui.figmaDisabled"));
    return;
  }
  if (!uiAnalyzedPrompt.value.trim()) {
    message.warning(t("gen.ui.needAnalyzePrompt"));
    return;
  }
  if (!userContent.value.trim() && !refImages.value.length && !referenceItems.value.length && !referenceProjectPath.value) {
    message.warning(t("gen.ui.needContentOrImage"));
    return;
  }
  if (scopeLevel.value === "module" && !referenceItems.value.length && !referenceProjectPath.value && !refImages.value.length) {
    message.warning(t("gen.common.needRefOrProject"));
    return;
  }

  teardownListeners();
  const figmaRequestId = createUIRequestId("ui-figma");
  activeUiAuxRequestId.value = figmaRequestId;
  figmaGenerating.value = true;
  imageProgress.value = { stage: "figma", current: 0, total: 0, message: t("gen.ui.generateFigmaFromPrompt") };
  result.value = "";
  renderedHtml.value = "";
  generatedImagePaths.value = [];
  generatedPages.value = [];

  try {
    const outputDir = customOutputPath.value || appStore.config.outputPath;
    if (!outputDir) {
      const picked = await selectOutputDir();
      if (!picked) {
        figmaGenerating.value = false;
        return;
      }
      customOutputPath.value = picked;
    }
    const refContent = referenceItems.value.map((r) => r.content).join("\n\n---\n\n");
    const res = await window.electronAPI.ai.generateFigmaFile({
      projectName: projectName.value,
      analyzedPrompt: uiAnalyzedPrompt.value,
      providerId: customProviderId.value || undefined,
      outputDir: customOutputPath.value || appStore.config.outputPath,
      fileNameTemplate: appStore.config.figmaConnector?.defaultFileName,
      referenceContent: refContent || undefined,
      projectPath: referenceProjectPath.value || appStore.config.projectPath || undefined,
    });
    if (activeUiAuxRequestId.value !== figmaRequestId) return;
    if (isIpcErr(res)) {
      handleOutputPathError(res.message);
      message.error(res.message);
      return;
    }
    const data = res as { filePath: string; fileName: string; recordId: string };
    lastRecordId.value = data.recordId;
    generatedImagePaths.value = [data.filePath];
    result.value = [
      `# ${t("gen.ui.figmaGenSuccess")}`,
      "",
      t("gen.ui.figmaSavedTo", { path: data.filePath }),
      "",
      t("gen.ui.figmaImportHint"),
    ].join("\n");
    const raw = marked.parse(result.value) as string;
    renderedHtml.value = DOMPurify.sanitize(raw);
    message.success(t("gen.ui.figmaGenSuccess"));
  } catch (err: unknown) {
    const msg = err && typeof err === "object" && "message" in err
      ? String((err as { message: string }).message) : String(err);
    if (activeUiAuxRequestId.value === figmaRequestId) message.error(msg);
  } finally {
    if (activeUiAuxRequestId.value === figmaRequestId) {
      activeUiAuxRequestId.value = null;
      figmaGenerating.value = false;
      imageProgress.value = null;
    }
    setupListeners();
  }
}

async function refreshPreview() {
  if (!generatedPages.value.length) return;
  const allPaths = collectGeneratedPagesFiles(generatedPages.value);
  try {
    const exists = await window.electronAPI.ai.checkFilesExist(allPaths);
    const remaining = generatedPages.value.filter((p) => exists[p.imagePath]);
    const removedCount = generatedPages.value.length - remaining.length;
    if (removedCount > 0) {
      generatedPages.value = remaining;
      generatedImagePaths.value = generatedImagePaths.value.filter((f) => exists[f]);
      message.info(t("gen.ui.removedPages", { count: removedCount }));
    } else {
      message.success(t("gen.ui.allFilesExist"));
    }
    if (!remaining.length) {
      result.value = "";
      renderedHtml.value = "";
    }
  } catch {
    message.error(t("gen.ui.refreshFailed"));
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

function handleOutputPathError(errorMessage: string): void {
  if (/trusted paths|可信路径/.test(errorMessage)) {
    customOutputPath.value = "";
    message.warning(t("gen.common.outputPathUntrusted"));
  }
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
  border-radius: 0;
  border: 0;
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
  background: rgba(8, 13, 22, 0.82);
  color: #fff;
  &:hover {
    background: rgba(255, 0, 0, 0.7);
    color: #fff;
  }
}

.ref-image-name {
  display: block;
  font-size: 11px;
  color: rgba(203, 213, 225, 0.82);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 4px;
}

.image-route-hint {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: -4px 0 16px;
}

</style>
