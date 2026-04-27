<script setup lang="ts">
import { useAppStore } from "@/store/app";
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { prefetchCriticalRoutes } from "@/router";

const { t } = useI18n();
const router = useRouter();
const appStore = useAppStore();

const step = ref(0);
const methPath = ref("");
const projPath = ref("");
const selectedProviderId = ref("openai");
const wizardApiKey = ref("");

const apiKeyTesting = ref(false);
const apiKeyTestResult = ref<"idle" | "success" | "fail">("idle");
const apiKeyTestMsg = ref("");

const providerOptions = ref<{ value: string; label: string }[]>([]);

const stepItems = computed(() => [
  { title: t("welcome.step1Title"), description: t("welcome.step1Desc") },
  { title: t("welcome.step2Title"), description: t("welcome.step2Desc") },
  { title: t("welcome.step3Title"), description: t("welcome.step3Desc") },
  { title: t("welcome.step4Title"), description: t("welcome.step4Desc") },
  { title: t("welcome.step5Title"), description: t("welcome.step5Desc") },
]);

function syncOptionsFromConfig() {
  const list = appStore.config.aiProviders?.length
    ? appStore.config.aiProviders
    : [];
  providerOptions.value = list.map((p) => ({ value: p.id, label: p.name }));
}

watch(
  () => appStore.config.aiProviders,
  () => {
    syncOptionsFromConfig();
  },
  { deep: true },
);

watch(selectedProviderId, (id) => {
  const p = appStore.config.aiProviders.find((x) => x.id === id);
  wizardApiKey.value = p?.apiKey || "";
  apiKeyTestResult.value = "idle";
  apiKeyTestMsg.value = "";
});

function isIpcError(v: unknown): v is IpcErrorResult {
  return (
    typeof v === "object" &&
    v !== null &&
    "__ipcError" in v &&
    (v as IpcErrorResult).__ipcError === true
  );
}

function buildTestProvider(): AiProvider | null {
  const base = appStore.config.aiProviders.find(
    (p) => p.id === selectedProviderId.value,
  );
  if (!base) return null;
  return { ...base, apiKey: wizardApiKey.value, enabled: true };
}

async function testApiKey(): Promise<boolean> {
  const key = wizardApiKey.value.trim();
  if (!key) {
    apiKeyTestResult.value = "idle";
    apiKeyTestMsg.value = t("welcome.testSkipEmpty");
    return false;
  }
  const provider = buildTestProvider();
  if (!provider) return false;

  const e = window.electronAPI;
  if (!e) return false;

  apiKeyTesting.value = true;
  apiKeyTestResult.value = "idle";
  apiKeyTestMsg.value = "";
  try {
    const res = await e.ai.testConnection(provider);
    if (isIpcError(res)) {
      apiKeyTestResult.value = "fail";
      apiKeyTestMsg.value = (res as IpcErrorResult).message;
      return false;
    }
    apiKeyTestResult.value = "success";
    apiKeyTestMsg.value = "";
    return true;
  } catch (err: unknown) {
    apiKeyTestResult.value = "fail";
    apiKeyTestMsg.value =
      err instanceof Error ? err.message : String(err);
    return false;
  } finally {
    apiKeyTesting.value = false;
  }
}

async function pickMethodology() {
  const e = window.electronAPI;
  if (!e) {
    return;
  }
  const r = await e.app.selectDirectory(t("welcome.chooseDir"));
  if (isIpcError(r)) {
    return;
  }
  if (typeof r === "string" && r) {
    methPath.value = r;
  }
}

async function pickProject() {
  const e = window.electronAPI;
  if (!e) {
    return;
  }
  const r = await e.app.selectDirectory(t("welcome.chooseDir"));
  if (isIpcError(r)) {
    return;
  }
  if (typeof r === "string" && r) {
    projPath.value = r;
  }
}

async function onNext() {
  if (step.value === 3 && wizardApiKey.value.trim()) {
    await testApiKey();
  }
  if (step.value < 4) {
    step.value += 1;
  }
}

function onPrev() {
  if (step.value > 0) {
    step.value -= 1;
  }
}

async function onFinish() {
  try {
    const nextProviders = appStore.config.aiProviders.map((p) => {
      if (p.id === selectedProviderId.value) {
        return { ...p, apiKey: wizardApiKey.value, enabled: true };
      }
      return { ...p, enabled: false };
    });
    await appStore.setConfig({
      methodologyPath: methPath.value,
      projectPath: projPath.value,
      activeProviderId: selectedProviderId.value,
      aiProviders: nextProviders,
    });
  } catch (err) {
    console.error("[Welcome] setConfig failed, proceeding anyway:", err);
  }
  localStorage.setItem("lng-setup-done", "1");
  prefetchCriticalRoutes();
  await router.replace("/");
}

onMounted(async () => {
  await appStore.fetchConfig();
  const c = appStore.config;
  methPath.value = c.methodologyPath || "";
  projPath.value = c.projectPath || "";
  syncOptionsFromConfig();
  if (c.activeProviderId) {
    selectedProviderId.value = c.activeProviderId;
  } else {
    const first = c.aiProviders.find((p) => p.enabled);
    if (first) {
      selectedProviderId.value = first.id;
    }
  }
  const cur = c.aiProviders.find((p) => p.id === selectedProviderId.value);
  wizardApiKey.value = cur?.apiKey || "";
});
</script>

<template>
  <div class="page-welcome">
    <a-card
      class="welcome-card"
      :bordered="false"
    >
      <a-steps
        v-model:current="step"
        class="welcome-steps"
        :items="stepItems"
        direction="vertical"
        size="small"
      />
      <div class="welcome-body">
        <div
          v-show="step === 0"
          class="step-panel"
        >
          <h1 class="welcome-title">
            {{ t("welcome.headline") }}
          </h1>
          <p class="welcome-sub">
            {{ t("app.description") }}
          </p>
        </div>
        <div
          v-show="step === 1"
          class="step-panel"
        >
          <h2 class="step-heading">
            {{ t("welcome.step2Title") }}
          </h2>
          <a-input-group
            compact
            class="path-row"
          >
            <a-input
              v-model:value="methPath"
              :placeholder="t('settings.methodologyPath')"
            />
            <a-button @click="pickMethodology">
              {{ t("welcome.chooseDir") }}
            </a-button>
          </a-input-group>
        </div>
        <div
          v-show="step === 2"
          class="step-panel"
        >
          <h2 class="step-heading">
            {{ t("welcome.step3Title") }}
          </h2>
          <a-input-group
            compact
            class="path-row"
          >
            <a-input
              v-model:value="projPath"
              :placeholder="t('settings.projectPath')"
            />
            <a-button @click="pickProject">
              {{ t("welcome.chooseDir") }}
            </a-button>
          </a-input-group>
        </div>
        <div
          v-show="step === 3"
          class="step-panel"
        >
          <h2 class="step-heading">
            {{ t("welcome.step4Title") }}
          </h2>
          <a-form
            layout="vertical"
            class="wizard-form"
          >
            <a-form-item :label="t('welcome.selectProvider')">
              <a-select
                v-model:value="selectedProviderId"
                :options="providerOptions"
                style="width: 100%; max-width: 400px"
              />
            </a-form-item>
            <a-form-item :label="t('settings.apiKey')">
              <a-input-password
                v-model:value="wizardApiKey"
                autocomplete="off"
                style="max-width: 400px"
              />
            </a-form-item>
            <a-form-item>
              <a-button
                :loading="apiKeyTesting"
                :disabled="!wizardApiKey.trim()"
                @click="testApiKey"
              >
                {{ apiKeyTesting ? t("welcome.testing") : t("welcome.testConnection") }}
              </a-button>
              <a-alert
                v-if="apiKeyTestResult === 'success'"
                type="success"
                :message="t('welcome.testSuccess')"
                show-icon
                class="test-alert"
              />
              <a-alert
                v-else-if="apiKeyTestResult === 'fail'"
                type="error"
                :message="t('welcome.testFail', { msg: apiKeyTestMsg })"
                show-icon
                class="test-alert"
              />
            </a-form-item>
          </a-form>
        </div>
        <div
          v-show="step === 4"
          class="step-panel"
        >
          <h1 class="welcome-title">
            {{ t("welcome.allSet") }}
          </h1>
          <p class="welcome-sub">
            {{ t("welcome.subtitle") }}
          </p>
          <div
            v-if="apiKeyTesting"
            class="finish-test-hint"
          >
            <a-spin size="small" />
            <span>{{ t("welcome.autoTesting") }}</span>
          </div>
          <a-alert
            v-else-if="apiKeyTestResult === 'success'"
            type="success"
            :message="t('welcome.testSuccess')"
            show-icon
            class="finish-test-alert"
          />
          <a-alert
            v-else-if="apiKeyTestResult === 'fail'"
            type="warning"
            :message="t('welcome.testFail', { msg: apiKeyTestMsg })"
            show-icon
            class="finish-test-alert"
          />
        </div>
      </div>
      <div class="welcome-actions">
        <a-button
          v-if="step > 0"
          @click="onPrev"
        >
          {{ t("common.prev") }}
        </a-button>
        <a-button
          v-if="step < 4"
          type="primary"
          @click="onNext"
        >
          {{ t("common.next") }}
        </a-button>
        <a-button
          v-else
          type="primary"
          @click="onFinish"
        >
          {{ t("common.finish") }}
        </a-button>
      </div>
    </a-card>
  </div>
</template>

<style lang="less" scoped>
.page-welcome {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px 48px;
  box-sizing: border-box;
  background: var(--app-bg, #f1f5f9);
  position: relative;
  overflow: hidden;

  &::before,
  &::after {
    content: '';
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    opacity: 0.12;
    pointer-events: none;
    will-change: transform;
    animation: welcomeOrb 18s ease-in-out infinite alternate;
  }
  &::before {
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, #3b82f6, transparent 70%);
    top: -15%;
    left: -10%;
    animation-delay: 0s;
  }
  &::after {
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, #8b5cf6, transparent 70%);
    bottom: -15%;
    right: -10%;
    animation-delay: -9s;
  }
}

@keyframes welcomeOrb {
  0% { transform: translate(0, 0) scale(1); }
  50% { transform: translate(40px, -30px) scale(1.1); }
  100% { transform: translate(-20px, 20px) scale(0.95); }
}

.welcome-card {
  width: 100%;
  max-width: 680px;
  border-radius: var(--app-radius-xl, 20px) !important;
  background: var(--app-glass-bg, rgba(255, 255, 255, 0.72)) !important;
  backdrop-filter: blur(28px) saturate(1.6);
  -webkit-backdrop-filter: blur(28px) saturate(1.6);
  border: 1px solid var(--app-glass-border, rgba(255, 255, 255, 0.5)) !important;
  box-shadow: var(--app-shadow-lg), 0 0 60px color-mix(in srgb, var(--app-primary) 6%, transparent) !important;
  position: relative;
  z-index: 1;
  animation: welcomeCardIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes welcomeCardIn {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.97);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

.welcome-steps {
  margin-bottom: 28px;
}

.welcome-body {
  min-height: 200px;
  margin-bottom: 28px;
}

.step-panel {
  text-align: center;
}

.welcome-title {
  font-size: 1.6rem;
  font-weight: 800;
  margin: 0 0 12px;
  line-height: 1.35;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: welcomeTitleShimmer 4s ease-in-out infinite;
}

@keyframes welcomeTitleShimmer {
  0%, 100% { background-position: 0% center; }
  50% { background-position: 100% center; }
}

.welcome-sub {
  margin: 0;
  color: var(--app-text-secondary, rgba(0, 0, 0, 0.65));
  font-size: 15px;
  line-height: 1.7;
}

.step-heading {
  font-size: 1.15rem;
  margin: 0 0 18px;
  text-align: left;
  font-weight: 600;
}

.path-row {
  display: flex;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
}

.wizard-form {
  max-width: 440px;
  margin: 0 auto;
  text-align: left;
}

.welcome-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.test-alert {
  margin-top: 12px;
}

.finish-test-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
  color: var(--app-text-secondary, rgba(0, 0, 0, 0.65));
  font-size: 14px;
}

.finish-test-alert {
  margin-top: 16px;
  max-width: 420px;
  margin-left: auto;
  margin-right: auto;
  text-align: left;
}

@media (min-width: 480px) {
  .welcome-title {
    font-size: 1.85rem;
  }
}
</style>
