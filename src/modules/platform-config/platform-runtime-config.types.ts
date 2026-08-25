import type { AiProvider } from '../../config/app-config';

export const PLATFORM_RUNTIME_CONFIG_SCHEMA_VERSION = 1;

export const PLATFORM_SECRET_NAMES = [
  'llm.api_key',
  'web_search.api_key',
  'kb.portal_service_key',
] as const;

export type PlatformSecretName = (typeof PLATFORM_SECRET_NAMES)[number];

export type PlatformServiceCallerConfig = {
  id: string;
};

export type PlatformRuntimeConfigBody = {
  chat: {
    provider: AiProvider;
    baseUrl: string;
    model: string;
    maxTokensDefault: number;
    thinkingMaxTokens: number;
  };
  knowledgeBase: {
    summariesUrl: string;
    portalServiceId: string;
  };
  openApi: {
    enabled: boolean;
    completionsPathEnabled: boolean;
  };
  webSearch: {
    enabled: boolean;
  };
  callers: {
    allowedCallSources: string[];
    serviceCallers: PlatformServiceCallerConfig[];
  };
};

export type PlatformRuntimeConfigDocument = PlatformRuntimeConfigBody & {
  schemaVersion: number;
};

export type PlatformSecretStatus = {
  configured: boolean;
  preview: string | null;
};

export type PlatformRuntimeConfigAdminView = {
  schemaVersion: number;
  config: PlatformRuntimeConfigBody;
  secrets: Record<string, PlatformSecretStatus>;
  serviceCallerSecrets: Array<{
    id: string;
    configured: boolean;
    preview: string | null;
  }>;
  source: 'database' | 'environment';
  updatedAt: string | null;
};

export type PlatformRuntimeConfigPatch = {
  config?: Partial<PlatformRuntimeConfigBody>;
  secrets?: Partial<Record<PlatformSecretName, string | null>>;
  serviceCallerKeys?: Array<{ id: string; key: string | null }>;
};

export function serviceCallerSecretName(id: string): string {
  return `service_caller:${id.trim()}`;
}

export function isPlatformSecretName(value: string): value is PlatformSecretName {
  return (PLATFORM_SECRET_NAMES as readonly string[]).includes(value);
}
