import type { AiProvider } from "../app-manager";

interface ResolveGenerationProviderOptions {
  providers: AiProvider[];
  primaryProviderId?: string;
  fallbackProviderId?: string;
  activeProviderId?: string;
}

function isUsableProvider(provider: AiProvider | undefined): provider is AiProvider {
  return Boolean(provider?.enabled && provider.apiKey);
}

export function resolveGenerationProvider(options: ResolveGenerationProviderOptions): AiProvider | null {
  const { providers, primaryProviderId, fallbackProviderId, activeProviderId } = options;
  const byId = (id?: string) => providers.find((provider) => provider.id === id);

  return (
    (isUsableProvider(byId(primaryProviderId)) ? byId(primaryProviderId) : null) ??
    (isUsableProvider(byId(fallbackProviderId)) ? byId(fallbackProviderId) : null) ??
    (isUsableProvider(byId(activeProviderId)) ? byId(activeProviderId) : null) ??
    providers.find(isUsableProvider) ??
    null
  );
}
