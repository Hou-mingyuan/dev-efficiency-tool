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
  max-width: 1000px;
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
    font-size: 22px;
    font-weight: 700;
    background: var(--app-primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  &__desc {
    margin: 0;
    font-size: 13px;
    color: var(--app-text-tertiary);
  }
}

.health-overall {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  border-radius: var(--app-radius-lg);
  background: var(--app-glass-bg);
  backdrop-filter: blur(var(--app-glass-blur));
  border: 1px solid;
  margin-bottom: 20px;
  transition: all var(--app-transition);

  &__icon {
    font-size: 36px;
  }
  &__status {
    font-size: 18px;
    font-weight: 700;
  }
  &__hint {
    font-size: 12px;
    color: var(--app-text-tertiary);
    margin-top: 2px;
  }
}

.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

.health-card {
  padding: 20px;
  border-radius: var(--app-radius-lg);
  background: var(--app-glass-bg);
  backdrop-filter: blur(var(--app-glass-blur));
  border: 1px solid var(--app-glass-border);
  transition: all var(--app-transition);

  &:hover {
    border-color: color-mix(in srgb, var(--app-primary) 30%, transparent);
    box-shadow: var(--app-shadow-md);
    transform: translateY(-2px);
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
    color: var(--app-text-tertiary);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
  }

  &__value {
    font-size: 14px;
    font-weight: 600;
    color: var(--app-text);
    word-break: break-all;
  }
}
</style>
