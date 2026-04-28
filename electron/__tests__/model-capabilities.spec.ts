import { describe, expect, it } from "vitest";
import {
  getModelCapabilityInfo,
  getModelOutputKind,
  isImageGenerationModel,
  normalizeModelId,
} from "../model-capabilities";
import type { AiProvider } from "../app-manager";

function provider(model: string): AiProvider {
  return {
    id: "custom",
    name: "Custom",
    apiKey: "key",
    baseUrl: "https://api.example.com/v1",
    model,
    enabled: true,
  };
}

describe("model capabilities", () => {
  it("normalizes provider-prefixed model ids", () => {
    expect(normalizeModelId("openai/gpt-image-2")).toBe("gpt-image-2");
    expect(normalizeModelId("  QWEN/QWEN3.6-PLUS  ")).toBe("qwen3.6-plus");
  });

  it("classifies image output models", () => {
    expect(getModelCapabilityInfo("gpt-image-2")).toMatchObject({
      outputKind: "image",
      capabilities: ["image-output"],
    });
    expect(isImageGenerationModel(provider("qwen-image-plus"))).toBe(true);
    expect(isImageGenerationModel(provider("doubao-seedream-4-5-251128"))).toBe(true);
  });

  it("classifies text output models", () => {
    expect(getModelOutputKind(provider("deepseek-v4-pro"))).toBe("text");
    expect(getModelOutputKind(provider("gpt-5.2"))).toBe("text");
    expect(isImageGenerationModel(provider("claude-sonnet-4-5"))).toBe(false);
  });

  it("marks vision-input text models without treating them as image output", () => {
    expect(getModelCapabilityInfo("gpt-4o")).toEqual({
      model: "gpt-4o",
      outputKind: "text",
      capabilities: ["text-output", "vision-input"],
    });
    expect(getModelCapabilityInfo("qwen3-vl-plus")).toEqual({
      model: "qwen3-vl-plus",
      outputKind: "text",
      capabilities: ["text-output", "vision-input"],
    });
  });

  it("keeps unknown models on the existing text-compatible fallback path", () => {
    expect(getModelOutputKind(provider("vendor-new-chat-model"))).toBe("unknown");
    expect(isImageGenerationModel(provider("vendor-new-chat-model"))).toBe(false);
  });
});
