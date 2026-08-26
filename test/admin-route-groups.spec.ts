import { classifyApiRouteGroup } from '../src/modules/admin-insights/helpers/api-route-group';

describe('classifyApiRouteGroup', () => {
  it('groups admin and public APIs by product domain, not controller class names', () => {
    expect(classifyApiRouteGroup('/api/admin/chat/logs')).toEqual({
      group: 'admin-chat',
      groupLabel: '管理 · 对话',
    });
    expect(classifyApiRouteGroup('/api/admin/kb/jobs')).toEqual({
      group: 'admin-kb',
      groupLabel: '管理 · 知识库',
    });
    expect(classifyApiRouteGroup('/api/admin/users')).toEqual({
      group: 'admin-users',
      groupLabel: '管理 · 用户',
    });
    expect(classifyApiRouteGroup('/api/admin/platform-config')).toEqual({
      group: 'admin-platform',
      groupLabel: '管理 · 平台配置',
    });
    expect(classifyApiRouteGroup('/api/admin/request-logs')).toEqual({
      group: 'admin-monitor',
      groupLabel: '管理 · 接口监控',
    });
    expect(classifyApiRouteGroup('/api/admin/tables/chat_logs')).toEqual({
      group: 'admin-data',
      groupLabel: '管理 · 数据表',
    });
    expect(classifyApiRouteGroup('/api/chats')).toEqual({
      group: 'chat',
      groupLabel: '对话',
    });
    expect(classifyApiRouteGroup('/api/auth/session')).toEqual({
      group: 'auth',
      groupLabel: '认证',
    });
    expect(classifyApiRouteGroup('/api/ai/v1/chat/completions')).toEqual({
      group: 'ai',
      groupLabel: 'AI',
    });
    expect(classifyApiRouteGroup('/api/health')).toEqual({
      group: 'health',
      groupLabel: '健康检查',
    });
  });

  it('keeps a stable order for debug-page tree rendering', () => {
    const labels = [
      classifyApiRouteGroup('/api/health').groupLabel,
      classifyApiRouteGroup('/api/auth/login').groupLabel,
      classifyApiRouteGroup('/api/chats').groupLabel,
      classifyApiRouteGroup('/api/admin/overview').groupLabel,
    ];
    expect(labels).toEqual(['健康检查', '认证', '对话', '管理 · 概览']);
  });
});
