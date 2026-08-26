export type ApiRouteGroup = {
  group: string;
  groupLabel: string;
};

const ROUTE_GROUPS: Array<{ prefix: string; group: string; groupLabel: string }> = [
  { prefix: '/api/admin/platform-config', group: 'admin-platform', groupLabel: '管理 · 平台配置' },
  { prefix: '/api/admin/request-logs', group: 'admin-monitor', groupLabel: '管理 · 接口监控' },
  { prefix: '/api/admin/tables', group: 'admin-data', groupLabel: '管理 · 数据表' },
  { prefix: '/api/admin/overview', group: 'admin-overview', groupLabel: '管理 · 概览' },
  { prefix: '/api/admin/routes', group: 'admin-debug', groupLabel: '管理 · 接口调试' },
  { prefix: '/api/admin/chat', group: 'admin-chat', groupLabel: '管理 · 对话' },
  { prefix: '/api/admin/kb', group: 'admin-kb', groupLabel: '管理 · 知识库' },
  { prefix: '/api/admin/users', group: 'admin-users', groupLabel: '管理 · 用户' },
  { prefix: '/api/admin', group: 'admin', groupLabel: '管理' },
  { prefix: '/api/auth', group: 'auth', groupLabel: '认证' },
  { prefix: '/api/user', group: 'user', groupLabel: '用户中心' },
  { prefix: '/api/chats', group: 'chat', groupLabel: '对话' },
  { prefix: '/api/chat', group: 'chat', groupLabel: '对话' },
  { prefix: '/api/ai', group: 'ai', groupLabel: 'AI' },
  { prefix: '/api/health', group: 'health', groupLabel: '健康检查' },
  { prefix: '/api/config', group: 'config', groupLabel: '站点配置' },
  { prefix: '/api/comments', group: 'comments', groupLabel: '评论' },
  { prefix: '/api/upload', group: 'upload', groupLabel: '上传' },
  { prefix: '/api/proxy', group: 'proxy', groupLabel: '代理' },
  { prefix: '/v1', group: 'openapi', groupLabel: 'OpenAPI' },
];

export const API_ROUTE_GROUP_ORDER = ROUTE_GROUPS.map((item) => item.group).filter(
  (group, index, all) => all.indexOf(group) === index,
);

export function classifyApiRouteGroup(path: string): ApiRouteGroup {
  const normalized = path.split('?')[0] || path;
  const match = ROUTE_GROUPS.find((item) => {
    return normalized === item.prefix || normalized.startsWith(`${item.prefix}/`);
  });

  if (match) {
    return { group: match.group, groupLabel: match.groupLabel };
  }

  return { group: 'other', groupLabel: '其他' };
}
