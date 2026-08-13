import { isJwtExpired, jwtExpiresAtMs } from '../src/modules/auth/bearer-token';

function jwtWithExp(expSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
    'base64url',
  );
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString(
    'base64url',
  );
  return `${header}.${payload}.sig`;
}

describe('bearer-token JWT expiry helpers', () => {
  it('reads exp as milliseconds since epoch', () => {
    expect(jwtExpiresAtMs(jwtWithExp(1_700_000_000))).toBe(1_700_000_000_000);
  });

  it('treats missing or malformed tokens as not expired', () => {
    expect(isJwtExpired('not-a-jwt')).toBe(false);
    expect(jwtExpiresAtMs('not-a-jwt')).toBeUndefined();
    expect(isJwtExpired('a.b.c')).toBe(false);
  });

  it('is expired when exp is in the past', () => {
    expect(isJwtExpired(jwtWithExp(1), 2_000)).toBe(true);
    expect(isJwtExpired(jwtWithExp(10), 9_000)).toBe(false);
  });
});
