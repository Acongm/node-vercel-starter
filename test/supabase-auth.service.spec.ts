import { createClient } from '@supabase/supabase-js';
import { AppConfig } from '../src/config/app-config';
import { SupabaseAuthService } from '../src/modules/auth/supabase-auth.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

function config(overrides: Partial<AppConfig['supabase']> = {}): AppConfig {
  return {
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
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    jest.useRealTimers();
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
});
