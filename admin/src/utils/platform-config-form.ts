import type { PlatformRuntimeConfigPatch, PlatformRuntimeConfigView } from '../types';

export type PlatformConfigFormValues = {
  chatProvider: 'mock' | 'openai' | 'custom';
  chatBaseUrl: string;
  chatModel: string;
  maxTokensDefault: number;
  thinkingMaxTokens: number;
  summariesUrl: string;
  portalServiceId: string;
  openApiEnabled: boolean;
  openApiCompletionsEnabled: boolean;
  webSearchEnabled: boolean;
  allowedCallSources: string;
  serviceCallerIds: string;
  llmApiKey: string;
  webSearchApiKey: string;
  portalServiceKey: string;
  serviceCallerKeys: string;
};

export function toPlatformConfigFormValues(
  view: PlatformRuntimeConfigView,
): PlatformConfigFormValues {
  return {
    chatProvider: view.config.chat.provider,
    chatBaseUrl: view.config.chat.baseUrl,
    chatModel: view.config.chat.model,
    maxTokensDefault: view.config.chat.maxTokensDefault,
    thinkingMaxTokens: view.config.chat.thinkingMaxTokens,
    summariesUrl: view.config.knowledgeBase.summariesUrl,
    portalServiceId: view.config.knowledgeBase.portalServiceId,
    openApiEnabled: view.config.openApi.enabled,
    openApiCompletionsEnabled: view.config.openApi.completionsPathEnabled,
    webSearchEnabled: view.config.webSearch.enabled,
    allowedCallSources: view.config.callers.allowedCallSources.join(','),
    serviceCallerIds: view.config.callers.serviceCallers.map((caller) => caller.id).join(','),
    llmApiKey: '',
    webSearchApiKey: '',
    portalServiceKey: '',
    serviceCallerKeys: '',
  };
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function buildPlatformConfigPatch(
  values: PlatformConfigFormValues,
): PlatformRuntimeConfigPatch {
  const patch: PlatformRuntimeConfigPatch = {
    config: {
      chat: {
        provider: values.chatProvider,
        baseUrl: values.chatBaseUrl.trim(),
        model: values.chatModel.trim(),
        maxTokensDefault: values.maxTokensDefault,
        thinkingMaxTokens: values.thinkingMaxTokens,
      },
      knowledgeBase: {
        summariesUrl: values.summariesUrl.trim(),
        portalServiceId: values.portalServiceId.trim(),
      },
      openApi: {
        enabled: values.openApiEnabled,
        completionsPathEnabled: values.openApiCompletionsEnabled,
      },
      webSearch: {
        enabled: values.webSearchEnabled,
      },
      callers: {
        allowedCallSources: splitCsv(values.allowedCallSources),
        serviceCallers: splitCsv(values.serviceCallerIds).map((id) => ({ id })),
      },
    },
    secrets: {},
    serviceCallerKeys: [],
  };

  if (values.llmApiKey.trim()) {
    patch.secrets!['llm.api_key'] = values.llmApiKey.trim();
  }
  if (values.webSearchApiKey.trim()) {
    patch.secrets!['web_search.api_key'] = values.webSearchApiKey.trim();
  }
  if (values.portalServiceKey.trim()) {
    patch.secrets!['kb.portal_service_key'] = values.portalServiceKey.trim();
  }

  const keyLines = values.serviceCallerKeys
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of keyLines) {
    const sep = line.indexOf(':');
    if (sep <= 0) continue;
    const id = line.slice(0, sep).trim();
    const key = line.slice(sep + 1).trim();
    if (!id || !key) continue;
    patch.serviceCallerKeys!.push({ id, key });
  }

  return patch;
}

export function formSubmitErrorMessage(error: unknown): string | null {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (
    error &&
    typeof error === 'object' &&
    'errorFields' in error &&
    Array.isArray((error as { errorFields?: unknown }).errorFields)
  ) {
    return '请检查必填项';
  }
  return null;
}
