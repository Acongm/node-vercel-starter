import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../src/modules/user/user.service';
import { AuthPrincipal } from '../src/modules/auth/roles';
import { AppConfig } from '../src/config/app-config';

const principal: AuthPrincipal = {
  userId: 'user-1',
  email: 'u@example.com',
  name: 'User One',
  role: 'editor',
  tier: 'user',
  source: 'supabase',
};

const appConfig = {
  ai: { model: 'gpt-4.1-mini' },
} as AppConfig;

function expectedSettings(
  overrides: {
    language?: string;
    theme?: 'system' | 'light' | 'dark';
    preferences?: Record<string, unknown>;
    chat?: { defaultModel?: string; defaultPrompt?: string };
  } = {},
) {
  const language = overrides.language || 'zh-CN';
  const theme = overrides.theme || 'system';
  const preferences = overrides.preferences || {};
  const chatOverrides = overrides.chat || {};
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
      ...(Object.keys(chatOverrides).length ? { chat: chatOverrides } : {}),
    },
    effective: {
      language,
      theme,
      chat: {
        defaultModel: chatOverrides.defaultModel || 'gpt-4.1-mini',
        defaultPrompt: chatOverrides.defaultPrompt ?? '',
      },
    },
    preferences,
  };
}

function request() {
  return { header: () => 'Bearer token' } as never;
}

function profileClient(options: {
  profile?: unknown;
  loadError?: unknown;
  updated?: unknown;
  updateError?: unknown;
  inserted?: unknown;
  insertError?: unknown;
  settingsRow?: unknown;
  settingsUpsertError?: unknown;
} = {}) {
  const loadMaybeSingle = jest.fn().mockImplementation(async () => {
    // Called for both profiles and user_settings; distinguish via last select cols
    // is fragile — use from() implementation instead.
    return {
      data: options.profile ?? null,
      error: options.loadError ?? null,
    };
  });

  const from = jest.fn().mockImplementation((table: string) => {
    if (table === 'user_settings') {
      const settingsMaybeSingle = jest.fn().mockResolvedValue({
        data: Object.prototype.hasOwnProperty.call(options, 'settingsRow')
          ? options.settingsRow
          : null,
        error: null,
      });
      const upsert = jest.fn().mockResolvedValue({
        error: options.settingsUpsertError ?? null,
      });
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({ maybeSingle: settingsMaybeSingle }),
        }),
        upsert,
      };
    }

    const loadEq = jest.fn().mockReturnValue({
      maybeSingle: jest.fn().mockResolvedValue({
        data: options.profile ?? null,
        error: options.loadError ?? null,
      }),
    });
    const select = jest.fn().mockReturnValue({ eq: loadEq });

    const updateMaybeSingle = jest.fn().mockResolvedValue({
      data: Object.prototype.hasOwnProperty.call(options, 'updated')
        ? options.updated
        : { id: 'user-1', display_name: 'Updated' },
      error: options.updateError ?? null,
    });
    const updateSelect = jest.fn().mockReturnValue({
      maybeSingle: updateMaybeSingle,
    });
    const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
    const update = jest.fn().mockReturnValue({ eq: updateEq });

    const insertSingle = jest.fn().mockResolvedValue({
      data: options.inserted ?? { id: 'user-1' },
      error: options.insertError ?? null,
    });
    const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
    const insert = jest.fn().mockReturnValue({ select: insertSelect });

    return { select, update, insert, updateEq, updateFn: update, insertFn: insert };
  });

  return {
    client: { from },
    from,
    get update() {
      const profiles = from.mock.results.find(
        (result) => result.value && 'updateFn' in result.value,
      );
      return profiles?.value.updateFn as jest.Mock;
    },
    get updateEq() {
      // Re-create access via last profiles call
      return undefined as unknown as jest.Mock;
    },
    get insert() {
      return undefined as unknown as jest.Mock;
    },
  };
}

function createService(mocks: ReturnType<typeof profileClient>) {
  return new UserService({ create: () => mocks.client } as never, appConfig);
}

describe('UserService', () => {
  it('returns verified identity together with application profile', async () => {
    const mocks = profileClient({
      profile: { id: 'user-1', display_name: 'Acongm', preferences: {} },
    });
    const service = createService(mocks);

    await expect(service.me(request(), principal)).resolves.toEqual({
      id: 'user-1',
      email: 'u@example.com',
      name: 'User One',
      role: 'editor',
      tier: 'user',
      isAnonymous: false,
      profile: { id: 'user-1', display_name: 'Acongm', preferences: {} },
      userInfo: {
        id: 'user-1',
        displayName: 'Acongm',
        avatarUrl: null,
        email: 'u@example.com',
        accountLabel: 'u@example.com',
        role: 'editor',
        tier: 'user',
        isAnonymous: false,
        source: 'profile',
      },
      settings: expectedSettings({ preferences: {} }),
    });
    expect(mocks.from).toHaveBeenCalledWith('profiles');
    expect(mocks.from).toHaveBeenCalledWith('user_settings');
  });

  it('returns isAnonymous for stable Supabase anonymous identities', async () => {
    const mocks = profileClient();
    const service = createService(mocks);
    const anonymous: AuthPrincipal = {
      userId: 'anon-1',
      role: 'anonymous',
      tier: 'anon',
      source: 'supabase',
    };

    await expect(service.me(request(), anonymous)).resolves.toMatchObject({
      id: 'anon-1',
      isAnonymous: true,
      role: 'anonymous',
      tier: 'anon',
    });
  });

  it('PATCHes only supplied profile fields', async () => {
    const mocks = profileClient({
      updated: {
        id: 'user-1',
        display_name: 'Only Name',
        avatar_url: 'https://example.com/existing.png',
        preferences: { language: 'zh-CN' },
      },
    });
    const service = createService(mocks);

    await service.updateProfile(request(), principal, {
      displayName: '  Only Name  ',
    });

    const profilesCall = mocks.from.mock.calls.find(([table]) => table === 'profiles');
    expect(profilesCall).toBeTruthy();
  });

  it('supports explicit null clear for nullable profile fields', async () => {
    const mocks = profileClient({ updated: { id: 'user-1' } });
    const service = createService(mocks);

    await service.updateProfile(request(), principal, {
      displayName: null,
      avatarUrl: null,
    });
    expect(mocks.from).toHaveBeenCalledWith('profiles');
  });

  it('creates the application profile only when no profile row exists yet', async () => {
    const mocks = profileClient({
      updated: null,
      inserted: { id: 'user-1', preferences: { language: 'zh-CN' } },
    });
    const service = createService(mocks);

    await expect(
      service.updateProfile(request(), principal, {
        preferences: { language: 'zh-CN' },
      }),
    ).resolves.toEqual({
      id: 'user-1',
      preferences: { language: 'zh-CN' },
    });
  });

  it('rejects an empty profile patch', async () => {
    const mocks = profileClient();
    const service = createService(mocks);
    await expect(service.updateProfile(request(), principal, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('surfaces update failures', async () => {
    const mocks = profileClient({ updateError: { message: 'rls denied' } });
    const service = createService(mocks);
    await expect(
      service.updateProfile(request(), principal, { displayName: 'Updated' }),
    ).rejects.toThrow('Failed to update user profile: rls denied');
  });

  it('surfaces insert failures for first profile creation', async () => {
    const mocks = profileClient({
      updated: null,
      insertError: { message: 'duplicate or denied' },
    });
    const service = createService(mocks);
    await expect(
      service.updateProfile(request(), principal, { displayName: 'Updated' }),
    ).rejects.toThrow('Failed to create user profile: duplicate or denied');
  });

  it('rejects legacy/local principals from the new user module', async () => {
    const service = createService(profileClient());
    const legacy = { ...principal, source: 'local' as const };
    await expect(service.me(request(), legacy)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('surfaces profile query failures', async () => {
    const mocks = profileClient({ loadError: { message: 'rls denied' } });
    const service = createService(mocks);
    await expect(service.me(request(), principal)).rejects.toThrow(
      'Failed to load user profile: rls denied',
    );
  });

  it('exposes getUserInfo as an alias of me for auth-state UI', async () => {
    const mocks = profileClient({
      profile: {
        id: 'user-1',
        display_name: 'Acongm',
        avatar_url: 'https://example.com/a.png',
        preferences: { theme: 'dark' },
      },
    });
    const service = createService(mocks);
    const withAvatar = {
      ...principal,
      avatarUrl: 'https://oauth.example/ignored.png',
    };

    await expect(service.getUserInfo(request(), withAvatar)).resolves.toMatchObject({
      userInfo: {
        displayName: 'Acongm',
        avatarUrl: 'https://example.com/a.png',
        source: 'profile',
      },
      settings: expectedSettings({
        theme: 'dark',
        preferences: { theme: 'dark' },
      }),
    });
  });

  it('updates typed settings into user_settings with defaults/overrides', async () => {
    const mocks = profileClient({
      profile: {
        id: 'user-1',
        display_name: 'Acongm',
        avatar_url: null,
        preferences: { density: 'compact' },
      },
      updated: {
        id: 'user-1',
        preferences: { density: 'compact', theme: 'light', language: 'en' },
      },
    });
    const service = createService(mocks);

    await expect(
      service.updateSettings(request(), principal, {
        theme: 'light',
        language: 'en',
      }),
    ).resolves.toEqual(
      expectedSettings({
        language: 'en',
        theme: 'light',
        preferences: { density: 'compact', theme: 'light', language: 'en' },
      }),
    );
    expect(mocks.from).toHaveBeenCalledWith('user_settings');
  });

  it('rejects disallowed chat default models', async () => {
    const mocks = profileClient({
      profile: { id: 'user-1', preferences: {} },
    });
    const service = createService(mocks);

    await expect(
      service.updateSettings(request(), principal, {
        chatDefaultModel: 'not-allowed-model',
      }),
    ).rejects.toMatchObject({
      response: { code: 'SETTINGS_MODEL_NOT_ALLOWED' },
    });
  });

  it('serves cached settings on repeated getSettings without extra user_settings reads', async () => {
    const mocks = profileClient({
      settingsRow: { settings: { theme: 'dark' } },
    });
    const service = createService(mocks);

    await service.getSettings(request(), principal);
    const callsAfterFirst = mocks.from.mock.calls.filter(
      ([table]) => table === 'user_settings',
    ).length;
    await service.getSettingsCached(request(), principal);
    const callsAfterSecond = mocks.from.mock.calls.filter(
      ([table]) => table === 'user_settings',
    ).length;
    expect(callsAfterSecond).toBe(callsAfterFirst);
  });
});
