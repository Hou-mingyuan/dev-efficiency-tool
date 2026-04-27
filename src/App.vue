<script setup lang="ts">
import {
  AppstoreOutlined,
  BgColorsOutlined,

  CodeOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FormOutlined,
  HeartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BulbOutlined,
  BulbFilled,
  ProfileOutlined,
  SettingOutlined,
  SolutionOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons-vue";
import { theme } from "ant-design-vue";
import enUS from "ant-design-vue/es/locale/en_US";
import zhCN from "ant-design-vue/es/locale/zh_CN";
import { storeToRefs } from "pinia";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import NotificationCenter from "@/components/NotificationCenter.vue";
import { useMcpStore } from "@/store/mcp";
import { useNotificationStore } from "@/store/notification";

const router = useRouter();
const route = useRoute();
const mcpStore = useMcpStore();
const { lastStatusFetchError, status: mcpServiceStatus } = storeToRefs(mcpStore);
const notificationStore = useNotificationStore();
const { t, locale } = useI18n();

const keepAliveViews = ["GeneratePRD", "GenerateRequirements", "GenerateUI", "GenerateDesign"];

const collapsed = ref(false);

function checkScreenSize() {
  if (window.innerWidth < 992) {
    collapsed.value = true;
  }
}

const currentTheme = ref<"light" | "dark">("light");
const isDark = ref(false);
const selectedKeys = ref<string[]>(["/"]);
const openKeys = ref<string[]>(["ai-workshop"]);
const searchOpen = ref(false);
const showGuide = ref(false);

const guideSteps = computed(() => [
  {
    target: '[data-guide="dashboard"]',
    title: t("guide.step1Title"),
    description: t("guide.step1Desc"),
    placement: "right" as const,
  },
  {
    target: '[data-guide="settings"]',
    title: t("guide.step2Title"),
    description: t("guide.step2Desc"),
    placement: "right" as const,
  },
  {
    target: '[data-guide="ai-workshop"]',
    title: t("guide.step3Title"),
    description: t("guide.step3Desc"),
    placement: "right" as const,
  },
  {
    target: '[data-guide="theme"]',
    title: t("guide.step4Title"),
    description: t("guide.step4Desc"),
    placement: "bottom" as const,
  },
  {
    target: '[data-guide="lang"]',
    title: t("guide.step5Title"),
    description: t("guide.step5Desc"),
    placement: "bottom" as const,
  },
]);
const shortcutsOpen = ref(false);

const antdLocale = computed(() => (locale.value === "zh" ? zhCN : enUS));

const antTheme = computed(() => {
  return {
    algorithm: isDark.value ? theme.darkAlgorithm : theme.defaultAlgorithm,
  };
});

const isShellRoute = computed(() => route.meta?.fullscreen !== true);

const applyDomTheme = (name: "light" | "dark") => {
  isDark.value = name === "dark";
  currentTheme.value = name;
  document.documentElement.setAttribute("data-theme", name);
  localStorage.setItem("lng-theme", name);
};

const loadTheme = async () => {
  const fromStorage = localStorage.getItem("lng-theme");
  if (fromStorage === "light" || fromStorage === "dark") {
    applyDomTheme(fromStorage);
  }
  const raw = await window.electronAPI?.app.getTheme();
  if (raw && typeof raw === "object" && "__ipcError" in raw) {
    return;
  }
  if (raw === "light" || raw === "dark") {
    applyDomTheme(raw);
  }
};

const onToggleTheme = async () => {
  const next = isDark.value ? "light" : "dark";
  applyDomTheme(next);
  await window.electronAPI?.app.setTheme(next);
};

const setLocale = async (next: "zh" | "en") => {
  locale.value = next;
  localStorage.setItem("lng-locale", next);
  const native = next === "zh" ? "zh-CN" : "en";
  await window.electronAPI?.app.setLocale(native);
};

const loadLocale = async () => {
  const fromStorage = localStorage.getItem("lng-locale");
  if (fromStorage === "en" || fromStorage === "en-US") {
    await setLocale("en");
    return;
  }
  if (fromStorage === "zh" || fromStorage === "zh-CN") {
    await setLocale("zh");
    return;
  }
  const fromElectron = await window.electronAPI?.app.getLocale();
  if (fromElectron && typeof fromElectron === "object" && "__ipcError" in fromElectron) {
    await setLocale("zh");
    return;
  }
  if (typeof fromElectron === "string") {
    if (fromElectron === "en" || fromElectron === "en-US") {
      await setLocale("en");
      return;
    }
    if (fromElectron === "zh-CN" || fromElectron === "zh") {
      await setLocale("zh");
      return;
    }
  }
  await setLocale("zh");
};

const displayLocale = computed<"zh" | "en">({
  get() {
    return locale.value === "en" ? "en" : "zh";
  },
  set(v) {
    void setLocale(v);
  },
});

const syncMenuFromRoute = (path: string) => {
  if (path === "/") {
    selectedKeys.value = ["/"];
  } else {
    selectedKeys.value = [path];
  }
  if (path.startsWith("/gen/")) {
    if (!openKeys.value.includes("ai-workshop")) {
      openKeys.value = [...openKeys.value, "ai-workshop"];
    }
  }
};

watch(
  () => route.path,
  (p) => {
    syncMenuFromRoute(p);
  },
  { immediate: true },
);

const onMenuSelect = (info: { key: string | number }) => {
  const key = String(info.key);
  if (key === "ai-workshop") {
    return;
  }
  if (key.startsWith("/") || key === "/") {
    void router.push(key);
  }
};

const onKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
    e.preventDefault();
    searchOpen.value = true;
    return;
  }
  if (e.key === "F1") {
    e.preventDefault();
    shortcutsOpen.value = true;
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "?") {
    e.preventDefault();
    shortcutsOpen.value = true;
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "?" || e.key === "/")) {
    e.preventDefault();
    shortcutsOpen.value = true;
    return;
  }
  if (e.altKey && e.key >= "1" && e.key <= "6") {
    e.preventDefault();
    const routes = ["/", "/settings", "/gen/prd", "/gen/requirements", "/gen/ui", "/gen/design"];
    const idx = parseInt(e.key) - 1;
    if (routes[idx]) void router.push(routes[idx]);
  }
};

const extractVersion = (info: unknown): string => {
  if (info && typeof info === "object" && "version" in info) {
    const v = (info as { version: unknown }).version;
    if (typeof v === "string") {
      return v;
    }
  }
  return "";
};

let removeUpdateListener: (() => void) | undefined;

onMounted(() => {
  void loadTheme();
  void loadLocale();
  if (!localStorage.getItem("lng-guide-done")) {
    setTimeout(() => { showGuide.value = true; }, 800);
  }
  mcpStore.startPolling(5000);
  checkScreenSize();
  window.addEventListener("resize", checkScreenSize);
  window.addEventListener("keydown", onKeydown);
  removeUpdateListener = window.electronAPI?.app.onUpdateAvailable((info) => {
    const version = extractVersion(info);
    notificationStore.addNotification({
      type: "info",
      title: t("notification.updateAvailable"),
      message: version ? t("update.versionLine", { version }) : t("update.versionUnknown"),
    });
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", checkScreenSize);
  window.removeEventListener("keydown", onKeydown);
  mcpStore.stopPolling();
  removeUpdateListener?.();
});

const mcpStatus = computed(() => {
  if (lastStatusFetchError.value) {
    return "error" as const;
  }
  if (mcpServiceStatus.value?.running) {
    return "running" as const;
  }
  return "stopped" as const;
});

const mcpStatusLabel = computed(() => {
  if (mcpStatus.value === "error") {
    return t("status.unknown");
  }
  if (mcpStatus.value === "running") {
    return t("status.running");
  }
  return t("status.stopped");
});
</script>

<template>
  <a-config-provider
    :locale="antdLocale"
    :theme="antTheme"
  >
    <div class="app-root">
      <div
        v-if="!isShellRoute"
        class="app-welcome"
      >
        <router-view />
      </div>
      <a-layout
        v-else
        class="app-layout"
        has-sider
      >
        <a-layout-sider
          v-model:collapsed="collapsed"
          :theme="isDark ? 'dark' : 'light'"
          :trigger="null"
          collapsible
          class="app-sider"
          :width="220"
        >
          <div class="app-sider__brand">
            <div class="app-sider__logo">
              <span class="app-sider__logo-letter">L</span>
            </div>
          </div>
          <a-menu
            v-model:openKeys="openKeys"
            v-model:selectedKeys="selectedKeys"
            class="app-menu"
            mode="inline"
            @select="onMenuSelect"
          >
            <a-menu-item key="/" data-guide="dashboard">
              <template #icon>
                <DashboardOutlined />
              </template>
              <span>{{ $t("nav.dashboard") }}</span>
            </a-menu-item>
            <a-menu-item key="/settings" data-guide="settings">
              <template #icon>
                <SettingOutlined />
              </template>
              <span>{{ $t("nav.settings") }}</span>
            </a-menu-item>
            <a-sub-menu
              key="ai-workshop"
              data-guide="ai-workshop"
            >
              <template #icon>
                <AppstoreOutlined />
              </template>
              <template #title>
                <span>{{ $t("nav.aiWorkbench") }}</span>
              </template>
              <a-menu-item key="/gen/prd">
                <template #icon>
                  <ProfileOutlined />
                </template>
                <span>{{ $t("nav.genPrd") }}</span>
              </a-menu-item>
              <a-menu-item key="/gen/requirements">
                <template #icon>
                  <FormOutlined />
                </template>
                <span>{{ $t("nav.genRequirements") }}</span>
              </a-menu-item>
              <a-menu-item key="/gen/ui">
                <template #icon>
                  <BgColorsOutlined />
                </template>
                <span>{{ $t("nav.genUi") }}</span>
              </a-menu-item>
              <a-menu-item key="/gen/design">
                <template #icon>
                  <SolutionOutlined />
                </template>
                <span>{{ $t("nav.genDesign") }}</span>
              </a-menu-item>
            </a-sub-menu>
            <a-menu-item key="/methodology">
              <template #icon>
                <FileTextOutlined />
              </template>
              <span>{{ $t("nav.methodology") }}</span>
            </a-menu-item>
            <a-menu-item key="/ide">
              <template #icon>
                <CodeOutlined />
              </template>
              <span>{{ $t("nav.ide") }}</span>
            </a-menu-item>
            <a-menu-item key="/health">
              <template #icon>
                <HeartOutlined />
              </template>
              <span>{{ $t("nav.health") }}</span>
            </a-menu-item>
            <a-menu-item key="/logs">
              <template #icon>
                <UnorderedListOutlined />
              </template>
              <span>{{ $t("nav.logs") }}</span>
            </a-menu-item>
            <a-menu-item key="/parser">
              <template #icon>
                <FileSearchOutlined />
              </template>
              <span>{{ $t("nav.parser") }}</span>
            </a-menu-item>
          </a-menu>
        </a-layout-sider>
        <a-layout>
          <a-layout-header
            class="app-header"
          >
            <div class="app-header__left">
              <a-button
                class="app-header__fold"
                type="text"
                :aria-label="$t('appShell.collapseSider')"
                @click="collapsed = !collapsed"
              >
                <MenuUnfoldOutlined v-if="collapsed" />
                <MenuFoldOutlined v-else />
              </a-button>
            </div>
            <div class="app-header__right">
              <a-tooltip
                :title="mcpStatusLabel"
              >
                <span
                  class="app-mcp-dot"
                  :class="`app-mcp-dot--${mcpStatus}`"
                  :aria-label="mcpStatusLabel"
                />
              </a-tooltip>
              <a-select
                v-model:value="displayLocale"
                class="app-header__select"
                size="small"
                :aria-label="$t('appShell.language')"
                data-guide="lang"
              >
                <a-select-option value="zh">
                  {{ $t("locale.zh") }}
                </a-select-option>
                <a-select-option value="en">
                  {{ $t("locale.en") }}
                </a-select-option>
              </a-select>
              <a-tooltip :title="isDark ? $t('theme.dark') : $t('theme.light')">
                <a-button
                  class="app-header__icon"
                  type="text"
                  :aria-label="isDark ? $t('theme.dark') : $t('theme.light')"
                  data-guide="theme"
                  @click="onToggleTheme"
                >
                  <BulbFilled v-if="isDark" />
                  <BulbOutlined v-else />
                </a-button>
              </a-tooltip>
              <NotificationCenter />
            </div>
          </a-layout-header>
          <a-layout-content class="app-content">
            <GlobalSearch v-model:visible="searchOpen" />
            <ShortcutsHelp v-model:visible="shortcutsOpen" />
            <ErrorBoundary>
              <router-view v-slot="{ Component }">
                <transition name="page-fade" mode="out-in">
                  <keep-alive :include="keepAliveViews">
                    <component :is="Component" />
                  </keep-alive>
                </transition>
              </router-view>
            </ErrorBoundary>
          </a-layout-content>
        </a-layout>
      </a-layout>
      <GuideTour
        :visible="showGuide"
        :steps="guideSteps"
        @close="showGuide = false"
      />
    </div>
  </a-config-provider>
</template>

<style lang="less" scoped>
.app-root {
  height: 100%;
  min-height: 100vh;
}
.app-welcome {
  min-height: 100vh;
}
.app-layout {
  min-height: 100vh;
}
.app-sider {
  &__brand {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 56px;
    padding: 0 16px;
  }
  &__logo {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, #1a6cff 0%, #0fd99e 60%, #4cd4a7 100%);
    box-shadow: 0 2px 8px rgba(26, 108, 255, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
    &-letter {
      font-size: 18px;
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.5px;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
      line-height: 1;
    }
  }
}
.app-menu {
  border-right: 0;
}
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 8px;
  background: var(--app-bg-container, #fff);
  border-bottom: 1px solid var(--app-border-secondary, rgba(0, 0, 0, 0.06));
  height: 56px;
  position: sticky;
  top: 0;
  z-index: 100;
  &__left,
  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  &__title {
    font-size: 16px;
    font-weight: 600;
    color: var(--app-text, rgba(0, 0, 0, 0.85));
  }
  &__fold {
    color: var(--app-text, rgba(0, 0, 0, 0.85));
  }
  &__right .app-header__icon {
    color: var(--app-text, rgba(0, 0, 0, 0.85));
  }
  &__select {
    min-width: 108px;
  }
}
.app-content {
  margin: 0;
  padding: 20px 24px 32px;
  background: var(--app-bg, #f5f5f5);
  overflow: auto;
  min-height: calc(100vh - 56px);
}
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.18s ease;
}
.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
.app-mcp-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 4px;
  &--running {
    background: var(--app-success, #52c41a);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
  }
  &--stopped {
    background: var(--app-muted, #8c8c8c);
  }
  &--error {
    background: var(--app-error, #f5222d);
  }
}
</style>
