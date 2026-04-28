<script setup lang="ts">
import { useI18n } from "vue-i18n";

interface HistoryRow {
  id: string;
  docType: string;
  projectName: string;
  createdAt: string;
  preview: string;
  outputPath?: string;
}

defineProps<{
  open: boolean;
  loading: boolean;
  rows: HistoryRow[];
  formatTime: (value: string) => string;
}>();

defineEmits<{
  "update:open": [value: boolean];
  afterOpenChange: [value: boolean];
  load: [item: HistoryRow];
}>();

const { t } = useI18n();
</script>

<template>
  <a-drawer
    :open="open"
    :title="t('gen.common.history')"
    placement="right"
    width="420"
    @update:open="$emit('update:open', $event)"
    @after-open-change="$emit('afterOpenChange', $event)"
  >
    <a-spin :spinning="loading">
      <a-empty
        v-if="!rows.length && !loading"
        :description="t('gen.common.historyEmpty')"
      />
      <a-list
        v-else
        :data-source="rows"
        item-layout="vertical"
      >
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta
              :title="item.projectName || '—'"
              :description="formatTime(item.createdAt)"
            />
            <p class="history-preview">
              {{ item.preview }}
            </p>
            <a-button
              size="small"
              type="link"
              :disabled="!item.outputPath"
              @click="$emit('load', item)"
            >
              {{ t("gen.common.loadHistory") }}
            </a-button>
          </a-list-item>
        </template>
      </a-list>
    </a-spin>
  </a-drawer>
</template>
