<template>
  <div class="ai-provider-inline">
    <a-form-item :label="label || t('gen.common.customAi')">
      <a-select
        :value="modelValue"
        allow-clear
        :placeholder="placeholder || t('gen.common.useDefaultAi')"
        style="width: 100%"
        @update:value="onProviderChange"
      >
        <a-select-option v-for="p in allProviders" :key="p.id" :value="p.id">
          <span>{{ p.name }}</span>
          <a-tag
            v-if="!p.apiKey"
            color="warning"
            size="small"
            style="margin-left: 8px; font-size: 11px"
          >
            {{ t("gen.common.notConfigured") }}
          </a-tag>
        </a-select-option>
      </a-select>
      <div v-if="hint" class="ai-provider-inline__hint">
        {{ hint }}
      </div>
    </a-form-item>

    <template v-if="selectedProvider">
      <a-form-item label="API Key">
        <a-input-group compact>
          <a-input-password
            :value="selectedProvider.apiKey"
            :placeholder="t('gen.common.apiKeyPlaceholder')"
            allow-clear
            style="width: calc(100% - 90px)"
            @change="onApiKeyChange"
            @blur="onApiKeyBlur"
          />
          <a-button
            :loading="testing"
            :disabled="!selectedProvider.apiKey"
            @click="onTestConnection"
          >
            {{ testing ? t('settings.testing') : t('settings.testConnection') }}
          </a-button>
        </a-input-group>
      </a-form-item>
      <a-form-item
        v-if="selectedProvider.id === 'custom'"
        :label="t('settings.baseUrl')"
      >
        <a-input
          :value="selectedProvider.baseUrl"
          placeholder="https://api.example.com/v1"
          allow-clear
          @change="onBaseUrlChange"
          @blur="onBaseUrlBlur"
        />
      </a-form-item>
      <a-form-item :label="t('settings.model')">
        <a-auto-complete
          :value="selectedProvider.model"
          :options="modelAutoOptions"
          :placeholder="t('gen.common.modelPlaceholder')"
          allow-clear
          style="width: 100%"
          :filter-option="filterModelOption"
          @select="onModelSelect"
          @change="onModelInput"
          @blur="onModelBlur"
        />
        <a-spin v-if="modelLoading" size="small" style="margin-left: 8px" />
      </a-form-item>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";

const { t } = useI18n();

const props = defineProps<{
  modelValue: string;
  allProviders: AiProvider[];
  selectedProvider: AiProvider | null;
  saveProviderField: (providerId: string, field: "apiKey" | "baseUrl" | "model", value: string) => Promise<void>;
  label?: string;
  placeholder?: string;
  hint?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const pendingApiKey = ref("");
const apiKeyDirty = ref(false);
const pendingBaseUrl = ref("");
const baseUrlDirty = ref(false);
const modelOptions = ref<string[]>([]);
const modelLoading = ref(false);
const testing = ref(false);

const MODEL_CACHE_PREFIX = "lng-model-cache-";
const MODEL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCachedModels(providerId: string): string[] | null {
  try {
    const raw = localStorage.getItem(`${MODEL_CACHE_PREFIX}${providerId}`);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { models: string[]; ts: number };
    if (Date.now() - cached.ts > MODEL_CACHE_TTL) {
      localStorage.removeItem(`${MODEL_CACHE_PREFIX}${providerId}`);
      return null;
    }
    return cached.models;
  } catch {
    return null;
  }
}

function setCachedModels(providerId: string, models: string[]) {
  try {
    localStorage.setItem(
      `${MODEL_CACHE_PREFIX}${providerId}`,
      JSON.stringify({ models, ts: Date.now() }),
    );
  } catch { /* ignore */ }
}

function toPlain(p: AiProvider) {
  return { id: p.id, name: p.name, apiKey: p.apiKey, baseUrl: p.baseUrl, model: p.model, enabled: p.enabled };
}

function normalizeSelectValue(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  if (val && typeof val === "object" && "value" in val) {
    return normalizeSelectValue((val as { value: unknown }).value);
  }
  return "";
}

function onProviderChange(val: unknown) {
  emit("update:modelValue", normalizeSelectValue(val));
  modelOptions.value = [];
}

async function fetchModels(provider: AiProvider) {
  if (!provider.apiKey) return;

  // Check cache first
  const cached = getCachedModels(provider.id);
  if (cached && cached.length > 0) {
    modelOptions.value = cached;
    return;
  }

  modelLoading.value = true;
  try {
    const res = await window.electronAPI?.ai.listModels(toPlain(provider));
    if (res && Array.isArray(res) && res.length > 0) {
      modelOptions.value = res as string[];
      setCachedModels(provider.id, res as string[]);
    }
  } catch {
    // silently fail
  } finally {
    modelLoading.value = false;
  }
}

async function onTestConnection() {
  if (!props.selectedProvider) return;
  testing.value = true;
  try {
    const res = await window.electronAPI?.ai.testConnection(toPlain(props.selectedProvider));
    if (res && typeof res === "object" && "__ipcError" in (res as Record<string, unknown>)) {
      message.error((res as { message: string }).message || t("settings.testFail"));
    } else {
      message.success(t("settings.testSuccess"));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    message.error(msg);
  } finally {
    testing.value = false;
  }
}

watch(
  () => props.selectedProvider?.id,
  (newId) => {
    if (newId && props.selectedProvider) {
      void fetchModels(props.selectedProvider);
    } else {
      modelOptions.value = [];
    }
  },
  { immediate: true },
);

function onApiKeyChange(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  pendingApiKey.value = val;
  apiKeyDirty.value = true;
}

async function onApiKeyBlur() {
  if (!apiKeyDirty.value || !props.selectedProvider) return;
  apiKeyDirty.value = false;
  await props.saveProviderField(props.selectedProvider.id, "apiKey", pendingApiKey.value);
  message.success(t("gen.common.apiKeySaved"));
  if (pendingApiKey.value) {
    void fetchModels({ ...props.selectedProvider, apiKey: pendingApiKey.value });
  }
}

function onBaseUrlChange(e: Event) {
  const val = (e.target as HTMLInputElement).value;
  pendingBaseUrl.value = val;
  baseUrlDirty.value = true;
}

async function onBaseUrlBlur() {
  if (!baseUrlDirty.value || !props.selectedProvider) return;
  baseUrlDirty.value = false;
  await props.saveProviderField(props.selectedProvider.id, "baseUrl", pendingBaseUrl.value.trim());
  message.success(t("gen.common.baseUrlSaved"));
  modelOptions.value = [];
  if (props.selectedProvider.apiKey && pendingBaseUrl.value.trim()) {
    void fetchModels({ ...props.selectedProvider, baseUrl: pendingBaseUrl.value.trim() });
  }
}

const modelAutoOptions = computed(() =>
  modelOptions.value.map((m) => ({ value: m, label: m })),
);

function filterModelOption(input: string, option: { value: string }) {
  return option.value.toLowerCase().includes(input.toLowerCase());
}

const pendingModel = ref("");

async function onModelSelect(val: unknown) {
  if (!props.selectedProvider) return;
  const model = normalizeSelectValue(val);
  pendingModel.value = model;
  await props.saveProviderField(props.selectedProvider.id, "model", model || "");
  message.success(t("gen.common.modelSaved"));
}

function onModelInput(val: unknown) {
  pendingModel.value = normalizeSelectValue(val);
}

async function onModelBlur() {
  if (!props.selectedProvider) return;
  const val = pendingModel.value;
  if (val !== props.selectedProvider.model) {
    await props.saveProviderField(props.selectedProvider.id, "model", val || "");
    message.success(t("gen.common.modelSaved"));
  }
}
</script>

<style lang="less" scoped>
.ai-provider-inline :deep(.ant-form-item) {
  margin-bottom: 12px;
}

.ai-provider-inline__hint {
  margin-top: 6px;
  color: var(--app-text-secondary, rgba(0, 0, 0, 0.55));
  font-size: 12px;
  line-height: 1.5;
}
</style>
