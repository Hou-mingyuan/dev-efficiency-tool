<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";
import {
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  DesktopOutlined,
  CloudServerOutlined,
  HddOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons-vue";

const { t } = useI18n();

interface HealthResult {
  nodeVersion: string;
  electronVersion: string;
  entryExists: boolean;
  methodologyFileCount: number;
  platform: string;
  arch: string;
  memory: { total: number; free: number };
}

function isIpcError(v: unknown): v is { __ipcError: true; message: string } {
  return typeof v === "object" && v !== null && (v as { __ipcError?: boolean }).__ipcError === true;
}

const result = ref<HealthResult | null>(null);
const running = ref(false);

const memoryPercent = computed(() => {
  if (!result.value) return 0;
  const { free, total } = result.value.memory;
  if (total <= 0) return 0;
  return Math.round(((total - free) / total) * 100);
});

const memoryStatus = computed(() => {
  const p = memoryPercent.value;
  if (p > 90) return "error";
  if (p > 80) return "warning";
  return "success";
});

type Overall = "success" | "warning" | "error";

const overallLevel = computed((): Overall | null => {
  if (!result.value) return null;
  const r = result.value;
  if (!r.entryExists) return "error";
  if (r.methodologyFileCount === 0) return "warning";
  return "success";
});

const overallColor = computed(() => {
  const o = overallLevel.value;
  if (o === "success") return "#10b981";
  if (o === "warning") return "#f59e0b";
  if (o === "error") return "#ef4444";
  return "var(--app-muted)";
});

const overallStatusText = computed(() => {
  const o = overallLevel.value;
  if (o === "success") return t("health.statusGood");
  if (o === "warning") return t("health.statusWarning");
  if (o === "error") return t("health.statusError");
  return t("health.checking");
});

const healthItems = computed(() => {
  if (!result.value) return [];
  const r = result.value;
  return [
    {
      icon: DesktopOutlined,
      label: t("health.platform"),
      value: `${r.platform} / ${r.arch}`,
      status: "success" as const,
    },
    {
      icon: CloudServerOutlined,
      label: t("health.nodeVersion"),
      value: r.nodeVersion,
      status: "success" as const,
    },
    {
      icon: ThunderboltOutlined,
      label: t("health.electronVersion"),
      value: r.electronVersion,
      status: "success" as const,
    },
    {
      icon: HddOutlined,
      label: t("health.memory"),
      value: t("health.memoryFormat", { free: r.memory.free, total: r.memory.total }),
      status: memoryStatus.value as "success" | "warning" | "error",
    },
    {
      icon: FileTextOutlined,
      label: t("health.docCount"),
      value: String(r.methodologyFileCount),
      status: (r.methodologyFileCount > 0 ? "success" : "warning") as "success" | "warning",
    },
  ];
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

onMounted(() => {
  runCheck();
});
</script>

<template>
  <div class="page-health">
    <div class="health-header">
      <div class="health-header__text">
        <h2 class="health-header__title">{{ t("health.title") }}</h2>
        <p class="health-header__desc">{{ t("health.emptyHint") }}</p>
      </div>
      <a-button type="primary" :loading="running" size="large" @click="runCheck">
        {{ t("health.runCheck") }}
      </a-button>
    </div>

    <!-- Memory Progress -->
    <div v-if="result" class="health-memory-bar">
      <div class="health-memory-bar__label">
        <span>{{ t("health.memory") }}</span>
        <span :style="{ color: overallColor }">{{ memoryPercent }}%</span>
      </div>
      <a-progress
        :percent="memoryPercent"
        :stroke-color="memoryStatus === 'success' ? '#10b981' : memoryStatus === 'warning' ? '#f59e0b' : '#ef4444'"
        :show-info="false"
        size="small"
      />
    </div>

    <!-- Overall Status -->
    <div v-if="result" class="health-overall" :style="{ borderColor: overallColor }">
      <div class="health-overall__icon" :style="{ color: overallColor }">
        <CheckCircleOutlined v-if="overallLevel === 'success'" />
        <WarningOutlined v-else-if="overallLevel === 'warning'" />
        <CloseCircleOutlined v-else />
      </div>
      <div class="health-overall__info">
        <div class="health-overall__status" :style="{ color: overallColor }">{{ overallStatusText }}</div>
        <div class="health-overall__hint">{{ t("health.title") }}</div>
      </div>
    </div>

    <a-spin :spinning="running" :tip="t('health.checking')">
      <a-empty v-if="!result && !running" :description="t('health.emptyHint')" />
      <div v-if="result" class="health-grid">
        <div
          v-for="(item, idx) in healthItems"
          :key="idx"
          class="health-card"
        >
          <div class="health-card__top">
            <div class="health-card__icon-wrap" :class="`health-card__icon-wrap--${item.status}`">
              <component :is="item.icon" />
            </div>
            <div
              class="health-card__dot"
              :class="`health-card__dot--${item.status}`"
            />
          </div>
          <div class="health-card__label">{{ item.label }}</div>
          <div class="health-card__value">{{ item.value }}</div>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<style lang="less" scoped>
.page-health {
  max-width: 1120px;
  margin: 0 auto;
  padding: 0 4px 24px;
  position: relative;
  z-index: 1;
}

.health-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 16px;

  &__text {
    flex: 1;
  }
  &__title {
    margin: 0 0 4px;
    font-family: var(--app-font-display);
    font-size: clamp(34px, 4vw, 52px);
    line-height: 1;
    font-weight: 950;
    letter-spacing: -0.065em;
    color: rgba(248, 250, 252, 0.94);
    text-shadow: 0 0 30px color-mix(in srgb, var(--app-primary) 16%, transparent);
  }
  &__desc {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: rgba(203, 213, 225, 0.72);
  }
}

.health-overall {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  border-radius: 0;
  background:
    radial-gradient(circle at 10% 20%, rgba(96, 165, 250, 0.12), transparent 32%),
    linear-gradient(90deg, rgba(216, 255, 122, 0.035), transparent 58%),
    rgba(4, 8, 14, 0.16);
  backdrop-filter: none;
  border: 0 !important;
  margin-bottom: 20px;
  transition: all var(--app-transition);

  &__icon {
    font-size: 36px;
  }
  &__status {
    font-family: var(--app-font-display);
    font-size: 18px;
    font-weight: 950;
    letter-spacing: -0.02em;
  }
  &__hint {
    font-size: 12px;
    color: rgba(203, 213, 225, 0.74);
    margin-top: 2px;
  }
}

.health-memory-bar {
  padding: 16px 24px;
  border-radius: 0;
  background:
    linear-gradient(90deg, rgba(96, 165, 250, 0.06), transparent 70%),
    rgba(4, 8, 14, 0.14);
  backdrop-filter: none;
  border: 0;
  margin-bottom: 20px;

  &__label {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    font-family: var(--app-font-mono);
    font-weight: 800;
    letter-spacing: 0.04em;
    margin-bottom: 8px;
    color: var(--app-text);
  }
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.health-card {
  padding: 20px;
  border-radius: 0;
  background:
    linear-gradient(135deg, rgba(96, 165, 250, 0.05), transparent 42%),
    rgba(4, 8, 14, 0.18);
  backdrop-filter: none;
  border: 0;
  transition: all var(--app-transition);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(90deg, rgba(96, 165, 250, 0.18), transparent 56%);
    height: 1px;
    opacity: 0;
    transition: opacity var(--app-transition);
  }

  &:hover {
    box-shadow: 0 0 28px color-mix(in srgb, var(--app-primary) 10%, transparent);
    transform: translateY(-2px);

    &::before {
      opacity: 1;
    }
  }

  &__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  &__icon-wrap {
    width: 40px;
    height: 40px;
    border-radius: var(--app-radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;

    &--success {
      background: rgba(16, 185, 129, 0.12);
      color: #10b981;
    }
    &--warning {
      background: rgba(245, 158, 11, 0.12);
      color: #f59e0b;
    }
    &--error {
      background: rgba(239, 68, 68, 0.12);
      color: #ef4444;
    }
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;

    &--success { background: #10b981; }
    &--warning { background: #f59e0b; }
    &--error { background: #ef4444; }
  }

  &__label {
    font-size: 12px;
    color: rgba(203, 213, 225, 0.74);
    font-family: var(--app-font-mono);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
  }

  &__value {
    font-size: 14px;
    font-weight: 800;
    color: rgba(248, 250, 252, 0.92);
    word-break: break-all;
  }
}
</style>
