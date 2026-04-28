import { describe, expect, it } from "vitest";
import { KNOWN_AI_MODELS } from "../known-ai-models";

describe("known AI model catalog", () => {
  it("keeps common provider model lists available for offline selection", () => {
    expect(KNOWN_AI_MODELS.openai).toContain("gpt-5.5");
    expect(KNOWN_AI_MODELS.anthropic).toContain("claude-sonnet-4-6");
    expect(KNOWN_AI_MODELS.qwen).toContain("qwen-plus");
  });

  it("does not expose empty provider catalogs", () => {
    for (const [providerId, models] of Object.entries(KNOWN_AI_MODELS)) {
      expect(providerId.length).toBeGreaterThan(0);
      expect(models.length).toBeGreaterThan(0);
    }
  });
});

