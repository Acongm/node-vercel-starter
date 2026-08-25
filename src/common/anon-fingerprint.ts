import { createHash } from 'node:crypto';

/**
 * Derives a stable anonymous client identifier from user-agent and origin.
 * Returns `ua-` + first 8 hex chars of sha256(userAgent + '|' + (origin || '')).
 */
export function deriveAnonFingerprint(
  userAgent: string | undefined,
  origin: string | undefined,
): string | undefined {
  if (!userAgent) {
    return undefined;
  }

  const hash = createHash('sha256')
    .update(`${userAgent}|${origin ?? ''}`)
    .digest('hex')
    .slice(0, 8);

  return `ua-${hash}`;
}

/**
 * Resolves client id: prefer explicit clientId, else derive from UA fingerprint.
 */
export function resolveClientId(
  clientId: string | undefined,
  userAgent: string | undefined,
  origin: string | undefined,
): string | undefined {
  if (clientId) {
    return clientId;
  }
  return deriveAnonFingerprint(userAgent, origin);
}
