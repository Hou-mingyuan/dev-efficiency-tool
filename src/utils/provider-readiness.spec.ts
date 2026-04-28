import { describe, expect, it } from "vitest";
import { checkProviderReadiness } from "./provider-readiness";

function provider(overrides: Partial<AiProvider> = {}): AiProvider {
  return {
    id: "custom",
    name: "Custom",
    apiKey: "key",
    baseUrl: "https://api.example.com/v1",
    model: "model-a",
    enabled: true,
    ...overrides,
  };
}

describe("checkProviderReadiness", () => {
  it("allows default provider fallback when no explicit provider is selected", () => {
    expect(checkProviderReadiness(null)).toEqual({ ready: true, missing: [] });
  });

  it("requires api key, base url and model for a custom provider", () => {
    const result = checkProviderReadiness(provider({
      apiKey: "",
      baseUrl: "",
      model: "",
    }));

    expect(result.ready).toBe(false);
    expect(result.missing).toEqual(["apiKey", "baseUrl", "model"]);
  });

  it("does not require base url for a built-in provider", () => {
    const result = checkProviderReadiness(provider({
      id: "deepseek",
      baseUrl: "",
    }));

    expect(result).toEqual({ ready: true, missing: [] });
  });
});
