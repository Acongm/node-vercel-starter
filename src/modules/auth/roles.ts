export type PlatformRole = 'anonymous' | 'viewer' | 'editor' | 'admin';
export type AuthTier = 'anon' | 'user';
export type AuthTokenSource = 'none' | 'admin-session' | 'supabase';

export interface AuthPrincipal {
  userId: string | null;
  role: PlatformRole;
  tier: AuthTier;
  email?: string;
  name?: string;
  source: AuthTokenSource;
}

export const ROLE_RANK: Record<PlatformRole, number> = {
  anonymous: 0,
  viewer: 1,
  editor: 2,
  admin: 3,
};

export function isPlatformRole(value: unknown): value is PlatformRole {
  return (
    value === 'anonymous' ||
    value === 'viewer' ||
    value === 'editor' ||
    value === 'admin'
  );
}

export function roleAtLeast(
  actual: PlatformRole,
  required: PlatformRole,
): boolean {
  return ROLE_RANK[actual] >= ROLE_RANK[required];
}

export function createAnonymousPrincipal(): AuthPrincipal {
  return {
    userId: null,
    role: 'anonymous',
    tier: 'anon',
    source: 'none',
  };
}
