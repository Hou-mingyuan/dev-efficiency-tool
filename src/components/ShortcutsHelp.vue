<template>
  <a-modal
    v-model:open="open"
    :title="t('shortcuts.title')"
    :footer="null"
    :width="520"
    :destroy-on-close="true"
    :centered="true"
    :body-style="modalBodyStyle"
  >
    <p class="shortcuts-help__hint">{{ t("shortcuts.hint") }}</p>
    <a-list
      class="shortcuts-help__list"
      :bordered="false"
      :data-source="rows"
    >
      <template #renderItem="{ item }">
        <a-list-item class="shortcuts-help__item">
          <a-list-item-meta
            :title="item.label"
            :description="item.keys"
          />
        </a-list-item>
      </template>
    </a-list>
  </a-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { CSSProperties } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const { t } = useI18n();

const open = computed({
  get: () => props.visible,
  set: (v: boolean) => emit("update:visible", v),
});

const modalBodyStyle: CSSProperties = {
  maxHeight: "calc(100vh - 180px)",
  overflowY: "auto",
  paddingRight: "12px",
};

const rows = computed(() => [
  {
    key: "toggle",
    label: t("shortcuts.toggleWindow"),
    keys: "Ctrl+Shift+M",
  },
  {
    key: "search",
    label: t("shortcuts.globalSearch"),
    keys: "Ctrl+K",
  },
  {
    key: "help",
    label: t("shortcuts.shortcuts"),
    keys: "F1 / Ctrl+?",
  },
  {
    key: "generate",
    label: t("shortcuts.generate"),
    keys: "Ctrl+Enter",
  },
  {
    key: "save",
    label: t("shortcuts.saveDocument"),
    keys: "Ctrl+S",
  },
  {
    key: "nav1",
    label: t("shortcuts.navDashboard"),
    keys: "Alt+1",
  },
  {
    key: "nav2",
    label: t("shortcuts.navSettings"),
    keys: "Alt+2",
  },
  {
    key: "nav3",
    label: t("shortcuts.navPrd"),
    keys: "Alt+3",
  },
  {
    key: "nav4",
    label: t("shortcuts.navReq"),
    keys: "Alt+4",
  },
  {
    key: "nav5",
    label: t("shortcuts.navUi"),
    keys: "Alt+5",
  },
  {
    key: "nav6",
    label: t("shortcuts.navDesign"),
    keys: "Alt+6",
  },
]);

</script>

<style lang="less" scoped>
.shortcuts-help__hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: rgba(203, 213, 225, 0.84);
  line-height: 1.6;
  font-weight: 600;
}

.shortcuts-help__list {
  :deep(.ant-list-item-meta-description) {
    font-family: var(--app-font-mono);
    font-size: 13px;
    color: rgba(226, 232, 240, 0.9);
    background: rgba(12, 19, 31, 0.72);
    padding: 3px 10px;
    border-radius: 0;
    display: inline-block;
  }
}

.shortcuts-help__item {
  padding: 10px 0 !important;
}
</style>
