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
  SearchOutlined,
  ExportOutlined,
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
const historySearch = ref("");

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
  let list = [...historyList.value]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (historySearch.value.trim()) {
    const q = historySearch.value.toLowerCase();
    list = list.filter((r) =>
      (r.preview || "").toLowerCase().includes(q) ||
      (r.projectName || "").toLowerCase().includes(q) ||
      (r.docType || "").toLowerCase().includes(q),
    );
  }
  return list.slice(0, 20);
});

const totalGenerated = computed(() => historyList.value.length);
const animatedTotal = useCountUp(() => totalGenerated.value);
const animatedStats = Object.fromEntries(
  docTypes.map((dt) => [dt.key, useCountUp(() => statsByType.value[dt.key]?.length ?? 0)])
) as Record<string, ReturnType<typeof useCountUp>>;
const enabledProviderCount = computed(() => (appStore.config.aiProviders ?? []).filter((p) => p.enabled).length);
const activeProjectLabel = computed(() => activeProject.value?.name || t("project.selectProject"));
const latestRecordLabel = computed(() => recentHistory.value[0]?.projectName || recentHistory.value[0]?.docType || "—");
const cockpitMetrics = computed(() => [
  { label: t("dash.totalGenerated"), value: animatedTotal.value, sub: t("dash.totalDesc") },
  { label: t("dash.activeProject"), value: activeProjectLabel.value, sub: t("dash.projectContext") },
  { label: t("dash.enabledModels"), value: enabledProviderCount.value, sub: t("dash.modelRouting") },
  { label: t("dash.latestOutput"), value: latestRecordLabel.value, sub: t("dash.recentHistory") },
]);

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

async function deleteHistoryItem(e: Event, id: string) {
  e.stopPropagation();
  try {
    await window.electronAPI.ai.deleteHistory(id);
    historyList.value = historyList.value.filter((r) => r.id !== id);
    message.success(`${t("common.delete")} ${t("common.success")}`);
  } catch {
    message.error(t("common.error"));
  }
}

async function exportHistory() {
  const data = JSON.stringify(historyList.value, null, 2);
  await navigator.clipboard.writeText(data);
  message.success(t("common.copied"));
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

function normalizeSelectId(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "value" in value) {
    return normalizeSelectId((value as { value: unknown }).value);
  }
  return "";
}

async function onProjectChange(id: unknown) {
  const projectId = normalizeSelectId(id);
  if (!projectId) {
    await appStore.setConfig({ activeProjectId: "" });
    return;
  }
  const proj = projects.value.find((p) => p.id === projectId);
  if (!proj) return;
  await appStore.setConfig({
    activeProjectId: projectId,
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
    <section class="dash-hero">
      <div class="dash-hero__code" aria-hidden="true">
        AI_GENERATION_PIPELINE / PROJECT_CONTEXT / REQUEST_ID_ISOLATION / PACK_READY
      </div>
      <div class="dash-hero__scan" aria-hidden="true" />
      <div class="dash-hero__content">
        <div class="dash-hero__kicker">
          <span class="dash-hero__pulse" />
          {{ t("dash.cockpitKicker") }}
        </div>
        <h1>{{ t("dash.cockpitTitle") }}</h1>
        <p>{{ t("dash.cockpitDesc") }}</p>
      </div>
      <div class="dash-cockpit-grid">
        <div
          v-for="metric in cockpitMetrics"
          :key="metric.label"
          class="dash-cockpit-card"
        >
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.sub }}</small>
        </div>
      </div>
    </section>

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
        <div class="dash-recent__header-left">
          <HistoryOutlined />
          <span>{{ t('dash.recentHistory') }}</span>
        </div>
        <div class="dash-recent__header-right">
          <a-input-search
            v-model:value="historySearch"
            :placeholder="t('common.search')"
            size="small"
            style="width: 180px"
            allow-clear
          />
          <a-tooltip :title="t('common.export')">
            <a-button type="text" size="small" @click="exportHistory">
              <template #icon><ExportOutlined /></template>
            </a-button>
          </a-tooltip>
        </div>
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
            <div class="dash-recent__item-right">
              <span class="dash-recent__time">{{ formatTime(item.createdAt) }}</span>
              <a-popconfirm
                :title="t('dash.deleteProjectConfirm')"
                :ok-text="t('common.confirm')"
                :cancel-text="t('common.cancel')"
                @confirm="deleteHistoryItem($event, item.id)"
              >
                <a-button
                  type="text"
                  size="small"
                  danger
                  class="dash-recent__delete"
                  @click.stop
                >
                  <template #icon><DeleteOutlined /></template>
                </a-button>
              </a-popconfirm>
            </div>
          </div>
        </div>
        <a-empty v-else :description="historySearch ? t('globalSearch.noResults') : t('dash.noHistory')" />
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
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 4px 28px;
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dash-hero {
  position: relative;
  overflow: hidden;
  min-height: 260px;
  padding: clamp(24px, 4vw, 42px);
  border: 0;
  background:
    radial-gradient(circle at 78% 12%, rgba(216, 255, 122, 0.14), transparent 18%),
    radial-gradient(circle at 16% 8%, rgba(59, 130, 246, 0.16), transparent 30%),
    linear-gradient(135deg, rgba(5, 7, 11, 0.34), rgba(8, 13, 20, 0.2) 48%, rgba(2, 3, 4, 0.28));
  color: #f8fafc;
  box-shadow: none;

  &::before,
  &::after {
    content: "";
    position: absolute;
    pointer-events: none;
  }

  &::before {
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
    background-size: 44px 44px;
    mask-image: linear-gradient(90deg, rgba(0, 0, 0, 0.95), transparent 78%);
    animation: dashGridDrift 18s linear infinite;
  }

  &::after {
    width: 260px;
    height: 260px;
    right: 9%;
    top: -40px;
    border-radius: 50%;
    background: radial-gradient(circle at 38% 35%, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.08) 44%, transparent 70%);
    filter: blur(1px);
    opacity: 0.7;
    animation: dashMoonFloat 8s ease-in-out infinite alternate;
  }
}

@keyframes dashGridDrift {
  from { background-position: 0 0, 0 0; }
  to { background-position: 88px 44px, 88px 44px; }
}

@keyframes dashMoonFloat {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(18px, 12px, 0) scale(1.04); }
}

.dash-hero__code {
  position: absolute;
  left: -8%;
  right: -8%;
  top: 18px;
  color: rgba(255, 255, 255, 0.09);
  font-family: var(--app-font-mono);
  font-size: clamp(14px, 1.6vw, 22px);
  letter-spacing: 0.14em;
  white-space: nowrap;
  animation: dashCodeMarquee 15s linear infinite alternate;
}

@keyframes dashCodeMarquee {
  from { transform: translateX(-3%); }
  to { transform: translateX(9%); }
}

.dash-hero__scan {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, transparent 0%, rgba(216, 255, 122, 0.1) 48%, transparent 52%);
  opacity: 0.65;
  transform: translateY(-100%);
  animation: dashScan 5.5s ease-in-out infinite;
}

@keyframes dashScan {
  0%, 30% { transform: translateY(-100%); }
  55%, 100% { transform: translateY(100%); }
}

.dash-hero__content {
  position: relative;
  z-index: 1;
  max-width: 680px;

  h1 {
    margin: 0 0 14px;
    color: #fff;
    font-family: var(--app-font-display);
    font-size: clamp(38px, 5.8vw, 78px);
    font-weight: 950;
    line-height: 0.98;
    letter-spacing: -0.07em;
    text-shadow: 0 0 34px rgba(96, 165, 250, 0.16);
  }

  p {
    max-width: 560px;
    margin: 0;
    color: rgba(203, 213, 225, 0.76);
    font-weight: 600;
    letter-spacing: 0.015em;
    line-height: 1.7;
  }
}

.dash-hero__kicker {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  color: rgba(216, 255, 122, 0.9);
  font-family: var(--app-font-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.dash-hero__pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d8ff7a;
  box-shadow: 0 0 24px rgba(216, 255, 122, 0.86);
  animation: dashPulse 1.6s ease-in-out infinite;
}

@keyframes dashPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.8); opacity: 0.45; }
}

.dash-cockpit-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-top: 38px;
}

.dash-cockpit-card {
  position: relative;
  overflow: hidden;
  min-height: 112px;
  padding: 16px;
  border: 0;
  background: rgba(255, 255, 255, 0.018);
  transition: transform 0.25s ease, border-color 0.25s ease, background 0.25s ease;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(120deg, transparent, rgba(216, 255, 122, 0.18), transparent);
    transform: translateX(-120%);
    transition: transform 0.6s ease;
  }

  &:hover {
    transform: translateY(-4px);
    background: rgba(216, 255, 122, 0.035);
  }

  &:hover::before {
    transform: translateX(120%);
  }

  span,
  small {
    display: block;
    color: rgba(226, 232, 240, 0.58);
    font-size: 12px;
    font-family: var(--app-font-mono);
    font-weight: 700;
    letter-spacing: 0.04em;
    position: relative;
    z-index: 1;
  }

  strong {
    display: block;
    margin: 10px 0 8px;
    color: #fff;
    font-family: var(--app-font-display);
    font-weight: 950;
    font-size: clamp(24px, 3vw, 42px);
    line-height: 1.05;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    position: relative;
    z-index: 1;
  }
}

.dash-project-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 20px;
  border-radius: 0;
  background: rgba(4, 8, 14, 0.22);
  backdrop-filter: none;
  border: 0;
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
    letter-spacing: 0.02em;
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
  border-radius: 0;
  background: rgba(4, 8, 14, 0.32);
  backdrop-filter: none;
  border: 0;
  cursor: pointer;
  transition: all var(--app-transition);

  &:hover {
    box-shadow: 0 0 28px color-mix(in srgb, var(--app-primary) 10%, transparent);
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
    font-family: var(--app-font-display);
    font-size: 28px;
    font-weight: 950;
    line-height: 1.1;
    background: var(--app-primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  &__label {
    font-size: 12px;
    color: rgba(203, 213, 225, 0.78);
    font-weight: 700;
    letter-spacing: 0.02em;
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
  border-radius: 0;
  background:
    linear-gradient(135deg, rgba(216, 255, 122, 0.14), rgba(59, 130, 246, 0.12)),
    rgba(5, 7, 11, 0.16);
  border: 0;
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
    font-family: var(--app-font-display);
    font-size: 48px;
    font-weight: 950;
    color: #fff;
    line-height: 1;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  &__text {
    color: rgba(255, 255, 255, 0.95);
  }
  &__title {
    font-size: 16px;
    font-weight: 850;
    letter-spacing: 0.01em;
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
  border-radius: 0;
  background: rgba(4, 8, 14, 0.2);
  backdrop-filter: none;
  border: 0;
  overflow: hidden;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    font-size: 15px;
    font-family: var(--app-font-display);
    font-weight: 900;
    letter-spacing: -0.02em;
    color: var(--app-text);
    border-bottom: 0;
  }
  &__header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  &__header-right {
    display: flex;
    align-items: center;
    gap: 6px;
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
      background: rgba(148, 163, 184, 0.07);
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
    color: rgba(203, 213, 225, 0.78);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  &__item-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  &__time {
    font-size: 12px;
    color: rgba(148, 163, 184, 0.76);
    white-space: nowrap;
  }
  &__delete {
    opacity: 0;
    transition: opacity var(--app-transition);
  }
  &__item:hover &__delete {
    opacity: 1;
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
  border-radius: 0;
  background: rgba(4, 8, 14, 0.32);
  backdrop-filter: none;
  border: 0;
  cursor: pointer;
  transition: all var(--app-transition);
  text-align: center;

  &:hover {
    box-shadow: 0 0 28px color-mix(in srgb, var(--app-primary) 10%, transparent);
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
    font-weight: 850;
    letter-spacing: 0.01em;
    color: var(--app-text);
  }
  &__desc {
    font-size: 12px;
    color: rgba(203, 213, 225, 0.76);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  &__hint {
    font-size: 11px;
    color: rgba(148, 163, 184, 0.76);
  }
}

@media (max-width: 980px) {
  .dash-cockpit-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .dash-hero {
    padding: 24px;
  }

  .dash-cockpit-grid {
    grid-template-columns: 1fr;
  }
}
</style>
