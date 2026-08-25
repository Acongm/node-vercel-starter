import type { AppConfig } from '../../config/app-config';
import {
  PLATFORM_RUNTIME_CONFIG_SCHEMA_VERSION,
  type PlatformRuntimeConfigBody,
  type PlatformRuntimeConfigDocument,
} from './platform-runtime-config.types';

const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_THINKING_MAX_TOKENS = 4096;

export function defaultPlatformRuntimeConfigBody(
  appConfig: AppConfig,
): PlatformRuntimeConfigBody {
  return {
    chat: {
      provider: appConfig.ai.provider,
      baseUrl: appConfig.ai.baseUrl,
      model: appConfig.ai.model,
      maxTokensDefault: DEFAULT_MAX_TOKENS,
      thinkingMaxTokens: DEFAULT_THINKING_MAX_TOKENS,
    },
    knowledgeBase: {
      summariesUrl: appConfig.portalSummariesUrl,
      portalServiceId:
        appConfig.serviceCallers.find((caller) => caller.id === 'portal-ci')?.id ||
        'portal-ci',
    },
    openApi: {
      enabled: true,
      completionsPathEnabled: true,
    },
    webSearch: {
      enabled: Boolean(appConfig.ai.webSearchApiKey),
    },
    callers: {
      allowedCallSources: [...appConfig.allowedCallSources],
      serviceCallers: appConfig.serviceCallers.map((caller) => ({ id: caller.id })),
    },
  };
}

export function defaultPlatformRuntimeConfigDocument(
  appConfig: AppConfig,
): PlatformRuntimeConfigDocument {
  return {
    schemaVersion: PLATFORM_RUNTIME_CONFIG_SCHEMA_VERSION,
    ...defaultPlatformRuntimeConfigBody(appConfig),
  };
}

export function mergePlatformRuntimeConfigBody(
  base: PlatformRuntimeConfigBody,
  patch: Partial<PlatformRuntimeConfigBody> | undefined,
): PlatformRuntimeConfigBody {
  if (!patch) return base;
  return {
    chat: { ...base.chat, ...(patch.chat ?? {}) },
    knowledgeBase: { ...base.knowledgeBase, ...(patch.knowledgeBase ?? {}) },
    openApi: { ...base.openApi, ...(patch.openApi ?? {}) },
    webSearch: { ...base.webSearch, ...(patch.webSearch ?? {}) },
    callers: {
      allowedCallSources:
        patch.callers?.allowedCallSources ?? base.callers.allowedCallSources,
      serviceCallers:
        patch.callers?.serviceCallers ?? base.callers.serviceCallers,
    },
  };
}

export function normalizePlatformRuntimeConfigBody(
  value: unknown,
  fallback: PlatformRuntimeConfigBody,
): PlatformRuntimeConfigBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }
  const row = value as Record<string, unknown>;
  const chat = asObject(row.chat);
  const knowledgeBase = asObject(row.knowledgeBase);
  const openApi = asObject(row.openApi);
  const webSearch = asObject(row.webSearch);
  const callers = asObject(row.callers);

  return {
    chat: {
      provider: asProvider(chat.provider, fallback.chat.provider),
      baseUrl: asUrl(chat.baseUrl, fallback.chat.baseUrl),
      model: asNonEmptyString(chat.model) ?? fallback.chat.model,
      maxTokensDefault: asPositiveInt(
        chat.maxTokensDefault,
        fallback.chat.maxTokensDefault,
      ),
      thinkingMaxTokens: asPositiveInt(
        chat.thinkingMaxTokens,
        fallback.chat.thinkingMaxTokens,
      ),
    },
    knowledgeBase: {
      summariesUrl: asUrl(
        knowledgeBase.summariesUrl,
        fallback.knowledgeBase.summariesUrl,
      ),
      portalServiceId:
        asNonEmptyString(knowledgeBase.portalServiceId) ??
        fallback.knowledgeBase.portalServiceId,
    },
    openApi: {
      enabled: asBoolean(openApi.enabled, fallback.openApi.enabled),
      completionsPathEnabled: asBoolean(
        openApi.completionsPathEnabled,
        fallback.openApi.completionsPathEnabled,
      ),
    },
    webSearch: {
      enabled: asBoolean(webSearch.enabled, fallback.webSearch.enabled),
    },
    callers: {
      allowedCallSources: asStringList(
        callers.allowedCallSources,
        fallback.callers.allowedCallSources,
      ),
      serviceCallers: asServiceCallers(
        callers.serviceCallers,
        fallback.callers.serviceCallers,
      ),
    },
  };
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asPositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function asUrl(value: unknown, fallback: string): string {
  const candidate = asNonEmptyString(value) ?? fallback;
  return candidate.replace(/\/+$/, '');
}

function asProvider(
  value: unknown,
  fallback: PlatformRuntimeConfigBody['chat']['provider'],
): PlatformRuntimeConfigBody['chat']['provider'] {
  return value === 'mock' || value === 'openai' || value === 'custom'
    ? value
    : fallback;
}

function asStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return items.length ? items : fallback;
}

function asServiceCallers(
  value: unknown,
  fallback: PlatformRuntimeConfigBody['callers']['serviceCallers'],
): PlatformRuntimeConfigBody['callers']['serviceCallers'] {
  if (!Array.isArray(value)) return fallback;
  const callers = value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const id = asNonEmptyString((item as Record<string, unknown>).id);
      return id ? { id } : null;
    })
    .filter((item): item is { id: string } => Boolean(item));
  return callers.length ? callers : fallback;
}

export function maskSecret(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 8) return '***';
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}
