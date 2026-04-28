import type { AiProvider } from "../app-manager";

interface ResolveGenerationProviderOptions {
  providers: AiProvider[];
  primaryProviderId?: string;
  fallbackProviderId?: string;
  activeProviderId?: string;
}

function hasApiKey(provider: AiProvider | undefined): provider is AiProvider {
  return Boolean(provider?.apiKey);
}

function isEnabledProvider(provider: AiProvider | undefined): provider is AiProvider {
  return Boolean(provider?.enabled && provider.apiKey);
}

export function resolveGenerationProvider(options: ResolveGenerationProviderOptions): AiProvider | null {
  const { providers, primaryProviderId, fallbackProviderId, activeProviderId } = options;
  const byId = (id?: string) => providers.find((provider) => provider.id === id);

  return (
    (hasApiKey(byId(primaryProviderId)) ? byId(primaryProviderId) : null) ??
    (hasApiKey(byId(fallbackProviderId)) ? byId(fallbackProviderId) : null) ??
    (isEnabledProvider(byId(activeProviderId)) ? byId(activeProviderId) : null) ??
    providers.find(isEnabledProvider) ??
    null
  );
}
