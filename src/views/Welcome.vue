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

const progressPercent = computed(() => Math.round(((step.value + 1) / stepItems.value.length) * 100));

const heroMetrics = computed(() => [
  { value: "04", label: t("welcome.metricGenerators") },
  { value: "AI", label: t("welcome.metricWorkflow") },
  { value: "100%", label: t("welcome.metricLocal") },
]);

const capabilityCards = computed(() => [
  { code: "01", title: t("welcome.capabilityPrd"), desc: t("welcome.capabilityPrdDesc") },
  { code: "02", title: t("welcome.capabilityUi"), desc: t("welcome.capabilityUiDesc") },
  { code: "03", title: t("welcome.capabilityDesign"), desc: t("welcome.capabilityDesignDesc") },
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
    <div class="welcome-noise" />
    <div class="welcome-code-bg" aria-hidden="true">
      <span>AI_WORKFLOW::PRD_REQUIREMENTS_UI_DESIGN</span>
      <span>LOCAL_PROJECT_CONTEXT + REFERENCE_DOCS + MODEL_ROUTING</span>
      <span>REQUEST_ID_ISOLATION / HTML_RENDER / DIRECT_IMAGE</span>
      <span>TYPECHECK PASSED · TESTS PASSED · PACK READY</span>
    </div>

    <header class="welcome-topbar">
      <div class="welcome-brand">
        <span class="brand-mark">D</span>
        <span>{{ t("app.name") }}</span>
      </div>
      <div class="welcome-status">
        <span>{{ t("welcome.setupProgress", { percent: progressPercent }) }}</span>
      </div>
    </header>

    <main class="welcome-shell">
      <section class="welcome-hero">
        <div class="hero-kicker">
          <span class="pulse-dot" />
          {{ t("welcome.heroKicker") }}
        </div>
        <h1 class="welcome-title">
          {{ t("welcome.heroTitle") }}
        </h1>
        <p class="welcome-sub">
          {{ t("welcome.heroSubtitle") }}
        </p>

        <div class="metric-grid">
          <div
            v-for="item in heroMetrics"
            :key="item.label"
            class="metric-card"
          >
            <strong>{{ item.value }}</strong>
            <span>{{ item.label }}</span>
          </div>
        </div>

        <div class="capability-list">
          <article
            v-for="item in capabilityCards"
            :key="item.code"
            class="capability-card"
          >
            <span>{{ item.code }}</span>
            <div>
              <h3>{{ item.title }}</h3>
              <p>{{ item.desc }}</p>
            </div>
          </article>
        </div>
      </section>

      <a-card
        class="welcome-card"
        :bordered="false"
      >
        <div class="wizard-header">
          <div>
            <span class="wizard-label">{{ t("welcome.wizardLabel") }}</span>
            <h2>{{ stepItems[step]?.title }}</h2>
          </div>
          <span class="wizard-count">{{ step + 1 }}/{{ stepItems.length }}</span>
        </div>

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
            <h1 class="step-title">
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
                />
              </a-form-item>
              <a-form-item :label="t('settings.apiKey')">
                <a-input-password
                  v-model:value="wizardApiKey"
                  autocomplete="off"
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
            <h1 class="step-title">
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
    </main>
  </div>
</template>

<style lang="less" scoped>
.page-welcome {
  min-height: 100vh;
  padding: 28px clamp(18px, 4vw, 56px) 48px;
  box-sizing: border-box;
  color: rgba(248, 250, 252, 0.94);
  --app-primary: #60a5fa;
  --app-primary-gradient: linear-gradient(135deg, #60a5fa 0%, #8b5cf6 100%);
  --app-text: rgba(248, 250, 252, 0.94);
  --app-text-secondary: rgba(203, 213, 225, 0.84);
  --app-text-tertiary: rgba(148, 163, 184, 0.78);
  --app-text-quaternary: rgba(100, 116, 139, 0.66);
  --app-font-display: "DIN Alternate", "Bahnschrift", "Microsoft YaHei UI", "PingFang SC", sans-serif;
  --app-font-mono: "JetBrains Mono", "Cascadia Code", Consolas, "SFMono-Regular", monospace;
  background:
    radial-gradient(circle at 76% 10%, rgba(216, 255, 122, 0.14), transparent 22%),
    radial-gradient(circle at 18% 16%, rgba(96, 165, 250, 0.2), transparent 32%),
    radial-gradient(circle at 50% 100%, rgba(56, 189, 248, 0.08), transparent 38%),
    linear-gradient(135deg, #05070b 0%, #09111d 44%, #020407 100%);
  position: relative;
  overflow: hidden;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(148, 163, 184, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148, 163, 184, 0.03) 1px, transparent 1px);
    background-size: 36px 36px;
    mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.9), transparent 82%);
  }
}

.welcome-noise {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.18;
  background-image:
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.06) 0 1px, transparent 1px 2px),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.025) 0 1px, transparent 1px 3px);
  mix-blend-mode: screen;
}

.welcome-code-bg {
  position: absolute;
  inset: 56px 0 auto;
  z-index: 0;
  display: grid;
  gap: 8px;
  padding: 0 8px;
  color: rgba(226, 232, 240, 0.06);
  font-family: var(--app-font-mono);
  font-size: clamp(13px, 1.6vw, 24px);
  line-height: 1.1;
  letter-spacing: 0.08em;
  white-space: nowrap;
  user-select: none;
  transform: rotate(-1deg);

  span {
    animation: codeDrift 16s linear infinite;
  }

  span:nth-child(2n) {
    animation-direction: reverse;
    color: rgba(148, 163, 184, 0.09);
  }
}

@keyframes codeDrift {
  from { transform: translateX(-8%); }
  to { transform: translateX(8%); }
}

.welcome-topbar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 1320px;
  margin: 0 auto 64px;
  color: rgba(203, 213, 225, 0.82);
  font-size: 13px;
  font-family: var(--app-font-mono);
  font-weight: 800;
  letter-spacing: 0.08em;
}

.welcome-brand,
.welcome-status {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 0;
  color: #fff;
  font-weight: 800;
  background: var(--app-primary-gradient);
  box-shadow: 0 6px 24px rgba(96, 165, 250, 0.26);
}

.welcome-status {
  padding: 8px 12px;
  border: 0;
  background: rgba(4, 8, 14, 0.28);
}

.welcome-shell {
  position: relative;
  z-index: 1;
  width: min(1320px, 100%);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(420px, 520px);
  gap: clamp(28px, 5vw, 80px);
  align-items: center;
}

.welcome-hero {
  min-width: 0;
}

.hero-kicker {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 24px;
  color: rgba(216, 255, 122, 0.9);
  font-size: 12px;
  font-family: var(--app-font-mono);
  font-weight: 800;
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d8ff7a;
  box-shadow: 0 0 24px rgba(216, 255, 122, 0.9);
  animation: pulseDot 1.6s ease-in-out infinite;
}

@keyframes pulseDot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.7); opacity: 0.45; }
}

.welcome-card {
  width: 100%;
  border-radius: 0 !important;
  background: rgba(4, 8, 14, 0.32) !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: 0 !important;
  box-shadow: none !important;
  position: relative;
  animation: welcomeCardIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;

  &::before {
    content: "";
    position: absolute;
    inset: auto 0 0;
    pointer-events: none;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(216, 255, 122, 0.34), transparent);
    opacity: 0.72;
  }

  :deep(.ant-card-body) {
    padding: clamp(22px, 3vw, 36px);
  }

  :deep(.ant-steps-item-title),
  :deep(.ant-steps-item-description),
  :deep(.ant-form-item-label > label) {
    color: rgba(203, 213, 225, 0.84) !important;
    font-weight: 700;
  }

  :deep(.ant-steps-item-icon) {
    background: rgba(12, 19, 31, 0.72) !important;
    border-color: transparent !important;
  }

  :deep(.ant-steps-item-process .ant-steps-item-icon) {
    background: var(--app-primary-gradient) !important;
  }

  :deep(.ant-input),
  :deep(.ant-input-password),
  :deep(.ant-select-selector) {
    color: rgba(248, 250, 252, 0.94) !important;
    background: rgba(12, 19, 31, 0.72) !important;
    border-color: transparent !important;
    box-shadow: none !important;
  }

  :deep(.ant-input::placeholder) {
    color: rgba(148, 163, 184, 0.74) !important;
  }

  :deep(.ant-btn:not(.ant-btn-primary)) {
    color: rgba(248, 250, 252, 0.9);
    background: rgba(12, 19, 31, 0.72);
    border-color: transparent;
  }

  :deep(.ant-btn-primary) {
    color: #fff;
    background: var(--app-primary-gradient);
    border-color: transparent;
    box-shadow: 0 0 28px rgba(96, 165, 250, 0.22);
  }
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

.wizard-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;

  h2 {
    margin: 6px 0 0;
    color: rgba(248, 250, 252, 0.94);
    font-family: var(--app-font-display);
    font-weight: 950;
    font-size: 22px;
    line-height: 1.2;
  }
}

.wizard-label,
.wizard-count {
  color: rgba(216, 255, 122, 0.88);
  font-family: var(--app-font-mono);
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.wizard-count {
  color: rgba(255, 255, 255, 0.54);
}

.welcome-steps {
  margin-bottom: 30px;
}

.welcome-body {
  min-height: 190px;
  margin-bottom: 30px;
}

.step-panel {
  text-align: left;
  animation: stepFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes stepFadeIn {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.welcome-title {
  max-width: 760px;
  margin: 0 0 20px;
  color: rgba(248, 250, 252, 0.96);
  font-family: var(--app-font-display);
  font-size: clamp(52px, 8vw, 108px);
  font-weight: 950;
  line-height: 0.98;
  letter-spacing: -0.07em;
  text-wrap: balance;
}

.step-title {
  margin: 0 0 12px;
  color: rgba(248, 250, 252, 0.94);
  font-family: var(--app-font-display);
  font-size: 28px;
  font-weight: 800;
  line-height: 1.2;
}

.welcome-sub {
  margin: 0;
  max-width: 640px;
  color: rgba(203, 213, 225, 0.82);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.7;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  max-width: 680px;
  margin: 42px 0 26px;
}

.metric-card {
  min-height: 96px;
  padding: 18px;
  border: 0;
  background: rgba(4, 8, 14, 0.32);

  strong {
    display: block;
    margin-bottom: 8px;
    color: #fff;
    font-family: var(--app-font-display);
    font-size: clamp(30px, 4vw, 52px);
    line-height: 1;
  }

  span {
    color: rgba(203, 213, 225, 0.78);
    font-size: 12px;
    letter-spacing: 0.08em;
  }
}

.capability-list {
  display: grid;
  gap: 10px;
  max-width: 720px;
}

.capability-card {
  display: grid;
  grid-template-columns: 46px 1fr;
  gap: 16px;
  padding: 16px 0;
  border-top: 0;
  background: rgba(4, 8, 14, 0.18);
  padding-inline: 14px;

  > span {
    color: #d8ff7a;
    font-family: var(--app-font-mono);
    font-weight: 700;
  }

  h3 {
    margin: 0 0 6px;
    color: rgba(248, 250, 252, 0.92);
    font-size: 15px;
  }

  p {
    margin: 0;
    color: rgba(203, 213, 225, 0.76);
    line-height: 1.65;
  }
}

.step-heading {
  color: rgba(248, 250, 252, 0.94);
  font-family: var(--app-font-display);
  font-size: 1.1rem;
  margin: 0 0 18px;
  text-align: left;
  font-weight: 700;
}

.path-row {
  display: flex;
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
}

.wizard-form {
  max-width: 100%;
  text-align: left;
}

.welcome-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.test-alert {
  margin-top: 12px;
}

.finish-test-hint {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  margin-top: 16px;
  color: rgba(203, 213, 225, 0.82);
  font-size: 14px;
}

.finish-test-alert {
  margin-top: 16px;
  max-width: 420px;
  margin-left: 0;
  margin-right: 0;
  text-align: left;
}

@media (max-width: 980px) {
  .welcome-topbar {
    margin-bottom: 34px;
  }

  .welcome-shell {
    grid-template-columns: 1fr;
  }

  .welcome-card {
    max-width: 720px;
  }
}

@media (max-width: 640px) {
  .welcome-topbar,
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .welcome-topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .metric-grid {
    display: grid;
  }

  .welcome-actions {
    justify-content: flex-start;
  }
}
</style>
