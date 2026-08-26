import type { AdminRouteEntry } from '../types';

export type AdminRouteGroupNode = {
  key: string;
  title: string;
  children: Array<{
    key: string;
    title: string;
    method: string;
    path: string;
    route: AdminRouteEntry;
  }>;
};

const GROUP_ORDER = [
  'health',
  'auth',
  'user',
  'chat',
  'ai',
  'admin-overview',
  'admin-debug',
  'admin-chat',
  'admin-kb',
  'admin-users',
  'admin-platform',
  'admin-monitor',
  'admin-data',
  'admin',
  'config',
  'comments',
  'upload',
  'proxy',
  'openapi',
  'other',
];

function routeKey(route: AdminRouteEntry): string {
  return `${route.method}:${route.path}`;
}

function groupId(route: AdminRouteEntry): string {
  return route.group || route.controllerName || 'other';
}

function groupTitle(route: AdminRouteEntry): string {
  return route.groupLabel || route.controllerName || '其他';
}

export function groupAdminRoutes(routes: AdminRouteEntry[]): AdminRouteGroupNode[] {
  const grouped = new Map<string, AdminRouteGroupNode>();

  for (const route of routes) {
    const id = groupId(route);
    const existing = grouped.get(id);
    const child = {
      key: routeKey(route),
      title: route.path,
      method: route.method,
      path: route.path,
      route,
    };
    if (existing) {
      existing.children.push(child);
      continue;
    }
    grouped.set(id, {
      key: id,
      title: groupTitle(route),
      children: [child],
    });
  }

  return [...grouped.values()].sort((left, right) => {
    const leftIndex = GROUP_ORDER.indexOf(left.key);
    const rightIndex = GROUP_ORDER.indexOf(right.key);
    const safeLeft = leftIndex === -1 ? GROUP_ORDER.length : leftIndex;
    const safeRight = rightIndex === -1 ? GROUP_ORDER.length : rightIndex;
    if (safeLeft !== safeRight) {
      return safeLeft - safeRight;
    }
    return left.title.localeCompare(right.title, 'zh-CN');
  });
}
