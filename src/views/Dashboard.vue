<script setup lang="ts">
import { message, Modal } from "ant-design-vue";
import { storeToRefs } from "pinia";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useMcpStore } from "@/store/mcp";
import { useNotificationStore } from "@/store/notification";

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
const mcpStore = useMcpStore();
const notificationStore = useNotificationStore();
const { status, needMcpRestart } = storeToRefs(mcpStore);

const running = computed(() => status.value?.running === true);

const uptimeText = computed(() => {
  const ms = status.value?.uptime ?? 0;
  if (ms <= 0) return t("dashboard.uptimeEmpty");
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}${t("dashboard.uDay")}`);
  if (h > 0) parts.push(`${h}${t("dashboard.uHour")}`);
  if (m > 0) parts.push(`${m}${t("dashboard.uMin")}`);
  if (s > 0 || parts.length === 0) parts.push(`${s}${t("dashboard.uSec")}`);
  return parts.join(" ");
});

function pushNotify(type: "success" | "error" | "warning" | "info", title: string, message: string) {
  notificationStore.addNotification({ type, title, message });
}

async function onStartMcp() {
  const e = window.electronAPI;
  if (!e) {
    return;
  }
  const res = await e.mcp.start();
  if (isIpcError(res)) {
    await mcpStore.fetchStatus();
    pushNotify("error", t("common.error"), t("dashboard.mcpStartFailed") + (res.message ? ` (${res.message})` : ""));
    return;
  }
  await mcpStore.fetchStatus();
  if (status.value?.running) {
    pushNotify("success", t("common.success"), t("dashboard.mcpStarted"));
  } else {
    pushNotify("warning", t("common.warning"), t("dashboard.mcpStartFailed"));
  }
}

function onStopMcp() {
  Modal.confirm({
    title: t("dashboard.stopMcpTitle"),
    content: t("dashboard.stopMcpMessage"),
    okText: t("common.confirm"),
    cancelText: t("common.cancel"),
    async onOk() {
      const e = window.electronAPI;
      if (!e) {
        return;
      }
      const res = await e.mcp.stop();
      if (isIpcError(res)) {
        await mcpStore.fetchStatus();
        pushNotify("error", t("common.error"), t("dashboard.mcpStopFailed") + (res.message ? ` (${res.message})` : ""));
        return;
      }
      await mcpStore.fetchStatus();
      pushNotify("success", t("common.success"), t("dashboard.mcpStopped"));
    },
  });
}

function goSettings() {
  void router.push("/settings");
}

const showProjectModal = ref(false);
const newProject = ref({ name: "", projectPath: "", outputPath: "", methodologyPath: "" });

const projects = computed(() => mcpStore.config.projects ?? []);
const activeProjectId = computed(() => mcpStore.config.activeProjectId ?? "");

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
  const currentProjects = [...(mcpStore.config.projects ?? []), p];
  await mcpStore.setConfig({
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
    await mcpStore.setConfig({ activeProjectId: "" });
    return;
  }
  const proj = projects.value.find((p) => p.id === id);
  if (!proj) return;
  await mcpStore.setConfig({
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
  const filtered = (mcpStore.config.projects ?? []).filter((p) => p.id !== id);
  await mcpStore.setConfig({
    projects: filtered,
    activeProjectId: "",
  });
  message.success(`${t("common.delete")} ${t("common.success")}`);
}

onMounted(() => {
  void mcpStore.fetchConfig();
  mcpStore.startPolling(5000);
});

onUnmounted(() => {
  mcpStore.stopPolling();
});
</script>

<template>
  <div class="page-dashboard">
    <a-space
      direction="vertical"
      :size="16"
      style="width: 100%"
    >
      <a-card
        size="small"
        style="margin-bottom: 16px"
      >
        <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap">
          <span style="font-weight: 500">{{ t('project.current') }}:</span>
          <a-select
            :value="activeProjectId"
            :placeholder="t('project.selectProject')"
            style="min-width: 200px"
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
          <a-button
            type="primary"
            size="small"
            @click="showProjectModal = true"
          >
            {{ t('project.create') }}
          </a-button>
          <a-button
            v-if="activeProjectId"
            size="small"
            danger
            @click="onDeleteProject"
          >
            {{ t('common.delete') }}
          </a-button>
        </div>
      </a-card>
      <a-alert
        v-if="needMcpRestart"
        type="info"
        show-icon
        :message="t('dashboard.restartHint')"
      />
      <a-card :title="t('dashboard.mcpStatus')">
        <a-row :gutter="[16, 16]">
          <a-col
            :xs="24"
            :sm="12"
            :md="6"
          >
            <div class="dash-stat">
              <div class="dash-stat__title">
                {{ t("status.running") }}
              </div>
              <a-tag
                :color="running ? 'success' : 'default'"
              >
                {{ running ? t("status.running") : t("status.stopped") }}
              </a-tag>
            </div>
          </a-col>
          <a-col
            :xs="24"
            :sm="12"
            :md="6"
          >
            <a-statistic
              :title="t('dashboard.pid')"
              :value="status?.pid != null && status?.pid > 0 ? String(status?.pid) : t('common.noData')"
            />
          </a-col>
          <a-col
            :xs="24"
            :sm="12"
            :md="4"
          >
            <a-statistic
              :title="t('dashboard.port')"
              :value="status != null ? String(status.port) : '—'"
            />
          </a-col>
          <a-col
            :xs="24"
            :sm="12"
            :md="4"
          >
            <a-statistic
              :title="t('dashboard.transport')"
              :value="status != null && status.transport ? status.transport : '—'"
            />
          </a-col>
          <a-col
            :xs="24"
            :sm="12"
            :md="6"
          >
            <a-statistic
              :title="t('dashboard.uptime')"
              :value="uptimeText"
            />
          </a-col>
          <a-col
            :xs="24"
            :sm="12"
            :md="4"
          >
            <a-statistic
              :title="t('dashboard.toolCalls')"
              :value="status != null ? status.toolCallCount : 0"
            />
          </a-col>
        </a-row>
      </a-card>
      <a-card :title="t('dashboard.quickActions')">
        <a-space wrap>
          <a-button
            type="primary"
            :disabled="running"
            @click="onStartMcp"
          >
            {{ t("dashboard.startMcp") }}
          </a-button>
          <a-button
            danger
            :disabled="!running"
            @click="onStopMcp"
          >
            {{ t("dashboard.stopMcp") }}
          </a-button>
          <a-divider type="vertical" />
          <a-button @click="goSettings">
            {{ t("dashboard.openSettings") }}
          </a-button>
        </a-space>
      </a-card>
    </a-space>
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
  padding: 0 4px 16px;
}

.dash-stat__title {
  font-size: 14px;
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.45));
  margin-bottom: 4px;
}
</style>
