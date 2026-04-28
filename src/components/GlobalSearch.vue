<template>
  <a-modal
    v-model:open="open"
    :title="t('globalSearch.title')"
    :footer="null"
    :width="560"
    :destroy-on-close="false"
    :centered="true"
    role="dialog"
    :aria-label="t('globalSearch.title')"
    @after-close="onModalAfterClose"
  >
    <a-input-search
      ref="searchInputRef"
      v-model:value="query"
      size="large"
      allow-clear
      :placeholder="t('globalSearch.placeholder')"
      @search="noop"
      @keydown="onSearchKeydown"
    />
    <div
      v-if="query.trim() && filteredItems.length === 0"
      class="global-search__empty"
    >
      {{ t("globalSearch.noResults") }}
    </div>
    <a-list
      v-else-if="filteredItems.length > 0"
      class="global-search__list"
      :bordered="false"
      :data-source="filteredItems"
    >
      <template #renderItem="{ item, index }">
        <a-list-item
          class="global-search__row"
          :class="{ 'global-search__row--active': index === activeIndex }"
          @click="go(item.path)"
          @mouseenter="activeIndex = index"
        >
          <a-list-item-meta :title="t(item.i18nKey)" />
          <span class="global-search__shortcut" v-if="index < 9">
            <kbd>{{ index + 1 }}</kbd>
          </span>
        </a-list-item>
      </template>
    </a-list>
  </a-modal>
</template>

<script setup lang="ts">
import { InputSearch } from "ant-design-vue";
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const { t } = useI18n();
const router = useRouter();

const searchInputRef = ref<InstanceType<typeof InputSearch> | null>(null);
const query = ref("");
const activeIndex = ref(0);

const open = computed({
  get: () => props.visible,
  set: (v: boolean) => emit("update:visible", v),
});

/** Kept in sync with `src/router/index.ts` and main nav. */
const menuItems = [
  { path: "/", i18nKey: "nav.dashboard" as const },
  { path: "/settings", i18nKey: "nav.settings" as const },
  { path: "/health", i18nKey: "nav.health" as const },
  { path: "/logs", i18nKey: "nav.logs" as const },
  { path: "/gen/prd", i18nKey: "nav.genPrd" as const },
  { path: "/gen/requirements", i18nKey: "nav.genRequirements" as const },
  { path: "/gen/ui", i18nKey: "nav.genUi" as const },
  { path: "/gen/design", i18nKey: "nav.genDesign" as const },
] as const;

const filteredItems = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) {
    return [...menuItems];
  }
  return menuItems.filter((item) => {
    const label = t(item.i18nKey).toLowerCase();
    return label.includes(q) || item.path.toLowerCase().includes(q);
  });
});

function noop() {
  /* input-search may emit search; navigation is via list click */
}

function onSearchKeydown(e: KeyboardEvent) {
  const len = filteredItems.value.length;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % len;
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex.value = (activeIndex.value - 1 + len) % len;
  } else if (e.key === "Enter") {
    e.preventDefault();
    const item = filteredItems.value[activeIndex.value];
    if (item) go(item.path);
  }
}

function go(path: string) {
  void router.push(path);
  emit("update:visible", false);
  query.value = "";
}

function onModalAfterClose() {
  query.value = "";
  activeIndex.value = 0;
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      void nextTick(() => {
        const el = searchInputRef.value?.$el as HTMLElement | undefined;
        const input = el?.querySelector?.("input") as HTMLInputElement | undefined;
        input?.focus?.();
        input?.select?.();
      });
    }
  },
);
</script>

<style lang="less" scoped>
.global-search__empty {
  margin-top: 16px;
  padding: 12px 0;
  font-size: 13px;
  color: var(--app-text-tertiary, rgba(0, 0, 0, 0.45));
  text-align: center;
}

.global-search__list {
  margin-top: 8px;
  max-height: 400px;
  overflow: auto;
}

.global-search__row {
  padding: 10px 14px !important;
  border-radius: var(--app-radius-sm, 8px);
  cursor: pointer;
  transition: background var(--app-transition, 0.2s ease);
}

.global-search__row:hover,
.global-search__row--active {
  background: var(--app-bg-hover, rgba(59, 130, 246, 0.06));
}

.global-search__shortcut {
  flex-shrink: 0;
  kbd {
    display: inline-block;
    padding: 1px 6px;
    font-size: 11px;
    font-family: inherit;
    background: var(--app-bg-spotlight, #f8fafc);
    border: 1px solid var(--app-border-secondary, rgba(0, 0, 0, 0.06));
    border-radius: 4px;
    color: var(--app-text-tertiary);
    min-width: 20px;
    text-align: center;
  }
}
</style>
