<template>
  <div class="page-container health-check">
    <a-typography-title :level="4" class="page-title">
      {{ t("health.title") }}
    </a-typography-title>
    <div class="toolbar">
      <a-button type="primary" :loading="running" @click="runCheck">
        {{ t("health.runCheck") }}
      </a-button>
      <a-tag v-if="result" :color="overallColor">
        {{ overallStatusText }}
      </a-tag>
    </div>
    <a-spin :spinning="running" :tip="t('health.checking')">
      <a-empty
        v-if="!result && !running"
        :description="t('health.emptyHint')"
        class="health-empty"
      >
        <a-button type="primary" @click="runCheck">
          {{ t("health.runCheck") }}
        </a-button>
      </a-empty>
      <a-descriptions
        v-if="result"
        bordered
        :column="1"
        size="middle"
        class="health-desc"
      >
        <a-descriptions-item :label="t('health.nodeVersion')">
          <a-tag color="blue">{{ result.nodeVersion }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item :label="t('health.electronVersion')">
          <a-tag color="blue">{{ result.electronVersion }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item :label="t('health.platform')">
          <a-tag color="geekblue">{{ result.platform }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item :label="t('health.arch')">
          <a-tag color="geekblue">{{ result.arch }}</a-tag>
        </a-descriptions-item>
        <a-descriptions-item :label="t('health.memory')">
          <a-tag :color="memoryTagColor">
            {{ t("health.memoryFormat", { free: result.memory.free, total: result.memory.total }) }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item :label="t('health.methodologyPath')">
          <code class="path-text">{{ result.methodologyPath || "—" }}</code>
        </a-descriptions-item>
        <a-descriptions-item :label="t('health.entryExists')">
          <a-tag :color="result.entryExists ? 'success' : 'error'">
            {{ result.entryExists ? t("health.yes") : t("health.no") }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item :label="t('health.docCount')">
          <a-tag :color="docCountColor">
            {{ result.methodologyFileCount }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item :label="t('health.portAvailable')">
          <a-tag :color="result.portAvailable ? 'success' : 'error'">
            {{ result.portAvailable ? t("health.available") : t("health.unavailable") }}
          </a-tag>
        </a-descriptions-item>
      </a-descriptions>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";

const { t } = useI18n();

interface HealthResult {
  nodeVersion: string;
  electronVersion: string;
  methodologyPath: string;
  entryExists: boolean;
  methodologyFileCount: number;
  portAvailable: boolean;
  platform: string;
  arch: string;
  memory: { total: number; free: number };
}

function isIpcError(v: unknown): v is { __ipcError: true; message: string } {
  return typeof v === "object" && v !== null && (v as { __ipcError?: boolean }).__ipcError === true;
}

const result = ref<HealthResult | null>(null);
const running = ref(false);

const memoryTagColor = computed(() => {
  if (!result.value) return "default";
  const { free, total } = result.value.memory;
  if (total <= 0) return "default";
  const ratio = free / total;
  if (ratio < 0.1) return "red";
  if (ratio < 0.2) return "warning";
  return "success";
});

const docCountColor = computed(() => {
  if (!result.value) return "default";
  if (result.value.methodologyFileCount === 0) return "warning";
  return "success";
});

type Overall = "success" | "warning" | "error";

const overallLevel = computed((): Overall | null => {
  if (!result.value) return null;
  const r = result.value;
  if (!r.entryExists) return "error";
  if (!r.portAvailable || r.methodologyFileCount === 0) return "warning";
  return "success";
});

const overallColor = computed(() => {
  const o = overallLevel.value;
  if (o === "success") return "success";
  if (o === "warning") return "warning";
  if (o === "error") return "error";
  return "default";
});

const overallStatusText = computed(() => {
  const o = overallLevel.value;
  if (o === "success") return t("health.statusGood");
  if (o === "warning") return t("health.statusWarning");
  if (o === "error") return t("health.statusError");
  return t("health.checking");
});

async function runCheck() {
  const api = window.electronAPI?.app;
  if (!api) return;
  running.value = true;
  try {
    const res = await api.healthCheck();
    if (isIpcError(res)) {
      message.error(res.message || t("common.error"));
      result.value = null;
      return;
    }
    result.value = res as HealthResult;
  } catch {
    message.error(t("common.error"));
    result.value = null;
  } finally {
    running.value = false;
  }
}
</script>

<style lang="less" scoped>
.page-container {
  padding: 16px 24px;
  box-sizing: border-box;
}

.page-title {
  margin: 0 0 16px !important;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.health-desc {
  max-width: 800px;
}

.path-text {
  display: block;
  word-break: break-all;
  font-size: 12px;
  background: var(--ant-color-bg-layout, #f5f5f5);
  padding: 4px 8px;
  border-radius: 4px;
}
</style>
