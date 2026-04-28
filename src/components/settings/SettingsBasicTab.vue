<script setup lang="ts">
import { useI18n } from "vue-i18n";

defineProps<{
  clearingCaches: boolean;
}>();

const draft = defineModel<AppConfig>("draft", { required: true });

defineEmits<{
  selectDir: [field: "methodologyPath" | "projectPath" | "outputPath" | "cachePath"];
  clearAllCaches: [];
}>();

const { t } = useI18n();
</script>

<template>
  <a-space
    direction="vertical"
    :size="12"
    style="width: 100%"
    align="start"
  >
    <a-form
      layout="vertical"
      class="settings-form"
    >
      <a-form-item :label="t('settings.methodologyPath')">
        <a-input-group compact>
          <a-input
            v-model:value="draft.methodologyPath"
            style="width: calc(100% - 88px)"
            :placeholder="t('settings.methodologyPathPlaceholder')"
          />
          <a-button @click="$emit('selectDir', 'methodologyPath')">
            {{ t("common.selectDir") }}
          </a-button>
        </a-input-group>
      </a-form-item>
      <a-form-item :label="t('settings.projectPath')">
        <a-input-group compact>
          <a-input
            v-model:value="draft.projectPath"
            style="width: calc(100% - 88px)"
            :placeholder="t('settings.projectPath')"
          />
          <a-button @click="$emit('selectDir', 'projectPath')">
            {{ t("common.selectDir") }}
          </a-button>
        </a-input-group>
      </a-form-item>
      <a-form-item :label="t('settings.outputPath')">
        <a-input-group compact>
          <a-input
            v-model:value="draft.outputPath"
            style="width: calc(100% - 88px)"
            :placeholder="t('settings.outputPath')"
          />
          <a-button @click="$emit('selectDir', 'outputPath')">
            {{ t("common.selectDir") }}
          </a-button>
        </a-input-group>
      </a-form-item>
      <a-form-item :label="t('settings.cachePath')">
        <a-input-group compact>
          <a-input
            v-model:value="draft.cachePath"
            style="width: calc(100% - 88px)"
            :placeholder="t('settings.cachePathPlaceholder')"
          />
          <a-button @click="$emit('selectDir', 'cachePath')">
            {{ t("common.selectDir") }}
          </a-button>
        </a-input-group>
      </a-form-item>
      <a-form-item>
        <a-popconfirm
          :title="t('settings.clearAllCachesConfirm')"
          :ok-text="t('common.confirm')"
          :cancel-text="t('common.cancel')"
          @confirm="$emit('clearAllCaches')"
        >
          <a-button
            danger
            :loading="clearingCaches"
          >
          {{ t("settings.clearAllCaches") }}
        </a-button>
      </a-popconfirm>
      </a-form-item>
      <a-divider orientation="left">
        {{ t("settings.figmaConnector") }}
      </a-divider>
      <a-form-item :label="t('settings.figmaEnabled')" :extra="t('settings.figmaHint')">
        <a-switch
          v-model:checked="draft.figmaConnector.enabled"
          :checked-children="t('common.confirm')"
          :un-checked-children="t('common.cancel')"
        />
      </a-form-item>
      <a-form-item :label="t('settings.figmaFileName')">
        <a-input
          v-model:value="draft.figmaConnector.defaultFileName"
          :placeholder="t('settings.figmaFileNamePlaceholder')"
          allow-clear
        />
      </a-form-item>
    </a-form>
  </a-space>
</template>

<style lang="less" scoped>
.settings-form {
  max-width: 640px;
}
</style>
