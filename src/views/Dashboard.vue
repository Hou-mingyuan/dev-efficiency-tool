<script setup lang="ts">
import { message, Modal } from "ant-design-vue";
import {
  ProfileOutlined,
  FormOutlined,
  BgColorsOutlined,
  SolutionOutlined,
  RightOutlined,
  PlusOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
} from "@ant-design/icons-vue";
import { storeToRefs } from "pinia";
import { computed, onMounted, ref, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useAppStore } from "@/store/app";

function useCountUp(target: () => number, duration = 600) {
  const display = ref(0);
  let raf = 0;
  watch(target, (to) => {
    cancelAnimationFrame(raf);
    const from = display.value;
    const diff = to - from;
    if (diff === 0) return;
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      display.value = Math.round(from + diff * eased);
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }, { immediate: true });
  return display;
}

function isIpcError(v: unknown): v is IpcErrorResult {
  return (
    typeof v === "object" &&
    v !== null &&
    "__ipcError" in v &&
    (v as IpcErrorResult).__ipcError === true
  );
}

const { t } = useI18n();
const router = useRouter();
const appStore = useAppStore();

const projects = computed(() => appStore.config.projects ?? []);
const activeProjectId = computed(() => appStore.config.activeProjectId ?? "");
const activeProject = computed(() => projects.value.find((p) => p.id === activeProjectId.value));

const showProjectModal = ref(false);
const newProject = ref({ name: "", projectPath: "", outputPath: "", methodologyPath: "" });

const historyList = ref<GenerationRecord[]>([]);
const historyLoading = ref(false);

const docTypes = [
  { key: "prd", icon: ProfileOutlined, route: "/gen/prd" },
  { key: "requirements", icon: FormOutlined, route: "/gen/requirements" },
  { key: "ui", icon: BgColorsOutlined, route: "/gen/ui" },
  { key: "design", icon: SolutionOutlined, route: "/gen/design" },
] as const;

const statsByType = computed(() => {
  const map: Record<string, GenerationRecord[]> = {};
  for (const dt of docTypes) {
    map[dt.key] = historyList.value.filter((r) => r.docType === dt.key);
  }
  return map;
});

const recentHistory = computed(() => {
  return [...historyList.value]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);
});

const totalGenerated = computed(() => historyList.value.length);
const animatedTotal = useCountUp(() => totalGenerated.value);
const animatedStats = Object.fromEntries(
  docTypes.map((dt) => [dt.key, useCountUp(() => statsByType.value[dt.key]?.length ?? 0)])
) as Record<string, ReturnType<typeof useCountUp>>;

async function loadHistory() {
  historyLoading.value = true;
  try {
    const res = await window.electronAPI.ai.getHistory();
    if (isIpcError(res)) {
      message.error(t("common.error"));
      historyList.value = [];
      return;
    }
    historyList.value = Array.isArray(res) ? (res as GenerationRecord[]) : [];
  } catch {
    message.error(t("common.error"));
    historyList.value = [];
  } finally {
    historyLoading.value = false;
  }
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("dash.justNow");
  if (diffMin < 60) return t("dash.minutesAgo", { n: diffMin });
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return t("dash.hoursAgo", { n: diffHour });
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return t("dash.daysAgo", { n: diffDay });
  return d.toLocaleDateString();
}

function docTypeLabel(dt: string): string {
  const labels: Record<string, string> = {
    prd: t("nav.genPrd"),
    requirements: t("nav.genRequirements"),
    ui: t("nav.genUi"),
    design: t("nav.genDesign"),
  };
  return labels[dt] || dt;
}

function goGenerate(route: string) {
  void router.push(route);
}

async function pickDir(field: "projectPath" | "outputPath" | "methodologyPath") {
  const e = window.electronAPI;
  if (!e) return;
  const dir = await e.app.selectDirectory(t("common.selectDir"));
  if (dir && typeof dir === "string") {
    newProject.value[field] = dir;
  }
}

async function onCreateProject() {
  if (!newProject.value.name.trim()) {
    message.warning(t("project.nameRequired"));
    return Promise.reject(new Error("validation"));
  }
  const p: ProjectProfile = {
    id: `proj_${Date.now()}`,
    name: newProject.value.name,
    projectPath: newProject.value.projectPath,
    outputPath: newProject.value.outputPath,
    methodologyPath: newProject.value.methodologyPath,
  };
  const currentProjects = [...(appStore.config.projects ?? []), p];
  await appStore.setConfig({
    projects: currentProjects,
    activeProjectId: p.id,
    projectPath: p.projectPath,
    outputPath: p.outputPath,
    methodologyPath: p.methodologyPath,
  });
  showProjectModal.value = false;
  newProject.value = { name: "", projectPath: "", outputPath: "", methodologyPath: "" };
  message.success(t("project.created"));
}

async function onProjectChange(id: string | null | undefined) {
  if (id == null || id === "") {
    await appStore.setConfig({ activeProjectId: "" });
    return;
  }
  const proj = projects.value.find((p) => p.id === id);
  if (!proj) return;
  await appStore.setConfig({
    activeProjectId: id,
    projectPath: proj.projectPath,
    outputPath: proj.outputPath,
    methodologyPath: proj.methodologyPath,
  });
  message.success(t("project.switched"));
}

async function onDeleteProject() {
  const id = activeProjectId.value;
  if (!id) return;
  Modal.confirm({
    title: t("common.delete"),
    content: t("dash.deleteProjectConfirm"),
    okText: t("common.confirm"),
    cancelText: t("common.cancel"),
    async onOk() {
      const filtered = (appStore.config.projects ?? []).filter((p) => p.id !== id);
      await appStore.setConfig({ projects: filtered, activeProjectId: "" });
      message.success(`${t("common.delete")} ${t("common.success")}`);
    },
  });
}

onMounted(() => {
  void appStore.fetchConfig();
  void loadHistory();
});
</script>

<template>
  <div class="page-dashboard">
    <!-- Project Selector -->
    <div class="dash-project-bar">
      <div class="dash-project-bar__left">
        <FolderOpenOutlined class="dash-project-bar__icon" />
        <span class="dash-project-bar__label">{{ t('project.current') }}</span>
        <a-select
          :value="activeProjectId"
          :placeholder="t('project.selectProject')"
          style="min-width: 220px"
          allow-clear
          @change="onProjectChange"
        >
          <a-select-option
            v-for="p in projects"
            :key="p.id"
            :value="p.id"
          >
            {{ p.name }}
          </a-select-option>
        </a-select>
      </div>
      <div class="dash-project-bar__actions">
        <a-button
          type="primary"
          size="small"
          @click="showProjectModal = true"
        >
          <template #icon><PlusOutlined /></template>
          {{ t('project.create') }}
        </a-button>
        <a-button
          v-if="activeProjectId"
          size="small"
          danger
          @click="onDeleteProject"
        >
          <template #icon><DeleteOutlined /></template>
          {{ t('common.delete') }}
        </a-button>
      </div>
    </div>

    <!-- Stats Overview -->
    <div class="dash-stats-grid">
      <template v-if="historyLoading">
        <div v-for="n in 4" :key="n" class="dash-stat-card dash-stat-card--skeleton">
          <a-skeleton-avatar :size="48" shape="square" active />
          <div style="flex: 1">
            <a-skeleton :paragraph="false" :title="{ width: '60%' }" active />
          </div>
        </div>
      </template>
      <div
        v-else
        v-for="dt in docTypes"
        :key="dt.key"
        class="dash-stat-card"
        @click="goGenerate(dt.route)"
      >
        <div class="dash-stat-card__icon-wrap">
          <component :is="dt.icon" class="dash-stat-card__icon" />
        </div>
        <div class="dash-stat-card__info">
          <div class="dash-stat-card__count">{{ animatedStats[dt.key] }}</div>
          <div class="dash-stat-card__label">{{ docTypeLabel(dt.key) }}</div>
        </div>
        <RightOutlined class="dash-stat-card__arrow" />
      </div>
    </div>

    <!-- Summary Banner -->
    <div class="dash-summary-banner">
      <div class="dash-summary-banner__content">
        <div class="dash-summary-banner__number">{{ animatedTotal }}</div>
        <div class="dash-summary-banner__text">
          <div class="dash-summary-banner__title">{{ t('dash.totalGenerated') }}</div>
          <div class="dash-summary-banner__desc">
            {{ t('dash.totalDesc') }}
            <span v-if="recentHistory.length" class="dash-summary-banner__trend">
              {{ t('dash.recentCount', { n: recentHistory.length }) }}
            </span>
          </div>
        </div>
      </div>
      <div class="dash-summary-banner__actions">
        <a-button type="primary" @click="goGenerate('/gen/prd')">
          {{ t('dash.quickGenerate') }}
        </a-button>
      </div>
    </div>

    <!-- Recent History -->
    <div class="dash-recent">
      <div class="dash-recent__header">
        <HistoryOutlined />
        <span>{{ t('dash.recentHistory') }}</span>
      </div>
      <a-spin :spinning="historyLoading">
        <div v-if="recentHistory.length" class="dash-recent__list">
          <div
            v-for="item in recentHistory"
            :key="item.id"
            class="dash-recent__item"
            @click="goGenerate(docTypes.find(d => d.key === item.docType)?.route ?? '/gen/prd')"
          >
            <div class="dash-recent__item-left">
              <a-tag
                :color="
                  item.docType === 'prd' ? 'blue' :
                  item.docType === 'requirements' ? 'cyan' :
                  item.docType === 'ui' ? 'purple' : 'geekblue'
                "
                class="dash-recent__tag"
              >
                {{ docTypeLabel(item.docType) }}
              </a-tag>
              <span class="dash-recent__preview">{{ item.preview || item.projectName || '—' }}</span>
            </div>
            <span class="dash-recent__time">{{ formatTime(item.createdAt) }}</span>
          </div>
        </div>
        <a-empty v-else :description="t('dash.noHistory')" />
      </a-spin>
    </div>

    <!-- Quick Access -->
    <div class="dash-quick-grid">
      <div
        v-for="dt in docTypes"
        :key="dt.key"
        class="dash-quick-card"
        @click="goGenerate(dt.route)"
      >
        <component :is="dt.icon" class="dash-quick-card__icon" />
        <div class="dash-quick-card__label">{{ docTypeLabel(dt.key) }}</div>
        <div class="dash-quick-card__desc">{{ t(`gen.${dt.key}.description`) }}</div>
        <div class="dash-quick-card__hint">{{ t('dash.clickToGenerate') }}</div>
      </div>
    </div>

    <!-- Create Project Modal -->
    <a-modal
      v-model:open="showProjectModal"
      :title="t('project.createTitle')"
      :ok-text="t('common.confirm')"
      :cancel-text="t('common.cancel')"
      @ok="onCreateProject"
    >
      <a-form layout="vertical">
        <a-form-item :label="t('project.name')">
          <a-input
            v-model:value="newProject.name"
            :placeholder="t('project.namePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="t('settings.projectPath')">
          <a-input-group compact>
            <a-input
              v-model:value="newProject.projectPath"
              style="width: calc(100% - 100px)"
            />
            <a-button @click="pickDir('projectPath')">{{ t('common.selectDir') }}</a-button>
          </a-input-group>
        </a-form-item>
        <a-form-item :label="t('settings.outputPath')">
          <a-input-group compact>
            <a-input
              v-model:value="newProject.outputPath"
              style="width: calc(100% - 100px)"
            />
            <a-button @click="pickDir('outputPath')">{{ t('common.selectDir') }}</a-button>
          </a-input-group>
        </a-form-item>
        <a-form-item :label="t('settings.methodologyPath')">
          <a-input-group compact>
            <a-input
              v-model:value="newProject.methodologyPath"
              style="width: calc(100% - 100px)"
            />
            <a-button @click="pickDir('methodologyPath')">{{ t('common.selectDir') }}</a-button>
          </a-input-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style lang="less" scoped>
.page-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 4px 24px;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dash-project-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-radius: var(--app-radius-lg);
  background: var(--app-glass-bg);
  backdrop-filter: blur(var(--app-glass-blur));
  border: 1px solid var(--app-glass-border);
  flex-wrap: wrap;

  &__left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  &__icon {
    font-size: 18px;
    color: var(--app-primary);
  }
  &__label {
    font-weight: 500;
    color: var(--app-text-secondary);
    white-space: nowrap;
  }
  &__actions {
    display: flex;
    gap: 8px;
  }
}

.dash-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.dash-stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
  border-radius: var(--app-radius-lg);
  background: var(--app-glass-bg);
  backdrop-filter: blur(var(--app-glass-blur));
  border: 1px solid var(--app-glass-border);
  cursor: pointer;
  transition: all var(--app-transition);

  &:hover {
    border-color: color-mix(in srgb, var(--app-primary) 40%, transparent);
    box-shadow: var(--app-shadow-md), 0 0 20px color-mix(in srgb, var(--app-primary) 10%, transparent);
    transform: translateY(-2px);
  }

  &__icon-wrap {
    width: 48px;
    height: 48px;
    border-radius: var(--app-radius-md);
    background: var(--app-primary-gradient);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  &__icon {
    font-size: 22px;
    color: #fff;
  }
  &__info {
    flex: 1;
    min-width: 0;
  }
  &__count {
    font-size: 28px;
    font-weight: 800;
    line-height: 1.1;
    background: var(--app-primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  &__label {
    font-size: 12px;
    color: var(--app-text-tertiary);
    font-weight: 500;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  &__arrow {
    color: var(--app-text-quaternary);
    font-size: 12px;
    transition: transform var(--app-transition);
  }

  &:hover &__arrow {
    transform: translateX(3px);
    color: var(--app-primary);
  }
}

.dash-summary-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px;
  border-radius: var(--app-radius-lg);
  background: var(--app-primary-gradient);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -10%;
    width: 300px;
    height: 300px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
  }
  &::after {
    content: '';
    position: absolute;
    bottom: -40%;
    left: 20%;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.05);
  }

  &__content {
    display: flex;
    align-items: center;
    gap: 20px;
    position: relative;
    z-index: 1;
  }
  &__number {
    font-size: 48px;
    font-weight: 900;
    color: #fff;
    line-height: 1;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  &__text {
    color: rgba(255, 255, 255, 0.95);
  }
  &__title {
    font-size: 16px;
    font-weight: 600;
  }
  &__desc {
    font-size: 13px;
    opacity: 0.8;
    margin-top: 2px;
  }
  &__trend {
    display: inline-block;
    margin-left: 8px;
    padding: 1px 8px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 99px;
    font-size: 11px;
    font-weight: 500;
  }
  &__actions {
    position: relative;
    z-index: 1;

    .ant-btn {
      background: rgba(255, 255, 255, 0.2) !important;
      border-color: rgba(255, 255, 255, 0.3) !important;
      color: #fff !important;
      backdrop-filter: blur(8px);

      &:hover {
        background: rgba(255, 255, 255, 0.3) !important;
      }
    }
  }
}

.dash-recent {
  border-radius: var(--app-radius-lg);
  background: var(--app-glass-bg);
  backdrop-filter: blur(var(--app-glass-blur));
  border: 1px solid var(--app-glass-border);
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px 20px;
    font-size: 15px;
    font-weight: 600;
    color: var(--app-text);
    border-bottom: 1px solid var(--app-border-secondary);
  }

  &__list {
    padding: 4px 0;
  }

  &__item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    cursor: pointer;
    transition: background var(--app-transition);

    &:hover {
      background: var(--app-bg-hover);
    }
  }
  &__item-left {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    flex: 1;
  }
  &__tag {
    flex-shrink: 0;
  }
  &__preview {
    font-size: 13px;
    color: var(--app-text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  &__time {
    font-size: 12px;
    color: var(--app-text-quaternary);
    white-space: nowrap;
    margin-left: 16px;
  }
}

.dash-quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.dash-quick-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 28px 16px;
  border-radius: var(--app-radius-lg);
  background: var(--app-glass-bg);
  backdrop-filter: blur(var(--app-glass-blur));
  border: 1px solid var(--app-glass-border);
  cursor: pointer;
  transition: all var(--app-transition);
  text-align: center;

  &:hover {
    border-color: color-mix(in srgb, var(--app-primary) 40%, transparent);
    box-shadow: var(--app-shadow-md), 0 0 24px color-mix(in srgb, var(--app-primary) 12%, transparent);
    transform: translateY(-3px);
  }

  &__icon {
    font-size: 32px;
    color: var(--app-primary);
    transition: transform var(--app-transition);
  }
  &:hover &__icon {
    transform: scale(1.15);
  }
  &__label {
    font-size: 14px;
    font-weight: 600;
    color: var(--app-text);
  }
  &__desc {
    font-size: 12px;
    color: var(--app-text-tertiary);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  &__hint {
    font-size: 11px;
    color: var(--app-text-quaternary);
  }
}
</style>
