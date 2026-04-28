<script setup lang="ts">
import { useI18n } from "vue-i18n";

const prompts = defineModel<Record<string, string>>("prompts", { required: true });

const { t } = useI18n();
</script>

<template>
  <a-space
    direction="vertical"
    :size="16"
    style="width: 100%"
  >
    <a-form layout="vertical">
      <a-form-item :label="t('settings.promptPrd')">
        <a-textarea
          v-model:value="prompts.prd"
          :rows="6"
          :placeholder="t('settings.promptPrdPh')"
        />
      </a-form-item>
      <a-form-item :label="t('settings.promptReq')">
        <a-textarea
          v-model:value="prompts.requirements"
          :rows="6"
          :placeholder="t('settings.promptReqPh')"
        />
      </a-form-item>
      <a-form-item :label="t('settings.promptUi')">
        <a-textarea
          v-model:value="prompts.ui"
          :rows="6"
          :placeholder="t('settings.promptUiPh')"
        />
      </a-form-item>
      <a-form-item :label="t('settings.promptDesign')">
        <a-textarea
          v-model:value="prompts.design"
          :rows="6"
          :placeholder="t('settings.promptDesignPh')"
        />
      </a-form-item>
    </a-form>
  </a-space>
</template>
