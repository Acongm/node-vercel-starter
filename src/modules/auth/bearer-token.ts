import { Request } from 'express';

const ACONGM_ACCESS_COOKIE = 'acongm_access_token';
const SUPABASE_AUTH_COOKIE = /^sb-[^-]+-auth-token(?:\.(\d+))?$/;

export function extractBearerToken(request: Request): string | undefined {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }
  return authorization.slice('Bearer '.length).trim() || undefined;
}

/**
 * Keycloak-style access token: Authorization Bearer first, then the shared
 * `.acongm.com` session cookies written by email and OAuth login.
 */
export function extractAccessToken(request: Request): string | undefined {
  return (
    extractBearerToken(request) ||
    readNamedCookie(request, ACONGM_ACCESS_COOKIE) ||
    extractSupabaseCookieToken(readCookies(request))
  );
}

function readCookies(request: Request): Record<string, string> {
  const header = request.header('cookie');
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return acc;
    const key = part.slice(0, idx).trim();
    const raw = part.slice(idx + 1).trim();
    if (!key) return acc;
    try {
      acc[key] = decodeURIComponent(raw);
    } catch {
      acc[key] = raw;
    }
    return acc;
  }, {});
}

function readNamedCookie(request: Request, name: string): string | undefined {
  const value = readCookies(request)[name]?.trim();
  return value || undefined;
}

function extractSupabaseCookieToken(
  cookies: Record<string, string>,
): string | undefined {
  const chunks = Object.entries(cookies)
    .map(([name, value]) => {
      const match = SUPABASE_AUTH_COOKIE.exec(name);
      if (!match) return null;
      return { index: Number(match[1] || 0), value };
    })
    .filter((row): row is { index: number; value: string } => Boolean(row))
    .sort((a, b) => a.index - b.index);

  if (!chunks.length) return undefined;
  return sessionAccessToken(chunks.map((row) => row.value).join(''));
}

function sessionAccessToken(raw: string): string | undefined {
  let value = raw.trim();
  if (value.startsWith('base64-')) {
    try {
      value = Buffer.from(value.slice('base64-'.length), 'base64').toString(
        'utf8',
      );
    } catch {
      return undefined;
    }
  }
  try {
    const parsed = JSON.parse(value) as { access_token?: unknown };
    return typeof parsed.access_token === 'string' && parsed.access_token.trim()
      ? parsed.access_token.trim()
      : undefined;
  } catch {
    return value.startsWith('eyJ') ? value : undefined;
  }
}

function readJwtPayload(token: string): { exp?: unknown } | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      exp?: unknown;
    };
  } catch {
    return null;
  }
}

/** Read `exp` from an unverified JWT payload. Missing/malformed tokens return undefined. */
export function jwtExpiresAtMs(token: string): number | undefined {
  const payload = readJwtPayload(token);
  return typeof payload?.exp === 'number' ? payload.exp * 1000 : undefined;
}

/** Read `exp` from an unverified JWT payload. Missing/malformed tokens are not expired. */
export function isJwtExpired(token: string, nowMs = Date.now()): boolean {
  const expMs = jwtExpiresAtMs(token);
  return expMs !== undefined && expMs <= nowMs;
}
