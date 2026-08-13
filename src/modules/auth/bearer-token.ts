import { Request } from 'express';

export function extractBearerToken(request: Request): string | undefined {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }
  return authorization.slice('Bearer '.length).trim() || undefined;
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
