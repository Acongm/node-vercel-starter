export type RouteGroupMeta = {
  group: string;
  groupLabel: string;
};

const ROUTE_GROUP_RULES: Array<RouteGroupMeta & { prefix: string }> = [
  { prefix: '/api/health', group: 'system', groupLabel: '系统 / 健康检查' },
  { prefix: '/api/auth', group: 'auth', groupLabel: '认证与会话' },
  { prefix: '/api/admin', group: 'admin', groupLabel: '管理后台' },
  { prefix: '/api/ai', group: 'ai', groupLabel: 'AI / Chat API' },
  { prefix: '/api/chats', group: 'chats', groupLabel: '对话（Chat Threads）' },
  { prefix: '/api/users', group: 'users', groupLabel: '用户与设置' },
  { prefix: '/v1/', group: 'openai', groupLabel: 'OpenAPI 兼容' },
];

const CONTROLLER_GROUP_LABELS: Record<string, string> = {
  HealthController: '系统 / 健康检查',
  AuthController: '认证与会话',
  AdminInsightsController: '管理后台 / 洞察',
  AdminTablesController: '管理后台 / 数据表',
  PlatformConfigAdminController: '管理后台 / 平台配置',
  AiController: 'AI',
  AiV1Controller: 'AI v1',
  OpenAiCompatibleController: 'OpenAPI 兼容',
  ChatController: '对话（Chat Threads）',
  ChatThreadsController: '对话线程',
  UserController: '用户与设置',
};

export const ROUTE_GROUP_ORDER = [
  'system',
  'auth',
  'ai',
  'chats',
  'users',
  'admin',
  'openai',
  'other',
] as const;

export function resolveRouteGroup(
  path: string,
  controllerName: string,
): RouteGroupMeta {
  for (const rule of ROUTE_GROUP_RULES) {
    if (path.startsWith(rule.prefix)) {
      return { group: rule.group, groupLabel: rule.groupLabel };
    }
  }

  const controllerLabel = CONTROLLER_GROUP_LABELS[controllerName];
  if (controllerLabel) {
    return {
      group: controllerName,
      groupLabel: controllerLabel,
    };
  }

  return { group: 'other', groupLabel: '其他' };
}
