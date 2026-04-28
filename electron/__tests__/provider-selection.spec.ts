import { describe, expect, it } from "vitest";
import type { AiProvider } from "../app-manager";
import { resolveGenerationProvider } from "../ipc/provider-selection";

function provider(id: AiProvider["id"], overrides: Partial<AiProvider> = {}): AiProvider {
  return {
    id,
    name: id,
    apiKey: "",
    baseUrl: "https://example.test/v1",
    model: `${id}-model`,
    enabled: false,
    ...overrides,
  };
}

describe("resolveGenerationProvider", () => {
  it("uses the image-specific provider when it is configured and enabled", () => {
    const providers = [
      provider("openai", { apiKey: "global-key", enabled: true }),
      provider("deepseek", { apiKey: "feature-key", enabled: true }),
      provider("qwen", { apiKey: "image-key", enabled: true }),
    ];

    const selected = resolveGenerationProvider({
      providers,
      primaryProviderId: "qwen",
      fallbackProviderId: "deepseek",
      activeProviderId: "openai",
    });

    expect(selected?.id).toBe("qwen");
  });

  it("falls back to the feature provider when the image-specific provider is unavailable", () => {
    const providers = [
      provider("openai", { apiKey: "global-key", enabled: true }),
      provider("deepseek", { apiKey: "feature-key", enabled: true }),
      provider("qwen", { apiKey: "", enabled: true }),
    ];

    const selected = resolveGenerationProvider({
      providers,
      primaryProviderId: "qwen",
      fallbackProviderId: "deepseek",
      activeProviderId: "openai",
    });

    expect(selected?.id).toBe("deepseek");
  });

  it("falls back to the active global provider when no requested provider is usable", () => {
    const providers = [
      provider("openai", { apiKey: "global-key", enabled: true }),
      provider("deepseek", { apiKey: "", enabled: true }),
      provider("qwen", { apiKey: "", enabled: false }),
    ];

    const selected = resolveGenerationProvider({
      providers,
      primaryProviderId: "qwen",
      fallbackProviderId: "deepseek",
      activeProviderId: "openai",
    });

    expect(selected?.id).toBe("openai");
  });
});
