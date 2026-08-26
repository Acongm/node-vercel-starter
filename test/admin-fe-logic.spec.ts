import { formatApiError } from '../admin/src/utils/api-error';
import {
  buildPlatformConfigPatch,
  formSubmitErrorMessage,
  toPlatformConfigFormValues,
} from '../admin/src/utils/platform-config-form';
import {
  buildDataTablePath,
  parseDataTableKey,
  preventNativeSubmit,
  stringParam,
} from '../admin/src/utils/table-query';
import { groupAdminRoutes } from '../admin/src/utils/route-groups';

describe('admin frontend form and table helpers', () => {
  it('builds a PUT payload the platform-config API can persist', () => {
    const patch = buildPlatformConfigPatch({
      chatProvider: 'custom',
      chatBaseUrl: ' https://api.deepseek.com/v1 ',
      chatModel: 'deepseek-v4-flash',
      maxTokensDefault: 2048,
      thinkingMaxTokens: 4096,
      summariesUrl: 'https://www.acongm.com/summaries-v1.json',
      portalServiceId: 'portal-ci',
      openApiEnabled: true,
      openApiCompletionsEnabled: false,
      webSearchEnabled: true,
      allowedCallSources: 'portal:, chat-site',
      serviceCallerIds: 'portal-ci, portal-bff',
      llmApiKey: ' sk-test ',
      webSearchApiKey: '',
      portalServiceKey: '',
      serviceCallerKeys: 'portal-ci:secret-one\nportal-bff:secret-two',
    });

    expect(patch.config?.chat).toEqual({
      provider: 'custom',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-flash',
      maxTokensDefault: 2048,
      thinkingMaxTokens: 4096,
    });
    expect(patch.secrets).toEqual({ 'llm.api_key': 'sk-test' });
    expect(patch.serviceCallerKeys).toEqual([
      { id: 'portal-ci', key: 'secret-one' },
      { id: 'portal-bff', key: 'secret-two' },
    ]);
  });

  it('reloads saved config back into empty secret fields', () => {
    const values = toPlatformConfigFormValues({
      schemaVersion: 1,
      config: {
        chat: {
          provider: 'openai',
          baseUrl: 'https://api.openai.com/v1',
          model: 'gpt-test',
          maxTokensDefault: 512,
          thinkingMaxTokens: 1024,
        },
        knowledgeBase: {
          summariesUrl: 'https://www.acongm.com/summaries-v1.json',
          portalServiceId: 'portal-ci',
        },
        openApi: { enabled: true, completionsPathEnabled: true },
        webSearch: { enabled: false },
        callers: {
          allowedCallSources: ['portal:'],
          serviceCallers: [{ id: 'portal-ci' }],
        },
      },
      secrets: {},
      serviceCallerSecrets: [],
      source: 'database',
      updatedAt: '2026-08-26T00:00:00.000Z',
    });

    expect(values.chatModel).toBe('gpt-test');
    expect(values.llmApiKey).toBe('');
    expect(values.serviceCallerIds).toBe('portal-ci');
  });

  it('surfaces API error bodies and form validation failures', () => {
    expect(
      formatApiError(
        {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          durationMs: 12,
          body: { message: ['property config should not exist'] },
        },
        '保存失败',
      ),
    ).toBe('property config should not exist');

    expect(formSubmitErrorMessage({ errorFields: [{ name: ['chatModel'] }] })).toBe(
      '请检查必填项',
    );
    expect(formSubmitErrorMessage(new Error('Supabase is required'))).toBe(
      'Supabase is required',
    );
  });

  it('keeps table search on the same /data page instead of remounting a new route', () => {
    expect(buildDataTablePath('chat_logs')).toBe('/data?table=chat_logs');
    expect(parseDataTableKey('/data?table=chat_logs', undefined)).toBe('chat_logs');
    expect(parseDataTableKey('/data', 'chat_logs')).toBe('chat_logs');
  });

  it('reads only string query params from table request payloads', () => {
    expect(stringParam('chat_logs')).toBe('chat_logs');
    expect(stringParam('  ')).toBeUndefined();
    expect(stringParam(12)).toBeUndefined();
  });

  it('prevents native form submit so table query does not reload the page', () => {
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };
    preventNativeSubmit(event);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('groups debug routes by product label instead of controller names', () => {
    const tree = groupAdminRoutes([
      {
        method: 'GET',
        path: '/api/admin/chat/logs',
        controllerName: 'ChatAdminController',
        handlerName: 'listLogs',
        group: 'admin-chat',
        groupLabel: '管理 · 对话',
      },
      {
        method: 'PUT',
        path: '/api/admin/platform-config',
        controllerName: 'PlatformConfigAdminController',
        handlerName: 'updateConfig',
        group: 'admin-platform',
        groupLabel: '管理 · 平台配置',
      },
    ]);

    expect(tree.map((node) => node.title)).toEqual([
      '管理 · 对话',
      '管理 · 平台配置',
    ]);
    expect(tree[0]?.children[0]?.key).toBe('GET:/api/admin/chat/logs');
  });
});
