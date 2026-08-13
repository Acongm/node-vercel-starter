import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthPrincipal } from '../src/modules/auth/roles';
import { AppConfig } from '../src/config/app-config';
import { UserService } from '../src/modules/user/user.service';

const request = { header: () => 'Bearer token' } as never;

const userPrincipal: AuthPrincipal = {
  userId: 'user-1',
  email: 'u@example.com',
  name: 'User One',
  role: 'viewer',
  tier: 'user',
  source: 'supabase',
};

const appConfig = {
  ai: { model: 'gpt-4.1-mini' },
} as AppConfig;

function expectedDefaultSettings(
  preferences: Record<string, unknown> = {},
  overrides: {
    language?: string;
    theme?: 'system' | 'light' | 'dark';
  } = {},
) {
  const language = overrides.language || 'zh-CN';
  const theme = overrides.theme || 'system';
  return {
    schemaVersion: 1,
    defaults: {
      language: 'zh-CN',
      theme: 'system',
      chat: { defaultModel: 'gpt-4.1-mini', defaultPrompt: '' },
    },
    overrides: {
      ...(overrides.language ? { language } : {}),
      ...(overrides.theme ? { theme } : {}),
    },
    effective: {
      language,
      theme,
      chat: { defaultModel: 'gpt-4.1-mini', defaultPrompt: '' },
    },
    preferences,
  };
}

function profileClient(options: {
  profile?: unknown;
  loadError?: unknown;
  updated?: unknown;
  updateError?: unknown;
  inserted?: unknown;
  insertError?: unknown;
} = {}) {
  const updateEq = jest.fn();
  const update = jest.fn();
  const insert = jest.fn();

  const from = jest.fn().mockImplementation((table: string) => {
    if (table === 'user_settings') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      };
    }

    const loadMaybeSingle = jest.fn().mockResolvedValue({
      data: options.profile ?? null,
      error: options.loadError ?? null,
    });
    const loadEq = jest.fn().mockReturnValue({ maybeSingle: loadMaybeSingle });
    const select = jest.fn().mockReturnValue({ eq: loadEq });

    const updateMaybeSingle = jest.fn().mockResolvedValue({
      data: Object.prototype.hasOwnProperty.call(options, 'updated')
        ? options.updated
        : { id: 'user-1' },
      error: options.updateError ?? null,
    });
    const updateSelect = jest.fn().mockReturnValue({
      maybeSingle: updateMaybeSingle,
    });
    updateEq.mockReturnValue({ select: updateSelect });
    update.mockReturnValue({ eq: updateEq });

    const insertSingle = jest.fn().mockResolvedValue({
      data: options.inserted ?? { id: 'user-1' },
      error: options.insertError ?? null,
    });
    const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
    insert.mockReturnValue({ select: insertSelect });

    return { select, update, insert };
  });

  return { client: { from }, from, update, updateEq, insert };
}

function createService(mocks: ReturnType<typeof profileClient>) {
  return new UserService({ create: () => mocks.client } as never, appConfig);
}

describe('UserService contract', () => {
  it('returns a stable anonymous Supabase identity without granting viewer role', async () => {
    const mocks = profileClient({ profile: null });
    const service = createService(mocks);
    const anonymous: AuthPrincipal = {
      userId: 'anon-user-1',
      role: 'anonymous',
      tier: 'anon',
      source: 'supabase',
    };

    await expect(service.me(request, anonymous)).resolves.toEqual({
      id: 'anon-user-1',
      email: undefined,
      name: undefined,
      role: 'anonymous',
      tier: 'anon',
      isAnonymous: true,
      profile: null,
      userInfo: {
        id: 'anon-user-1',
        displayName: '访客',
        avatarUrl: null,
        email: null,
        accountLabel: '访客',
        role: 'anonymous',
        tier: 'anon',
        isAnonymous: true,
        source: 'fallback',
      },
      settings: expectedDefaultSettings(),
    });
  });

  it('PATCHes only supplied fields and always scopes the write to the verified principal', async () => {
    const mocks = profileClient({
      updated: {
        id: 'user-1',
        display_name: 'Only Name',
        avatar_url: 'https://example.com/existing.png',
        preferences: { language: 'zh-CN' },
      },
    });
    const service = createService(mocks);

    await service.updateProfile(request, userPrincipal, {
      displayName: '  Only Name  ',
    });

    expect(mocks.update).toHaveBeenCalledWith({ display_name: 'Only Name' });
    expect(mocks.updateEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('supports explicit null clear for nullable profile fields', async () => {
    const mocks = profileClient({ updated: { id: 'user-1' } });
    const service = createService(mocks);

    await service.updateProfile(request, userPrincipal, {
      displayName: null,
      avatarUrl: null,
    });

    expect(mocks.update).toHaveBeenCalledWith({
      display_name: null,
      avatar_url: null,
    });
  });

  it('creates the application profile only when no profile row exists yet', async () => {
    const mocks = profileClient({
      updated: null,
      inserted: { id: 'user-1', preferences: { language: 'zh-CN' } },
    });
    const service = createService(mocks);

    await expect(
      service.updateProfile(request, userPrincipal, {
        preferences: { language: 'zh-CN' },
      }),
    ).resolves.toEqual({
      id: 'user-1',
      preferences: { language: 'zh-CN' },
    });

    expect(mocks.insert).toHaveBeenCalledWith({
      id: 'user-1',
      preferences: { language: 'zh-CN' },
    });
  });

  it('rejects an empty PATCH instead of performing an ambiguous no-op', async () => {
    const mocks = profileClient();
    const service = createService(mocks);

    await expect(
      service.updateProfile(request, userPrincipal, {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('surfaces profile write failures instead of returning optimistic state', async () => {
    const mocks = profileClient({
      updateError: { message: 'rls denied' },
    });
    const service = createService(mocks);

    await expect(
      service.updateProfile(request, userPrincipal, { displayName: 'New Name' }),
    ).rejects.toThrow('Failed to update user profile: rls denied');
  });

  it('rejects a Supabase-shaped principal without a stable user id', async () => {
    const service = createService(profileClient());
    const invalid: AuthPrincipal = {
      ...userPrincipal,
      userId: null,
    };

    await expect(service.me(request, invalid)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
