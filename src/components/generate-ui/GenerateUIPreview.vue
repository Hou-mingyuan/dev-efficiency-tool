<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface ImageProgress {
  stage: string;
  current: number;
  total: number;
  message: string;
}

interface GeneratedPage {
  name: string;
  imagePath: string;
  htmlPath?: string;
}

const props = defineProps<{
  generating: boolean;
  imageGenerating: boolean;
  figmaGenerating: boolean;
  uiPromptAnalyzing: boolean;
  uiAnalyzeStatus: string;
  imageProgress: ImageProgress | null;
  generatedPages: GeneratedPage[];
  generatedImagePaths: string[];
  result: string;
  uiAnalyzedPrompt: string;
  genMode: "doc" | "image" | "figma";
  renderedHtml: string;
}>();

defineEmits<{
  refresh: [];
}>();

const { t } = useI18n();

const progressPercent = computed(() => {
  const progress = props.imageProgress;
  if (!progress || progress.stage === "generating" || progress.total <= 0) return 0;
  return Math.min(100, Math.round((progress.current / progress.total) * 100));
});

const showProgressInfo = computed(() => props.imageProgress?.stage !== "generating");
const showWaitingCard = computed(() =>
  props.imageGenerating && !props.generatedPages.length,
);
const waitSteps = computed(() => [
  {
    key: "generating",
    label: t("gen.ui.waitingGeneratingCode"),
    active: props.imageProgress?.stage === "generating",
    done: props.imageProgress?.stage === "parsing" || props.imageProgress?.stage === "rendering" || props.imageProgress?.stage === "done",
  },
  {
    key: "rendering",
    label: t("gen.ui.waitingRendering"),
    active: props.imageProgress?.stage === "parsing" || props.imageProgress?.stage === "rendering",
    done: props.imageProgress?.stage === "done",
  },
  {
    key: "done",
    label: t("gen.ui.waitingDone"),
    active: props.imageProgress?.stage === "done",
    done: props.imageProgress?.stage === "done",
  },
]);

function fileUrl(filePath: string): string {
  return `file:///${filePath.replace(/\\/g, "/")}`;
}
</script>

<template>
  <a-card
    class="generator-page__panel generator-page__panel--preview generator-page__preview-card"
    :title="t('gen.common.preview')"
    size="small"
  >
    <template #extra>
      <a-space>
        <span
          v-if="generating || imageGenerating || figmaGenerating || uiPromptAnalyzing"
          class="gen-status"
        >
          {{ uiAnalyzeStatus || imageProgress?.message || t("gen.common.generating") }}
        </span>
        <a-button
          v-if="generatedPages.length && !imageGenerating"
          size="small"
          @click="$emit('refresh')"
        >
          {{ t("gen.ui.refreshPreview") }}
        </a-button>
      </a-space>
    </template>
    <div
      v-if="imageGenerating && imageProgress"
      class="image-progress-bar"
    >
      <a-progress
        :percent="progressPercent"
        :show-info="showProgressInfo"
        :status="imageProgress.stage === 'done' ? 'success' : 'active'"
        :stroke-color="{ from: '#108ee9', to: '#87d068' }"
      />
      <div class="image-progress-text">
        {{ imageProgress.message }}
      </div>
    </div>
    <a-spin
      :spinning="generating || imageGenerating || figmaGenerating || uiPromptAnalyzing"
      class="preview-spin"
    >
      <div class="generator-page__preview-body">
        <div
          v-if="showWaitingCard"
          class="ui-waiting-card"
        >
          <div class="ui-waiting-card__title">
            {{ t("gen.ui.waitingTitle") }}
          </div>
          <div class="ui-waiting-card__hint">
            {{ t("gen.ui.waitingHint") }}
          </div>
          <div class="ui-waiting-card__steps">
            <div
              v-for="step in waitSteps"
              :key="step.key"
              class="ui-waiting-step"
              :class="{
                'ui-waiting-step--active': step.active,
                'ui-waiting-step--done': step.done,
              }"
            >
              <span class="ui-waiting-step__dot" />
              <span>{{ step.label }}</span>
            </div>
          </div>
        </div>
        <a-empty
          v-if="!showWaitingCard && !result && !uiAnalyzedPrompt && !generating && !imageGenerating && !figmaGenerating && !uiPromptAnalyzing"
          :description="t('gen.common.noResult')"
        />
        <template v-else-if="genMode === 'image' && generatedPages.length">
          <div
            v-for="(page, idx) in generatedPages"
            :key="idx"
            class="ui-page-section"
          >
            <div class="ui-page-title">
              <a-typography-title
                :level="5"
                style="margin: 0"
              >
                {{ page.name }}
              </a-typography-title>
              <a-tag color="blue">
                {{ idx + 1 }}/{{ generatedPages.length }}
              </a-tag>
            </div>
            <div class="ui-page-image">
              <img
                :src="fileUrl(page.imagePath)"
                :alt="page.name"
                style="max-width: 100%; border-radius: 6px"
              >
            </div>
            <div class="ui-page-files">
              <a-typography-text
                type="secondary"
                style="font-size: 12px"
              >
                {{ page.imagePath }}
              </a-typography-text>
            </div>
          </div>
          <div
            v-if="generatedImagePaths.length"
            class="ui-saved-files"
          >
            <a-typography-text type="success">
              {{ t('gen.ui.savedTo') }}（{{ generatedPages.length || 1 }} {{ t('gen.ui.pagesCount') }}）
            </a-typography-text>
            <div
              v-for="fp in generatedImagePaths"
              :key="fp"
              class="ui-saved-file"
            >
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
</template>

<style lang="less" scoped>
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

.ui-waiting-card {
  padding: 22px;
  margin-bottom: 16px;
  border: 1px solid var(--app-glass-border);
  border-radius: var(--app-radius-md);
  background: linear-gradient(135deg, rgba(22, 119, 255, 0.08), rgba(135, 208, 104, 0.08));
}

.ui-waiting-card__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--app-text-primary, rgba(0, 0, 0, 0.88));
  margin-bottom: 6px;
}

.ui-waiting-card__hint {
  font-size: 13px;
  color: var(--app-text-secondary, rgba(0, 0, 0, 0.55));
  line-height: 1.6;
}

.ui-waiting-card__steps {
  display: grid;
  gap: 10px;
  margin-top: 18px;
}

.ui-waiting-step {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--app-text-secondary, rgba(0, 0, 0, 0.55));
}

.ui-waiting-step__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--app-border, #d9d9d9);
}

.ui-waiting-step--active {
  color: var(--app-primary, #1677ff);
  font-weight: 500;
}

.ui-waiting-step--active .ui-waiting-step__dot {
  background: var(--app-primary, #1677ff);
  box-shadow: 0 0 0 5px rgba(22, 119, 255, 0.12);
}

.ui-waiting-step--done .ui-waiting-step__dot {
  background: #52c41a;
}
</style>
