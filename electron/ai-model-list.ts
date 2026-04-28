import type { AiProvider } from "./app-manager";
import { KNOWN_AI_MODELS } from "./known-ai-models";

export async function listAvailableModels(provider: AiProvider): Promise<string[]> {
  if (!provider.apiKey?.trim()) return [];

  const knownList = KNOWN_AI_MODELS[provider.id];
  if (knownList) return knownList;

  try {
    return await listOpenAICompatibleModels(provider);
  } catch {
    return [];
  }
}

export async function listOpenAICompatibleModels(provider: AiProvider): Promise<string[]> {
  const base = provider.baseUrl.replace(/\/+$/, "");
  const url = `${base}/models`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${provider.apiKey}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { data?: Array<{ id?: string }> };
  if (!Array.isArray(data.data)) return [];
  return data.data
    .map((m) => m.id ?? "")
    .filter((id) => id.length > 0)
    .sort((a, b) => a.localeCompare(b));
}

