import { afterEach, describe, expect, it, vi } from "vitest";
import {
  testAiConnection,
  testAnthropicConnection,
  testOpenAICompatibleConnection,
} from "../ai-connection-test";
import type { AiProvider } from "../app-manager";

function provider(overrides: Partial<AiProvider> = {}): AiProvider {
  return {
    id: "openai",
    name: "OpenAI",
    apiKey: "sk-test",
    baseUrl: "https://example.test/v1",
    model: "gpt-test",
    enabled: true,
    ...overrides,
  };
}

describe("AI connection testing", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects missing API keys before network calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(testAiConnection(provider({ apiKey: "" }))).rejects.toThrow("未配置 API Key");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts a minimal OpenAI-compatible chat completion request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);

    await expect(testOpenAICompatibleConnection(provider())).resolves.toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalledWith("https://example.test/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer sk-test",
      },
      body: JSON.stringify({
        model: "gpt-test",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
        temperature: 0,
      }),
    });
  });

  it("does not append chat/completions when base URL already points to it", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);

    await testOpenAICompatibleConnection(provider({ baseUrl: "https://example.test/v1/chat/completions" }));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.test/v1/chat/completions",
      expect.any(Object),
    );
  });

  it("posts a minimal Anthropic messages request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);

    await expect(testAnthropicConnection(provider({
      id: "anthropic",
      name: "Anthropic",
      baseUrl: "https://anthropic.test",
      model: "claude-test",
    }))).resolves.toBeUndefined();

    expect(globalThis.fetch).toHaveBeenCalledWith("https://anthropic.test/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "sk-test",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-test",
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      }),
    });
  });

  it("surfaces provider response bodies on failed connection tests", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "bad key",
    } as Response);

    await expect(testAiConnection(provider())).rejects.toThrow("OpenAI API (401): bad key");
  });
});

