export type RouteGroup = 'auth' | 'chat' | 'admin' | 'ai' | 'other';

export interface RequestRouteMeta {
  routeGroup: RouteGroup;
  isStream: boolean;
}

const STREAM_SUFFIX = '/stream';

export function classifyRequestRoute(path: string): RequestRouteMeta {
  const isStream =
    path.includes(STREAM_SUFFIX) ||
    path.endsWith('/messages/stream') ||
    path.endsWith('/chat/stream');

  if (path.startsWith('/api/auth') || path.startsWith('/api/user')) {
    return { routeGroup: 'auth', isStream };
  }

  if (
    path.startsWith('/api/chats') ||
    path.startsWith('/api/chat/') ||
    path.startsWith('/api/ai/chat') ||
    path.startsWith('/api/ai/v1')
  ) {
    return { routeGroup: 'chat', isStream };
  }

  if (path.startsWith('/api/admin')) {
    return { routeGroup: 'admin', isStream };
  }

  if (path.startsWith('/api/ai')) {
    return { routeGroup: 'ai', isStream };
  }

  return { routeGroup: 'other', isStream };
}
