import type { AiProvider } from "./app-manager";

export async function testAiConnection(provider: AiProvider): Promise<void> {
  if (!provider.apiKey?.trim()) throw new Error("未配置 API Key");
  return provider.id === "anthropic"
    ? testAnthropicConnection(provider)
    : testOpenAICompatibleConnection(provider);
}

export async function testOpenAICompatibleConnection(provider: AiProvider): Promise<void> {
  const base = provider.baseUrl.replace(/\/+$/, "");
  const url = base.endsWith("/chat/completions")
    ? base
    : `${base}/chat/completions`;
  if (!provider.model?.trim()) throw new Error("未配置模型名称");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 5,
      temperature: 0,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "Unknown error");
    throw new Error(`${provider.name} API (${res.status}): ${t}`);
  }
}

export async function testAnthropicConnection(provider: AiProvider): Promise<void> {
  const url = `${provider.baseUrl.replace(/\/+$/, "")}/v1/messages`;
  if (!provider.model?.trim()) throw new Error("未配置模型名称");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": provider.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "user", content: "Hi" }],
      max_tokens: 5,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "Unknown error");
    throw new Error(`Anthropic API (${res.status}): ${t}`);
  }
}

