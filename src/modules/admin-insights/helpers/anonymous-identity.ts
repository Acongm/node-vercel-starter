export const ANONYMOUS_GRACE_MS = 15 * 60 * 1000;
export const GA_CLIENT_ID_PATTERN = /^GA1\.\d+\.[A-Za-z0-9]+\.\d+$/;

export type AnonymousActivity = 'active' | 'ghost' | 'all';

export type AnonymousUserLike = {
  id: string;
  is_anonymous?: boolean;
  created_at?: string;
  user_metadata?: Record<string, unknown> | null;
  identities?: Array<{ provider?: string | null } | null> | null;
};

export type ClassifiedAnonymousUser = AnonymousUserLike & {
  cid?: string;
  hasChats: boolean;
  isGhost: boolean;
};

export function isGaClientId(value: string | undefined): boolean {
  return Boolean(value && GA_CLIENT_ID_PATTERN.test(value));
}

export function readUserCid(user: AnonymousUserLike): string | undefined {
  const raw = user.user_metadata?.cid;
  if (typeof raw !== 'string') return undefined;
  const cid = raw.trim();
  return cid ? cid : undefined;
}

function hasLinkedIdentity(user: AnonymousUserLike): boolean {
  return (user.identities ?? []).some(
    (identity) => identity?.provider && identity.provider !== 'anonymous',
  );
}

export function isGhostAnonymousUser(
  user: AnonymousUserLike,
  options: {
    chatUserIds: Set<string>;
    nowMs: number;
    graceMs?: number;
  },
): boolean {
  if (!user.is_anonymous) return false;
  if (options.chatUserIds.has(user.id)) return false;
  if (hasLinkedIdentity(user)) return false;

  const created = Date.parse(user.created_at ?? '');
  if (Number.isNaN(created)) return false;

  const graceMs = options.graceMs ?? ANONYMOUS_GRACE_MS;
  return options.nowMs - created > graceMs;
}

export function classifyAnonymousUsers<T extends AnonymousUserLike>(
  users: T[],
  options: {
    chatUserIds: Set<string>;
    activity: AnonymousActivity;
    nowMs: number;
    q?: string;
    graceMs?: number;
  },
): {
  items: Array<T & Pick<ClassifiedAnonymousUser, 'cid' | 'hasChats' | 'isGhost'>>;
  ghostCount: number;
  activeCount: number;
} {
  const query = options.q?.trim().toLowerCase();
  const classified = users
    .filter((user) => Boolean(user.is_anonymous))
    .map((user) => {
      const hasChats = options.chatUserIds.has(user.id);
      const isGhost = isGhostAnonymousUser(user, options);
      return {
        ...user,
        cid: readUserCid(user),
        hasChats,
        isGhost,
      };
    });

  const ghostCount = classified.filter((user) => user.isGhost).length;
  const activeCount = classified.filter((user) => user.hasChats).length;

  const visible = classified.filter((user) => {
    if (options.activity === 'ghost') return user.isGhost;
    if (options.activity === 'active') return user.hasChats;
    return true;
  });

  const items = query
    ? visible.filter((user) => matchesAnonymousQuery(user, query))
    : visible;

  return { items, ghostCount, activeCount };
}

export function selectPurgeGhostIds(
  users: AnonymousUserLike[],
  options: {
    chatUserIds: Set<string>;
    nowMs: number;
    graceMs?: number;
    limit?: number;
  },
): string[] {
  const ids = users
    .filter((user) => isGhostAnonymousUser(user, options))
    .map((user) => user.id);
  return options.limit ? ids.slice(0, options.limit) : ids;
}

function matchesAnonymousQuery(
  user: ClassifiedAnonymousUser,
  query: string,
): boolean {
  if (user.id.toLowerCase().includes(query)) return true;
  if (user.cid?.toLowerCase().includes(query)) return true;
  return false;
}
