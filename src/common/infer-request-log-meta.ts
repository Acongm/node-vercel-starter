export type InferCallSourceInput = {
  header?: string;
  origin?: string;
  referer?: string;
  path: string;
};

export function hostFromUrl(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function inferCallSource(input: InferCallSourceInput): string {
  const explicit = input.header?.trim();
  if (explicit) {
    return explicit;
  }

  const host = hostFromUrl(input.origin) ?? hostFromUrl(input.referer);
  if (host) {
    if (host === 'auth.acongm.com') {
      return 'auth:web';
    }
    if (host === 'api.acongm.com') {
      return 'admin:api';
    }
    if (host.endsWith('acongm.com')) {
      return 'portal:web';
    }
    return `external:${host}`;
  }

  if (input.path.startsWith('/api/admin')) {
    return 'admin:api';
  }
  if (input.path.startsWith('/api/auth')) {
    return 'auth:api';
  }
  if (
    input.path.startsWith('/api/chats') ||
    input.path.startsWith('/v1/chat') ||
    input.path.startsWith('/api/openai')
  ) {
    return 'chat:api';
  }
  if (input.path.startsWith('/api/user')) {
    return 'user:api';
  }

  return 'unknown';
}
