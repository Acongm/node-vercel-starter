import { generateKeyPairSync } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { createClient } from '@supabase/supabase-js';
import { AppConfig } from '../src/config/app-config';
import { SupabaseAuthService } from '../src/modules/auth/supabase-auth.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

function config(overrides: Partial<AppConfig['supabase']> = {}): AppConfig {
  return {
    auth: {
      adminEmails: [] as string[],
    },
    supabase: {
      url: 'https://example.supabase.co',
      publicKey: 'sb_publishable_test',
      apiKey: 'service-role-test',
      commentsTable: 'comments',
      chatLogsTable: 'chat_logs',
      chatClientLabelsTable: 'chat_client_labels',
      authUsersTable: 'auth_users',
      ...overrides,
    },
  } as AppConfig;
}

function mockGetUser(result: unknown) {
  const getUser = jest.fn().mockResolvedValue(result);
  createClientMock.mockReturnValue({ auth: { getUser } } as never);
  return getUser;
}

describe('SupabaseAuthService', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockRejectedValue(new Error('jwks unavailable'));
  });
  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it('returns null without Supabase configuration', async () => {
    const service = new SupabaseAuthService(
      config({ url: undefined, publicKey: undefined, apiKey: undefined }),
    );
    await expect(service.verifyAccessToken('token')).resolves.toBeNull();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('verifies the token with the publishable key and maps trusted role metadata', async () => {
    const getUser = mockGetUser({
      data: {
        user: {
          id: 'user-1',
          email: 'u@example.com',
          app_metadata: { platform_role: 'editor' },
          user_metadata: { name: ' User One ', role: 'admin' },
        },
      },
      error: null,
    });
    const service = new SupabaseAuthService(config());

    await expect(service.verifyAccessToken('access-token')).resolves.toEqual({
      userId: 'user-1',
      email: 'u@example.com',
      name: 'User One',
      avatarUrl: undefined,
      role: 'editor',
      tier: 'user',
      source: 'supabase',
    });
    expect(getUser).toHaveBeenCalledWith('access-token');
    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'sb_publishable_test',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: false }),
      }),
    );
  });

  it('never uses user_metadata for authorization', async () => {
    mockGetUser({
      data: {
        user: {
          id: 'user-2',
          email: 'viewer@example.com',
          app_metadata: {},
          user_metadata: { role: 'admin' },
        },
      },
      error: null,
    });

    const principal = await new SupabaseAuthService(config()).verifyAccessToken(
      'token',
    );
    expect(principal?.role).toBe('viewer');
  });

  it('keeps Supabase anonymous users unprivileged while preserving auth.uid', async () => {
    mockGetUser({
      data: {
        user: {
          id: 'anon-user-1',
          is_anonymous: true,
          // Even trusted-looking role metadata must not promote an anonymous
          // principal before it becomes an authenticated account.
          app_metadata: { roles: ['editor'] },
          user_metadata: {},
        },
      },
      error: null,
    });

    await expect(
      new SupabaseAuthService(config()).verifyAccessToken('token'),
    ).resolves.toMatchObject({
      userId: 'anon-user-1',
      role: 'anonymous',
      tier: 'anon',
      source: 'supabase',
    });
  });

  it('returns null for rejected or missing users', async () => {
    mockGetUser({
      data: { user: null },
      error: { message: 'invalid token' },
    });
    await expect(
      new SupabaseAuthService(config()).verifyAccessToken('bad'),
    ).resolves.toBeNull();
  });

  it('caches verified principals for repeated token checks', async () => {
    const getUser = mockGetUser({
      data: {
        user: {
          id: 'user-cache',
          email: 'cache@example.com',
          app_metadata: {},
          user_metadata: {},
        },
      },
      error: null,
    });
    const service = new SupabaseAuthService(config());

    await expect(service.verifyAccessToken('same-token')).resolves.toMatchObject({
      userId: 'user-cache',
    });
    await expect(service.verifyAccessToken('same-token')).resolves.toMatchObject({
      userId: 'user-cache',
    });

    expect(getUser).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledTimes(1);
  });

  it('reuses a verified principal for several minutes within the JWT exp', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-13T00:00:00.000Z'));
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
      'base64url',
    );
    const payload = Buffer.from(
      JSON.stringify({
        exp: Math.floor(Date.now() / 1000) + 3_600,
        sub: 'user-ttl',
      }),
    ).toString('base64url');
    const token = `${header}.${payload}.sig`;
    const getUser = mockGetUser({
      data: {
        user: {
          id: 'user-ttl',
          email: 'ttl@example.com',
          app_metadata: {},
          user_metadata: {},
        },
      },
      error: null,
    });
    const service = new SupabaseAuthService(config());

    await service.verifyAccessToken(token);
    jest.advanceTimersByTime(4 * 60_000);
    await service.verifyAccessToken(token);

    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('does not keep a cached principal past the JWT exp', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-13T00:00:00.000Z'));
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
      'base64url',
    );
    const payload = Buffer.from(
      JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 2, sub: 'user-exp' }),
    ).toString('base64url');
    const token = `${header}.${payload}.sig`;
    const getUser = mockGetUser({
      data: {
        user: {
          id: 'user-exp',
          email: 'exp@example.com',
          app_metadata: {},
          user_metadata: {},
        },
      },
      error: null,
    });
    const service = new SupabaseAuthService(config());

    await service.verifyAccessToken(token);
    jest.advanceTimersByTime(2_001);
    await service.verifyAccessToken(token);

    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it('verifies ES256 access tokens locally via JWKS and skips Auth getUser', async () => {
    const { token, jwk } = await signEs256AccessToken({
      sub: 'user-jwks',
      email: 'jwks@example.com',
      app_metadata: { platform_role: 'editor' },
      user_metadata: { name: 'JWKS User', avatar_url: 'https://img.example/a.png' },
    });
    const getUser = mockGetUser({ data: { user: null }, error: { message: 'unused' } });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [jwk] }),
    });
    const service = new SupabaseAuthService(config());

    await expect(service.verifyAccessToken(token)).resolves.toEqual({
      userId: 'user-jwks',
      email: 'jwks@example.com',
      name: 'JWKS User',
      avatarUrl: 'https://img.example/a.png',
      role: 'editor',
      tier: 'user',
      source: 'supabase',
    });
    expect(getUser).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/.well-known/jwks.json',
    );

    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({
      userId: 'user-jwks',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps anonymous ES256 tokens unprivileged after local verify', async () => {
    const { token, jwk } = await signEs256AccessToken({
      sub: 'anon-jwks',
      is_anonymous: true,
      app_metadata: { roles: ['editor'] },
    });
    mockGetUser({ data: { user: null }, error: { message: 'unused' } });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [jwk] }),
    });

    await expect(
      new SupabaseAuthService(config()).verifyAccessToken(token),
    ).resolves.toMatchObject({
      userId: 'anon-jwks',
      role: 'anonymous',
      tier: 'anon',
      source: 'supabase',
    });
  });

  it('does not refetch JWKS on every request after a fetch failure', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new Error('jwks down'));
    global.fetch = fetchMock;
    const getUser = mockGetUser({
      data: {
        user: {
          id: 'user-down',
          email: 'down@example.com',
          app_metadata: {},
          user_metadata: {},
        },
      },
      error: null,
    });
    const service = new SupabaseAuthService(config());

    await service.verifyAccessToken('token-a');
    await service.verifyAccessToken('token-b');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledTimes(2);
  });

  it('falls back to getUser when JWKS cannot verify the token', async () => {
    const getUser = mockGetUser({
      data: {
        user: {
          id: 'user-fallback',
          email: 'fallback@example.com',
          app_metadata: {},
          user_metadata: {},
        },
      },
      error: null,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ keys: [] }),
    });
    const service = new SupabaseAuthService(config());

    await expect(service.verifyAccessToken('opaque-or-hs256')).resolves.toMatchObject({
      userId: 'user-fallback',
    });
    expect(getUser).toHaveBeenCalledWith('opaque-or-hs256');
  });
});

type TestJwk = {
  kid: string;
  alg: string;
  use: string;
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
};

async function signEs256AccessToken(
  claims: Record<string, unknown>,
): Promise<{ token: string; jwk: TestJwk }> {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  const jwk = publicKey.export({ format: 'jwk' });
  const token = await new JwtService().signAsync(
    {
      aud: 'authenticated',
      role: 'authenticated',
      ...claims,
    },
    {
      secret: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      algorithm: 'ES256',
      expiresIn: '1h',
      keyid: 'test-es256',
    },
  );
  return {
    token,
    jwk: {
      ...jwk,
      kid: 'test-es256',
      alg: 'ES256',
      use: 'sig',
    },
  };
}
