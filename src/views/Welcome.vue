<script setup lang="ts">
import { useMcpStore } from "@/store/mcp";
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { prefetchCriticalRoutes } from "@/router";

const { t } = useI18n();
const router = useRouter();
const mcpStore = useMcpStore();

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
  const list = mcpStore.config.aiProviders?.length
    ? mcpStore.config.aiProviders
    : [];
  providerOptions.value = list.map((p) => ({ value: p.id, label: p.name }));
}

watch(
  () => mcpStore.config.aiProviders,
  () => {
    syncOptionsFromConfig();
  },
  { deep: true },
);

watch(selectedProviderId, (id) => {
  const p = mcpStore.config.aiProviders.find((x) => x.id === id);
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
  const base = mcpStore.config.aiProviders.find(
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
    const nextProviders = mcpStore.config.aiProviders.map((p) => {
      if (p.id === selectedProviderId.value) {
        return { ...p, apiKey: wizardApiKey.value, enabled: true };
      }
      return { ...p, enabled: false };
    });
    await mcpStore.setConfig({
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
  await mcpStore.fetchConfig();
  const c = mcpStore.config;
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
}

.welcome-card {
  width: 100%;
  max-width: 640px;
  border-radius: 12px;
}

.welcome-steps {
  margin-bottom: 24px;
}

.welcome-body {
  min-height: 200px;
  margin-bottom: 24px;
}

.step-panel {
  text-align: center;
}

.welcome-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0 0 8px;
  line-height: 1.35;
}

.welcome-sub {
  margin: 0;
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65));
  font-size: 14px;
}

.step-heading {
  font-size: 1.1rem;
  margin: 0 0 16px;
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
  max-width: 400px;
  margin: 0 auto;
  text-align: left;
}

.welcome-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
  color: var(--ant-color-text-secondary, rgba(0, 0, 0, 0.65));
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
    font-size: 1.75rem;
  }
}
</style>
