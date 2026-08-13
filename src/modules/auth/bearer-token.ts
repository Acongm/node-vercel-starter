import { Request } from 'express';

export function extractBearerToken(request: Request): string | undefined {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }
  return authorization.slice('Bearer '.length).trim() || undefined;
}

/** Read `exp` from an unverified JWT payload. Missing/malformed tokens are not expired. */
export function isJwtExpired(token: string, nowMs = Date.now()): boolean {
  const parts = token.split('.');
  if (parts.length < 2) return false;
  try {
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const payload = JSON.parse(
      Buffer.from(padded, 'base64').toString('utf8'),
    ) as { exp?: unknown };
    return typeof payload.exp === 'number' && payload.exp * 1000 <= nowMs;
  } catch {
    return false;
  }
}
