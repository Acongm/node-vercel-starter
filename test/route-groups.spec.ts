import { resolveRouteGroup, ROUTE_GROUP_ORDER } from '../src/modules/admin-insights/route-groups';

describe('route-groups', () => {
  it('maps common API prefixes to readable groups', () => {
    expect(resolveRouteGroup('/api/health', 'HealthController')).toEqual({
      group: 'system',
      groupLabel: '系统 / 健康检查',
    });
    expect(resolveRouteGroup('/api/auth/session', 'AuthController')).toEqual({
      group: 'auth',
      groupLabel: '认证与会话',
    });
    expect(resolveRouteGroup('/api/admin/routes', 'AdminInsightsController')).toEqual({
      group: 'admin',
      groupLabel: '管理后台',
    });
    expect(resolveRouteGroup('/api/ai/v1/chat', 'AiV1Controller')).toEqual({
      group: 'ai',
      groupLabel: 'AI / Chat API',
    });
    expect(resolveRouteGroup('/api/chats/:id/messages/stream', 'ChatController')).toEqual({
      group: 'chats',
      groupLabel: '对话（Chat Threads）',
    });
    expect(resolveRouteGroup('/v1/chat/completions', 'OpenAiCompatibleController')).toEqual({
      group: 'openai',
      groupLabel: 'OpenAPI 兼容',
    });
  });

  it('orders groups for the admin debug tree', () => {
    expect(ROUTE_GROUP_ORDER.indexOf('system')).toBeLessThan(
      ROUTE_GROUP_ORDER.indexOf('auth'),
    );
    expect(ROUTE_GROUP_ORDER.indexOf('ai')).toBeLessThan(
      ROUTE_GROUP_ORDER.indexOf('admin'),
    );
  });
});
