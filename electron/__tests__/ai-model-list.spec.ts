import { afterEach, describe, expect, it, vi } from "vitest";
import { listAvailableModels, listOpenAICompatibleModels } from "../ai-model-list";
import type { AiProvider } from "../app-manager";

function provider(overrides: Partial<AiProvider> = {}): AiProvider {
  return {
    id: "custom",
    name: "Custom",
    apiKey: "sk-test",
    baseUrl: "https://example.test/v1",
    model: "custom-model",
    enabled: true,
    ...overrides,
  };
}

describe("AI model listing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an empty list when API key is missing", async () => {
    await expect(listAvailableModels(provider({ apiKey: "" }))).resolves.toEqual([]);
  });

  it("returns known provider models without network calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const models = await listAvailableModels(provider({ id: "openai" }));

    expect(models).toContain("gpt-5.5");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("normalizes and sorts OpenAI-compatible /models responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ id: "z-model" }, { id: "" }, {}, { id: "a-model" }],
      }),
    } as Response);

    await expect(listOpenAICompatibleModels(provider())).resolves.toEqual(["a-model", "z-model"]);
    expect(globalThis.fetch).toHaveBeenCalledWith("https://example.test/v1/models", {
      method: "GET",
      headers: { Authorization: "Bearer sk-test" },
    });
  });

  it("hides remote model-list errors behind an empty list", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));

    await expect(listAvailableModels(provider())).resolves.toEqual([]);
  });
});

