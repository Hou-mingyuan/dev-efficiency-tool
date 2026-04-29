<script setup lang="ts">
import {
  AppstoreOutlined,
  BgColorsOutlined,
  CloseOutlined,
  DashboardOutlined,
  FormOutlined,
  HeartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MinusOutlined,
  BlockOutlined,
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
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import NotificationCenter from "@/components/NotificationCenter.vue";
import { useNotificationStore } from "@/store/notification";

const router = useRouter();
const route = useRoute();
const notificationStore = useNotificationStore();
const { t, locale } = useI18n();
const appVersion = ref("");

const keepAliveViews = ["GeneratePRD", "GenerateRequirements", "GenerateUI", "GenerateDesign"];

const collapsed = ref(false);

function checkScreenSize() {
  if (window.innerWidth < 992) {
    collapsed.value = true;
  }
}

const currentTheme = ref<"light" | "dark">("light");
const isDark = ref(false);

type AccentColor = "blue" | "green" | "purple" | "orange";
const currentAccent = ref<AccentColor>("blue");

const accentPresets: Record<AccentColor, { primary: string; hover: string; gradient: string; darkPrimary: string; darkHover: string; darkGradient: string }> = {
  blue: { primary: "#3b82f6", hover: "#60a5fa", gradient: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)", darkPrimary: "#60a5fa", darkHover: "#93c5fd", darkGradient: "linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)" },
  green: { primary: "#10b981", hover: "#34d399", gradient: "linear-gradient(135deg, #10b981 0%, #06b6d4 100%)", darkPrimary: "#34d399", darkHover: "#6ee7b7", darkGradient: "linear-gradient(135deg, #34d399 0%, #22d3ee 100%)" },
  purple: { primary: "#8b5cf6", hover: "#a78bfa", gradient: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)", darkPrimary: "#a78bfa", darkHover: "#c4b5fd", darkGradient: "linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)" },
  orange: { primary: "#f59e0b", hover: "#fbbf24", gradient: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)", darkPrimary: "#fbbf24", darkHover: "#fde68a", darkGradient: "linear-gradient(135deg, #fbbf24 0%, #f87171 100%)" },
};

const applyAccent = (accent: AccentColor) => {
  currentAccent.value = accent;
  const preset = accentPresets[accent];
  const root = document.documentElement;
  root.style.setProperty("--app-primary", isDark.value ? preset.darkPrimary : preset.primary);
  root.style.setProperty("--app-primary-hover", isDark.value ? preset.darkHover : preset.hover);
  root.style.setProperty("--app-primary-gradient", isDark.value ? preset.darkGradient : preset.gradient);
  localStorage.setItem("lng-accent", accent);
};

const loadAccent = () => {
  const saved = localStorage.getItem("lng-accent") as AccentColor | null;
  if (saved && accentPresets[saved]) {
    applyAccent(saved);
  }
};
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
const pageLoading = ref(false);

const currentPageTitle = computed(() => {
  const path = route.path;
  const map: Record<string, string> = {
    "/": t("nav.dashboard"),
    "/settings": t("nav.settings"),
    "/gen/prd": t("nav.genPrd"),
    "/gen/requirements": t("nav.genRequirements"),
    "/gen/ui": t("nav.genUi"),
    "/gen/design": t("nav.genDesign"),
    "/health": t("nav.health"),
    "/logs": t("nav.logs"),
  };
  return map[path] || "";
});

const applyDomTheme = (name: "light" | "dark", animate = false) => {
  if (animate) {
    document.documentElement.classList.add("theme-transitioning");
    setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 500);
  }
  isDark.value = name === "dark";
  currentTheme.value = name;
  document.documentElement.setAttribute("data-theme", name);
  localStorage.setItem("lng-theme", name);
  applyAccent(currentAccent.value);
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
  applyDomTheme(next, true);
  await window.electronAPI?.app.setTheme(next);
};

const minimizeWindow = () => {
  void window.electronAPI?.win.minimize();
};

const maximizeWindow = () => {
  void window.electronAPI?.win.maximize();
};

const closeWindow = () => {
  void window.electronAPI?.win.close();
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

router.beforeEach(() => {
  pageLoading.value = true;
});
router.afterEach(() => {
  setTimeout(() => { pageLoading.value = false; }, 200);
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
    if (p.startsWith("/gen/") && !localStorage.getItem("lng-shortcuts-shown")) {
      localStorage.setItem("lng-shortcuts-shown", "1");
      setTimeout(() => { shortcutsOpen.value = true; }, 600);
    }
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

const isOnline = ref(navigator.onLine);
const handleOnline = () => { isOnline.value = true; };
const handleOffline = () => { isOnline.value = false; };

let removeUpdateListener: (() => void) | undefined;

onMounted(() => {
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  void loadTheme();
  void loadLocale();
  loadAccent();
  window.electronAPI?.app.getVersion().then((v) => {
    if (v && typeof v === "string") appVersion.value = v;
  });
  if (!localStorage.getItem("lng-guide-done")) {
    setTimeout(() => { showGuide.value = true; }, 800);
  }
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
  window.removeEventListener("online", handleOnline);
  window.removeEventListener("offline", handleOffline);
  removeUpdateListener?.();
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
          :collapsed-width="64"
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
            <a-menu-item-group v-if="!collapsed" :title="$t('nav.system')">
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
            </a-menu-item-group>
            <template v-else>
              <a-menu-item key="/health">
                <template #icon>
                  <HeartOutlined />
                </template>
              </a-menu-item>
              <a-menu-item key="/logs">
                <template #icon>
                  <UnorderedListOutlined />
                </template>
              </a-menu-item>
            </template>
          </a-menu>
          <div v-if="!collapsed" class="app-sider__footer">
            <span class="app-sider__status">
              <span class="status-dot" :class="isOnline ? 'status-dot--online' : 'status-dot--offline'" />
              <span class="app-sider__version">v{{ appVersion }}</span>
            </span>
          </div>
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
              <span v-if="currentPageTitle" class="app-header__page-title">{{ currentPageTitle }}</span>
            </div>
            <div class="app-header__drag-region" />
            <div class="app-header__right">
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
              <a-popover trigger="click" placement="bottom">
                <template #content>
                  <div class="accent-picker">
                    <div
                      v-for="(_, key) in accentPresets"
                      :key="key"
                      class="accent-picker__dot"
                      :class="{ 'accent-picker__dot--active': currentAccent === key }"
                      :style="{ background: accentPresets[key].gradient }"
                      @click="applyAccent(key as AccentColor)"
                    />
                  </div>
                </template>
                <a-button class="app-header__icon" type="text" :aria-label="$t('theme.accent')">
                  <BgColorsOutlined />
                </a-button>
              </a-popover>
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
              <div class="app-header__winctrl">
                <button class="winctrl-btn" @click="minimizeWindow" aria-label="Minimize"><MinusOutlined /></button>
                <button class="winctrl-btn" @click="maximizeWindow" aria-label="Maximize"><BlockOutlined /></button>
                <button class="winctrl-btn winctrl-btn--close" @click="closeWindow" aria-label="Close"><CloseOutlined /></button>
              </div>
            </div>
          </a-layout-header>
          <div v-if="pageLoading" class="app-loading-bar" />
          <a-layout-content class="app-content">
            <div class="app-content__orbs" aria-hidden="true">
              <div class="app-orb app-orb--1" />
              <div class="app-orb app-orb--2" />
              <div class="app-orb app-orb--3" />
            </div>
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
  background: #050915;
}
.app-welcome {
  min-height: 100vh;
}
.app-layout {
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at 12% 10%, rgba(96, 165, 250, 0.2), transparent 28%),
    radial-gradient(circle at 82% 8%, rgba(216, 255, 122, 0.13), transparent 24%),
    radial-gradient(circle at 54% 92%, rgba(56, 189, 248, 0.1), transparent 34%),
    linear-gradient(135deg, #05070b 0%, #09111d 44%, #020407 100%) !important;

  &::before {
    content: 'AI_GENERATION_PIPELINE / LOCAL_CONTEXT / REFERENCE_LOCK / REQUEST_PREVIEW_ISOLATION / PACK_READY';
    position: fixed;
    top: 88px;
    left: 16px;
    right: 0;
    z-index: 0;
    pointer-events: none;
    color: rgba(226, 232, 240, 0.052);
    font-family: var(--app-font-mono);
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.28em;
    white-space: nowrap;
    animation: shellCodeDrift 28s linear infinite;
  }

  &::after {
    content: '';
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      linear-gradient(90deg, transparent, rgba(216, 255, 122, 0.1), transparent),
      linear-gradient(rgba(148, 163, 184, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148, 163, 184, 0.03) 1px, transparent 1px);
    background-size: 36% 100%, 36px 36px, 36px 36px;
    background-position: -42% 0, 0 0, 0 0;
    mix-blend-mode: screen;
    opacity: 0.62;
    animation:
      shellScan 7.2s ease-in-out infinite,
      shellGridDrift 22s linear infinite;
  }
}

.app-layout,
.app-layout :deep(.ant-layout),
.app-layout :deep(.ant-layout-sider),
.app-layout :deep(.ant-layout-header),
.app-layout :deep(.ant-layout-content) {
  background: transparent !important;
}

.app-sider {
  position: sticky !important;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  border-right: 0 !important;
  background: transparent !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              max-width 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background: transparent;
    pointer-events: none;
    z-index: 0;
  }

  &__brand {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 64px;
    padding: 0 16px;
    position: relative;
    z-index: 1;
    border-bottom: 0;
    margin-bottom: 8px;
  }
  &__logo {
    width: 40px;
    height: 40px;
    border-radius: var(--app-radius-md);
    background: var(--app-primary-gradient);
    box-shadow:
      0 4px 16px color-mix(in srgb, var(--app-primary) 35%, transparent),
      inset 0 1px 1px rgba(255, 255, 255, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    position: relative;
    transition: transform var(--app-transition), box-shadow var(--app-transition);
    &:hover {
      transform: scale(1.08);
      box-shadow:
        0 6px 24px color-mix(in srgb, var(--app-primary) 45%, transparent),
        inset 0 1px 1px rgba(255, 255, 255, 0.3);
    }
    &-letter {
      font-size: 19px;
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.5px;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      line-height: 1;
    }
  }
  &__footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 12px 16px;
    text-align: center;
    z-index: 1;
  }
  &__status {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  &__version {
    font-size: 11px;
    color: var(--app-text-quaternary);
    font-family: var(--app-font-mono);
    font-weight: 700;
    letter-spacing: 0.08em;
  }
}

.app-menu {
  border-right: 0;
  background: transparent !important;
  padding: 4px 0;
  position: relative;
  z-index: 1;
}

.app-menu :deep(.ant-menu),
.app-menu :deep(.ant-menu-sub),
.app-menu :deep(.ant-menu-item),
.app-menu :deep(.ant-menu-submenu-title),
.app-menu :deep(.ant-menu-item-group-title) {
  background: transparent !important;
}

.app-menu :deep(.ant-menu-item),
.app-menu :deep(.ant-menu-submenu-title) {
  border-radius: 0 !important;
  margin-inline: 8px !important;
  width: calc(100% - 16px) !important;
  transition:
    color var(--app-transition),
    border-color var(--app-transition),
    background var(--app-transition);
}

.app-menu :deep(.ant-menu-item::after) {
  display: none !important;
}

.app-menu :deep(.ant-menu-item-selected) {
  color: var(--app-primary) !important;
  background: transparent !important;
  box-shadow: none;
}

.app-menu :deep(.ant-menu-item:hover),
.app-menu :deep(.ant-menu-submenu-title:hover) {
  background:
    linear-gradient(90deg, rgba(148, 163, 184, 0.08), transparent 72%) !important;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 0 12px;
  background: transparent !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border-bottom: 0;
  height: 48px;
  position: sticky;
  top: 0;
  z-index: 100;

  &__drag-region {
    flex: 1;
    height: 100%;
    -webkit-app-region: drag;
  }

  &__left,
  &__right {
    display: flex;
    align-items: center;
    gap: 8px;
    -webkit-app-region: no-drag;
  }
  &__page-title {
    font-family: var(--app-font-display);
    font-size: 16px;
    font-weight: 900;
    color: var(--app-text);
    margin-left: 4px;
    opacity: 0.9;
    letter-spacing: -0.02em;
    white-space: nowrap;
  }
  &__title {
    font-size: 16px;
    font-family: var(--app-font-display);
    font-weight: 900;
    letter-spacing: -0.02em;
    color: var(--app-text);
  }
  &__fold {
    color: var(--app-text);
    border-radius: var(--app-radius-sm) !important;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--app-transition);
    &:hover {
      background: rgba(148, 163, 184, 0.08);
    }
  }
  &__right .app-header__icon {
    color: var(--app-text);
    width: 36px;
    height: 36px;
    border-radius: var(--app-radius-sm) !important;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background var(--app-transition);
    &:hover {
      background: rgba(148, 163, 184, 0.08);
    }
  }
  &__select {
    min-width: 108px;
  }
  &__winctrl {
    display: flex;
    align-items: stretch;
    height: 48px;
    margin-left: 4px;
  }
}

.winctrl-btn {
  all: unset;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 48px;
  font-size: 13px;
  color: var(--app-text-secondary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  &:hover {
    background: rgba(148, 163, 184, 0.08);
    color: var(--app-text);
  }
  &--close:hover {
    background: #e81123;
    color: #fff;
  }
}

.app-content {
  margin: 0;
  padding: var(--app-page-padding-y) var(--app-page-padding-x) 32px;
  background: transparent;
  overflow-y: auto;
  overflow-x: hidden;
  height: calc(100vh - 48px);
  position: relative;
  z-index: 1;
}

.app-content :deep(.ant-card) {
  background: rgba(4, 8, 14, 0.3) !important;
  border-color: transparent !important;
  box-shadow: none !important;
}

.app-content :deep(.ant-card-head) {
  background: transparent !important;
  border-bottom-color: transparent !important;
}

.app-content__orbs {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}

.app-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.11;
  will-change: transform;
  contain: layout style;
  animation: orbFloat 20s ease-in-out infinite alternate;
  transform: translateZ(0);
}

.app-orb--1 {
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, #60a5fa, transparent 70%);
  top: -10%;
  right: -5%;
  animation-delay: 0s;
}

.app-orb--2 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #84cc16, transparent 70%);
  bottom: 10%;
  left: 5%;
  animation-delay: -7s;
}

.app-orb--3 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, #22d3ee, transparent 70%);
  top: 40%;
  right: 30%;
  animation-delay: -14s;
}

@keyframes orbFloat {
  0% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -20px) scale(1.05); }
  66% { transform: translate(-20px, 30px) scale(0.95); }
  100% { transform: translate(10px, -10px) scale(1.02); }
}

@keyframes shellCodeDrift {
  0% { transform: translateX(0); }
  100% { transform: translateX(-34%); }
}

@keyframes shellScan {
  0%, 14% {
    background-position: -45% 0, 0 0, 0 0;
    opacity: 0.34;
  }
  48%, 62% {
    background-position: 145% 0, 12px 18px, 12px 18px;
    opacity: 0.68;
  }
  100% {
    background-position: 145% 0, 24px 36px, 24px 36px;
    opacity: 0.36;
  }
}

@keyframes shellGridDrift {
  0% { filter: hue-rotate(0deg); }
  100% { filter: hue-rotate(16deg); }
}

.app-loading-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  z-index: 9999;
  background: var(--app-primary-gradient);
  animation: loadingBarSlide 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  transform-origin: left;
}

@keyframes loadingBarSlide {
  0% { transform: scaleX(0); opacity: 1; }
  50% { transform: scaleX(0.7); opacity: 1; }
  100% { transform: scaleX(1); opacity: 0; }
}

.accent-picker {
  display: flex;
  gap: 10px;
  padding: 4px;
}
.accent-picker__dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 2px solid transparent;
  &:hover {
    transform: scale(1.2);
  }
  &--active {
    border-color: var(--app-text);
    box-shadow: 0 0 0 2px var(--app-bg), 0 0 0 4px var(--app-primary);
  }
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  &--online {
    background: var(--app-success);
    box-shadow: 0 0 6px var(--app-success);
  }
  &--offline {
    background: var(--app-error);
    box-shadow: 0 0 6px var(--app-error);
  }
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              filter 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.page-fade-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.99);
  filter: blur(2px);
}
.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px) scale(0.99);
  filter: blur(1px);
}

</style>
