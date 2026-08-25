import { loadAppConfig } from '../src/config/app-config';
import {
  defaultPlatformRuntimeConfigBody,
  normalizePlatformRuntimeConfigBody,
} from '../src/modules/platform-config/platform-runtime-config.defaults';

describe('platform runtime config defaults', () => {
  it('maps env defaults into structured config body', () => {
    const appConfig = loadAppConfig({
      AI_PROVIDER: 'custom',
      AI_BASE_URL: 'https://api.deepseek.com/v1',
      AI_MODEL: 'deepseek-v4-flash',
      PORTAL_SUMMARIES_URL: 'https://www.acongm.com/summaries-v1.json',
      SERVICE_CALLERS: 'portal-ci:test-secret',
      ALLOWED_CALL_SOURCES: 'portal:,chat-site',
      WEB_SEARCH_API_KEY: 'tavily-test',
    });

    const body = defaultPlatformRuntimeConfigBody(appConfig);
    expect(body.chat.provider).toBe('custom');
    expect(body.chat.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(body.chat.model).toBe('deepseek-v4-flash');
    expect(body.knowledgeBase.summariesUrl).toBe(
      'https://www.acongm.com/summaries-v1.json',
    );
    expect(body.webSearch.enabled).toBe(true);
    expect(body.callers.allowedCallSources).toEqual(['portal:', 'chat-site']);
    expect(body.callers.serviceCallers).toEqual([{ id: 'portal-ci' }]);
  });

  it('normalizes partial config patches', () => {
    const fallback = defaultPlatformRuntimeConfigBody(loadAppConfig({}));
    const normalized = normalizePlatformRuntimeConfigBody(
      {
        chat: { model: 'gpt-test' },
        callers: { allowedCallSources: ['chat-site'] },
      },
      fallback,
    );
    expect(normalized.chat.model).toBe('gpt-test');
    expect(normalized.callers.allowedCallSources).toEqual(['chat-site']);
    expect(normalized.chat.provider).toBe(fallback.chat.provider);
  });
});
