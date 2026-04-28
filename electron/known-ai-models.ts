export const KNOWN_AI_MODELS: Record<string, string[]> = {
  openai: [
    "gpt-5.5", "gpt-5.5-pro",
    "gpt-5.4", "gpt-5.4-pro", "gpt-5.4-mini", "gpt-5.4-nano",
    "gpt-5.2", "gpt-5.1", "gpt-5", "gpt-5-mini",
    "gpt-4.1", "gpt-4.1-mini",
    "gpt-4o", "gpt-4o-mini",
    "o3", "o3-mini", "o3-pro",
  ],
  anthropic: [
    "claude-opus-4-7",
    "claude-sonnet-4-6", "claude-haiku-4-5",
    "claude-opus-4-6", "claude-sonnet-4-5", "claude-opus-4-5",
    "claude-opus-4-1",
  ],
  deepseek: [
    "deepseek-v4-pro", "deepseek-v4-flash",
    "deepseek-chat", "deepseek-reasoner",
  ],
  qwen: [
    "qwen3.6-max-preview", "qwen3.6-plus", "qwen3.6-flash",
    "qwen3-max", "qwen3.5-plus", "qwen3.5-flash",
    "qwen-plus", "qwen-turbo", "qwen-long",
  ],
  zhipu: [
    "glm-5.1", "glm-5", "glm-5-turbo", "glm-5v-turbo",
    "glm-4.7", "glm-4.7-flash",
    "glm-4.6",
  ],
  moonshot: [
    "kimi-k2.6", "kimi-k2.5",
    "kimi-k2-0905",
    "moonshot-v1-128k", "moonshot-v1-32k", "moonshot-v1-8k",
  ],
  doubao: [
    "doubao-seed-2.0-pro", "doubao-seed-2.0-code",
    "doubao-seed-2.0-lite", "doubao-seed-2.0-mini",
    "doubao-pro-v1", "doubao-pro-128k", "doubao-lite-128k",
  ],
};

