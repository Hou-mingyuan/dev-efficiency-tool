<script setup lang="ts">
import { useI18n } from "vue-i18n";

const providers = defineModel<AiProvider[]>("providers", { required: true });
const activeKey = defineModel<string | string[]>("activeKey", { required: true });

defineProps<{
  builtInIds: string[];
  testingId: string | null;
  modelOptionsMap: Record<string, string[]>;
  modelLoadingId: string | null;
  filterModelOption: (inputValue: string, option: { value: string }) => boolean;
}>();

defineEmits<{
  addCustom: [];
  collapseChange: [key: string | string[]];
  fetchModels: [provider: AiProvider];
  testProvider: [provider: AiProvider];
  moveProvider: [index: number, direction: -1 | 1];
  removeProvider: [index: number];
  clearModels: [providerId: string];
}>();

const { t } = useI18n();
</script>

<template>
  <a-space
    direction="vertical"
    :size="12"
    style="width: 100%"
  >
    <a-button
      type="dashed"
      block
      @click="$emit('addCustom')"
    >
      {{ t("settings.addCustom") }}
    </a-button>
    <a-collapse
      v-model:activeKey="activeKey"
      @change="$emit('collapseChange', $event as string | string[])"
    >
      <a-collapse-panel
        v-for="(p, idx) in providers"
        :key="p.id"
        :header="p.name"
      >
        <a-space
          direction="vertical"
          :size="8"
          style="width: 100%"
        >
          <a-space>
            <span>{{ t("settings.providerName") }}:</span>
            <a-input
              v-model:value="p.name"
              style="min-width: 200px"
            />
            <span>{{ t("settings.providerEnabled") }}</span>
            <a-switch v-model:checked="p.enabled" />
          </a-space>
          <a-form-item
            :label="t('settings.apiKey')"
            class="form-item-embed"
          >
            <a-input-password
              v-model:value="p.apiKey"
              autocomplete="off"
            />
            <div
              v-if="p.apiKey"
              class="api-key-strength"
            >
              <span
                class="api-key-strength__dot"
                :class="p.apiKey.length >= 20 ? 'api-key-strength__dot--strong' : 'api-key-strength__dot--weak'"
              />
              <span class="api-key-strength__label">
                {{ p.apiKey.length >= 20 ? t('settings.keyStrong') : t('settings.keyWeak') }}
              </span>
            </div>
          </a-form-item>
          <a-form-item
            :label="t('settings.baseUrl')"
            class="form-item-embed"
          >
            <a-input v-model:value="p.baseUrl" />
          </a-form-item>
          <a-form-item
            :label="t('settings.model')"
            class="form-item-embed"
          >
            <a-auto-complete
              v-model:value="p.model"
              :options="(modelOptionsMap[p.id] || []).map((m: string) => ({ value: m, label: m }))"
              :placeholder="t('settings.model')"
              allow-clear
              :filter-option="filterModelOption"
              style="width: 100%"
            />
            <a-button
              v-if="p.apiKey?.trim()"
              size="small"
              type="link"
              :loading="modelLoadingId === p.id"
              style="padding: 0; margin-top: 4px"
              @click="$emit('clearModels', p.id); $emit('fetchModels', p)"
            >
              {{ modelLoadingId === p.id ? t('settings.testing') : t("settings.refreshModels") }}
            </a-button>
          </a-form-item>
          <a-space wrap>
            <a-button
              type="primary"
              :loading="testingId === p.id"
              @click="$emit('testProvider', p)"
            >
              {{ t("settings.testConnection") }}
            </a-button>
            <a-button
              :disabled="idx === 0"
              @click="$emit('moveProvider', idx, -1)"
            >
              {{ t("settings.moveUp") }}
            </a-button>
            <a-button
              :disabled="idx === providers.length - 1"
              @click="$emit('moveProvider', idx, 1)"
            >
              {{ t("settings.moveDown") }}
            </a-button>
            <a-popconfirm
              v-if="!builtInIds.includes(p.id)"
              :title="t('settings.deleteProviderConfirm')"
              :ok-text="t('common.confirm')"
              :cancel-text="t('common.cancel')"
              @confirm="$emit('removeProvider', idx)"
            >
              <a-button danger>
                {{ t("common.delete") }}
              </a-button>
            </a-popconfirm>
          </a-space>
        </a-space>
      </a-collapse-panel>
    </a-collapse>
  </a-space>
</template>

<style lang="less" scoped>
.form-item-embed {
  margin-bottom: 0;
  width: 100%;
}

.api-key-strength {
  margin-top: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--app-text-secondary);
  font-size: 12px;

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  &__dot--strong {
    background: #52c41a;
  }

  &__dot--weak {
    background: #faad14;
  }
}
</style>
