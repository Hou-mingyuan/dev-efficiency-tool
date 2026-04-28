export interface ProviderReadinessResult {
  ready: boolean;
  missing: Array<"apiKey" | "baseUrl" | "model">;
}

export function checkProviderReadiness(provider: AiProvider | null | undefined): ProviderReadinessResult {
  if (!provider) {
    return { ready: true, missing: [] };
  }

  const missing: ProviderReadinessResult["missing"] = [];
  if (!provider.apiKey?.trim()) missing.push("apiKey");
  if (provider.id === "custom" && !provider.baseUrl?.trim()) missing.push("baseUrl");
  if (!provider.model?.trim()) missing.push("model");

  return { ready: missing.length === 0, missing };
}
