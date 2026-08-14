import {
  extractAccessToken,
  extractBearerToken,
  isJwtExpired,
  jwtExpiresAtMs,
} from '../src/modules/auth/bearer-token';

function request(headerValue: string | undefined) {
  return {
    header: (name: string) =>
      name.toLowerCase() === 'authorization' ? headerValue : undefined,
  } as never;
}

function cookieRequest(cookie: string) {
  return {
    header: (name: string) =>
      name.toLowerCase() === 'cookie' ? cookie : undefined,
  } as never;
}

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

describe('extractAccessToken (Keycloak-style cookie or Bearer)', () => {
  const accessToken = jwtWithExp(1_800_000_000);

  it('prefers Authorization Bearer over cookies', () => {
    const req = {
      header: (name: string) => {
        if (name.toLowerCase() === 'authorization') return 'Bearer from-header';
        if (name.toLowerCase() === 'cookie') return 'acongm_access_token=from-cookie';
        return undefined;
      },
    } as never;
    expect(extractBearerToken(req)).toBe('from-header');
    expect(extractAccessToken(req)).toBe('from-header');
  });

  it('reads acongm_access_token from the shared .acongm.com cookie', () => {
    expect(extractAccessToken(cookieRequest(`acongm_access_token=${accessToken}`))).toBe(
      accessToken,
    );
  });

  it('reads a Supabase SSR session cookie used by email and OAuth login', () => {
    const session = JSON.stringify({
      access_token: accessToken,
      refresh_token: 'refresh',
      token_type: 'bearer',
    });
    const encoded = `base64-${Buffer.from(session, 'utf8').toString('base64')}`;
    expect(
      extractAccessToken(
        cookieRequest(`sb-ejprvntpxlyydkzsjqnv-auth-token=${encodeURIComponent(encoded)}`),
      ),
    ).toBe(accessToken);
  });

  it('reassembles chunked Supabase SSR cookies', () => {
    const session = JSON.stringify({ access_token: accessToken });
    const encoded = `base64-${Buffer.from(session, 'utf8').toString('base64')}`;
    const mid = Math.ceil(encoded.length / 2);
    expect(
      extractAccessToken(
        cookieRequest(
          `sb-ejprvntpxlyydkzsjqnv-auth-token.0=${encodeURIComponent(encoded.slice(0, mid))}; sb-ejprvntpxlyydkzsjqnv-auth-token.1=${encodeURIComponent(encoded.slice(mid))}`,
        ),
      ),
    ).toBe(accessToken);
  });

  it('returns undefined when neither Bearer nor session cookies are present', () => {
    expect(extractAccessToken(request(undefined))).toBeUndefined();
    expect(extractAccessToken(cookieRequest('theme=dark'))).toBeUndefined();
  });
});
