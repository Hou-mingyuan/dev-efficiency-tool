<template>
  <div class="page-container ide-manager">
    <a-typography-title :level="4" class="page-title">
      {{ t("ide.title") }}
    </a-typography-title>
    <a-alert
      :message="t('ide.alert')"
      type="info"
      show-icon
      class="ide-alert"
    />
    <a-spin :spinning="loading" :tip="t('common.loading')">
      <a-empty
        v-if="!loading && ideList.length === 0"
        :description="t('ide.emptyHint')"
      />
      <a-list v-else :data-source="ideList" :split="false" class="ide-list">
        <template #renderItem="{ item }">
          <a-list-item class="ide-list-item">
            <a-card :title="item.name" class="ide-card" size="small">
              <div class="ide-row">
                <span class="ide-label">{{ t("ide.detectionStatus") }}</span>
                <a-tag :color="item.detected ? 'success' : 'default'">
                  {{ item.detected ? t("ide.detected") : t("ide.notDetected") }}
                </a-tag>
              </div>
              <div class="ide-row">
                <span class="ide-label">{{ t("ide.installStatus") }}</span>
                <a-tag :color="item.installed ? 'processing' : 'default'">
                  {{ item.installed ? t("ide.installed") : t("ide.notInstalled") }}
                </a-tag>
              </div>
              <div class="ide-actions">
                <a-button
                  type="primary"
                  :loading="installingId === item.id"
                  :disabled="!item.detected"
                  @click="onInstall(item)"
                >
                  {{ t("ide.install") }}
                </a-button>
              </div>
            </a-card>
          </a-list-item>
        </template>
      </a-list>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";

const { t } = useI18n();

interface IdeConfigInfo {
  name: string;
  id: string;
  configPath: string;
  installed: boolean;
  detected: boolean;
}

function isIpcError(v: unknown): v is { __ipcError: true; message: string } {
  return typeof v === "object" && v !== null && (v as { __ipcError?: boolean }).__ipcError === true;
}

const ideList = ref<IdeConfigInfo[]>([]);
const loading = ref(false);
const installingId = ref("");

async function fetchConfigs() {
  const api = window.electronAPI?.mcp;
  if (!api) return;
  loading.value = true;
  try {
    const res = await api.getIdeConfigs();
    if (isIpcError(res)) {
      ideList.value = [];
      return;
    }
    ideList.value = Array.isArray(res) ? (res as IdeConfigInfo[]) : [];
  } finally {
    loading.value = false;
  }
}

async function onInstall(ide: IdeConfigInfo) {
  const api = window.electronAPI?.mcp;
  if (!api) return;
  installingId.value = ide.id;
  try {
    const res = await api.installToIde(ide.id);
    if (isIpcError(res)) {
      message.error(res.message || t("ide.installFailed"));
      return;
    }
    if (res) {
      message.success(t("ide.installSuccess", { name: ide.name }));
      await fetchConfigs();
    } else {
      message.error(t("ide.installFailed"));
    }
  } finally {
    installingId.value = "";
  }
}

onMounted(() => {
  void fetchConfigs();
});
</script>

<style lang="less" scoped>
.page-container {
  padding: 16px 24px;
  box-sizing: border-box;
}

.page-title {
  margin: 0 0 16px !important;
}

.ide-alert {
  margin-bottom: 24px;
}

.ide-list {
  :deep(.ant-list-item) {
    padding: 0 0 16px;
    border: none;
  }
}

.ide-list-item {
  display: block;
}

.ide-card {
  width: 100%;
  min-height: 200px;
}

.ide-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 8px;
}

.ide-label {
  color: var(--app-text-secondary, rgba(0, 0, 0, 0.45));
  font-size: 13px;
}

.ide-actions {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--app-border-secondary, #f0f0f0);
}
</style>
