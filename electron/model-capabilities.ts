import type { AiProvider } from "./app-manager";

export type ModelOutputKind = "image" | "text" | "unknown";
export type ModelCapability = "text-output" | "image-output" | "vision-input";

export interface ModelCapabilityInfo {
  model: string;
  outputKind: ModelOutputKind;
  capabilities: ModelCapability[];
}

const IMAGE_OUTPUT_MODEL_IDS = new Set([
  // OpenAI Image API / compatible gateways.
  "gpt-image-2",
  "gpt-image-2-2026-04-21",
  "gpt-image-1.5",
  "gpt-image-1.5-2025-12-16",
  "gpt-image-1",
  "gpt-image-1-mini",
  "chatgpt-image-latest",
  "dall-e-3",
  "dall-e-2",

  // Alibaba Model Studio image generation / editing models.
  "wan2.7-image-pro",
  "wan2.7-image",
  "wan2.6-t2i",
  "wan2.6-image",
  "wan2.5-t2i-preview",
  "wan2.5-i2i-preview",
  "wan2.2-t2i-plus",
  "wan2.2-t2i-flash",
  "wan2.1-t2i-plus",
  "wan2.1-t2i-turbo",
  "wanx2.1-t2i-plus",
  "wanx2.1-t2i-turbo",
  "wanx2.0-t2i-turbo",
  "wanx-v1",
  "qwen-image-2.0-pro",
  "qwen-image-2.0-pro-2026-03-03",
  "qwen-image-2.0",
  "qwen-image-2.0-2026-03-03",
  "qwen-image-max",
  "qwen-image-max-2025-12-30",
  "qwen-image-plus",
  "qwen-image-plus-2026-01-09",
  "qwen-image",
  "qwen-image-edit-max",
  "qwen-image-edit-max-2026-01-16",
  "qwen-image-edit-plus",
  "qwen-image-edit-plus-2025-12-15",
  "qwen-image-edit-plus-2025-10-30",
  "qwen-image-edit",
  "z-image-turbo",

  // Zhipu / BigModel image generation models.
  "glm-image",
  "cogview-4",

  // Doubao / Seedream image generation models used by Volcengine and compatible gateways.
  "doubao-seedream-5.0",
  "doubao-seedream-5-0",
  "doubao-seedream-5-0-260128",
  "doubao-seedream-4.5",
  "doubao-seedream-4-5-251128",
  "doubao-seedream-4.0",
  "doubao-seedream-4-0-250828",
]);

const TEXT_OUTPUT_MODEL_IDS = new Set([
  // OpenAI text / reasoning / multimodal-understanding models.
  "gpt-5.5",
  "gpt-5.5-pro",
  "gpt-5.4",
  "gpt-5.4-pro",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  "gpt-5.2",
  "gpt-5.2-pro",
  "gpt-5.2-chat-latest",
  "gpt-5.2-codex",
  "gpt-5",
  "gpt-5-mini",
  "gpt-5-nano",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
  "o3",
  "o3-mini",
  "o3-pro",
  "o4-mini",
  "gpt-oss-120b",
  "gpt-oss-20b",

  // Anthropic Claude models output text, even when they accept image input.
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-5",
  "claude-haiku-4-5-20251001",
  "claude-haiku-4-5",
  "claude-opus-4-1-20250805",
  "claude-opus-4-1",
  "claude-opus-4-20250514",
  "claude-opus-4-0",
  "claude-sonnet-4-20250514",
  "claude-sonnet-4-0",
  "claude-3-7-sonnet-20250219",
  "claude-3-7-sonnet-latest",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-latest",
  "claude-3-5-haiku-20241022",
  "claude-3-5-haiku-latest",
  "claude-3-haiku-20240307",

  // DeepSeek chat/reasoning models.
  "deepseek-v4-pro",
  "deepseek-v4-flash",
  "deepseek-chat",
  "deepseek-reasoner",
  "deepseek-v3.2",

  // Qwen text / vision-understanding models output text.
  "qwen3.6-max-preview",
  "qwen3.6-plus",
  "qwen3.6-plus-2026-04-02",
  "qwen3.6-flash",
  "qwen3.6-flash-2026-04-16",
  "qwen3.6-35b-a3b",
  "qwen3.5-plus",
  "qwen3.5-plus-2026-02-15",
  "qwen3.5-flash",
  "qwen3.5-flash-2026-02-23",
  "qwen3.5-397b-a17b",
  "qwen3.5-122b-a10b",
  "qwen3.5-27b",
  "qwen3.5-35b-a3b",
  "qwen-plus",
  "qwen-turbo",
  "qwen-long",
  "qwen-plus-us",
  "qwen-flash-us",
  "qwen3-vl-plus",
  "qwen3-vl-flash",
  "qwen-vl-max",
  "qwen-vl-plus",

  // Zhipu text / vision-understanding models output text.
  "glm-5.1",
  "glm-5",
  "glm-5-turbo",
  "glm-5v-turbo",
  "glm-4.7",
  "glm-4.7-flash",
  "glm-4.6",
  "glm-4.6v",

  // Kimi / Moonshot models output text.
  "kimi-k2.6",
  "kimi-k2.5",
  "kimi-k2-0905-preview",
  "kimi-k2-0711-preview",
  "kimi-k2-turbo-preview",
  "kimi-k2-thinking",
  "kimi-k2-thinking-turbo",
  "moonshot-v1-8k",
  "moonshot-v1-32k",
  "moonshot-v1-128k",
  "moonshot-v1-8k-vision-preview",
  "moonshot-v1-32k-vision-preview",
  "moonshot-v1-128k-vision-preview",

  // Doubao text / vision-understanding models output text.
  "doubao-seed-2.0-pro",
  "doubao-seed-2.0-code",
  "doubao-seed-2.0-lite",
  "doubao-seed-2.0-mini",
  "doubao-pro-v1",
  "doubao-pro-128k",
  "doubao-lite-128k",
]);

const VISION_INPUT_MODEL_IDS = new Set([
  "gpt-5.5",
  "gpt-5.5-pro",
  "gpt-5.4",
  "gpt-5.4-pro",
  "gpt-5.4-mini",
  "gpt-5.2",
  "gpt-5.2-pro",
  "gpt-5",
  "gpt-5-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-opus-4-1",
  "claude-3-7-sonnet-latest",
  "qwen3-vl-plus",
  "qwen3-vl-flash",
  "qwen-vl-max",
  "qwen-vl-plus",
  "glm-5v-turbo",
  "glm-4.6v",
  "moonshot-v1-8k-vision-preview",
  "moonshot-v1-32k-vision-preview",
  "moonshot-v1-128k-vision-preview",
]);

export function normalizeModelId(model: string): string {
  const normalized = model.trim().toLowerCase();
  const slashIndex = normalized.lastIndexOf("/");
  return slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
}

export function getModelCapabilityInfo(model: string): ModelCapabilityInfo {
  const normalized = normalizeModelId(model);
  const capabilities: ModelCapability[] = [];
  let outputKind: ModelOutputKind = "unknown";

  if (IMAGE_OUTPUT_MODEL_IDS.has(normalized)) {
    outputKind = "image";
    capabilities.push("image-output");
  } else if (TEXT_OUTPUT_MODEL_IDS.has(normalized)) {
    outputKind = "text";
    capabilities.push("text-output");
  }

  if (VISION_INPUT_MODEL_IDS.has(normalized)) {
    capabilities.push("vision-input");
  }

  return { model: normalized, outputKind, capabilities };
}

export function getProviderModelCapabilityInfo(provider: AiProvider): ModelCapabilityInfo {
  return getModelCapabilityInfo(provider.model);
}

export function getModelOutputKind(provider: AiProvider): ModelOutputKind {
  return getProviderModelCapabilityInfo(provider).outputKind;
}

export function isImageGenerationModel(provider: AiProvider): boolean {
  return getModelOutputKind(provider) === "image";
}
