import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../src/modules/user/user.service';
import { AuthPrincipal } from '../src/modules/auth/roles';

const principal: AuthPrincipal = {
  userId: 'user-1',
  email: 'u@example.com',
  name: 'User One',
  role: 'editor',
  tier: 'user',
  source: 'supabase',
};

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
} = {}) {
  const loadMaybeSingle = jest.fn().mockResolvedValue({
    data: options.profile ?? null,
    error: options.loadError ?? null,
  });
  const loadEq = jest.fn().mockReturnValue({ maybeSingle: loadMaybeSingle });
  const select = jest.fn().mockReturnValue({ eq: loadEq });

  const updateMaybeSingle = jest.fn().mockResolvedValue({
    data: Object.prototype.hasOwnProperty.call(options, 'updated')
      ? options.updated
      : { id: 'user-1', display_name: 'Updated' },
    error: options.updateError ?? null,
  });
  const updateSelect = jest.fn().mockReturnValue({ maybeSingle: updateMaybeSingle });
  const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
  const update = jest.fn().mockReturnValue({ eq: updateEq });

  const insertSingle = jest.fn().mockResolvedValue({
    data: options.inserted ?? { id: 'user-1' },
    error: options.insertError ?? null,
  });
  const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
  const insert = jest.fn().mockReturnValue({ select: insertSelect });

  const settingsMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  const settingsFrom = {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({ maybeSingle: settingsMaybeSingle }),
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
    insert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  };
  const from = jest.fn((table?: string) =>
    table === 'user_settings' ? settingsFrom : { select, update, insert },
  );
  return { client: { from }, from, update, updateEq, insert, settingsFrom };
}

describe('UserService', () => {
  it('returns verified identity together with application profile', async () => {
    const mocks = profileClient({
      profile: { id: 'user-1', display_name: 'Acongm', preferences: {} },
    });
    const service = new UserService({ create: () => mocks.client } as never);

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
      settings: {
        language: 'zh-CN',
        theme: 'system',
        chat: { defaultModel: 'deepseek-v4-flash', defaultPrompt: '', skills: [] },
        preferences: {},
      },
    });
    expect(mocks.from).toHaveBeenCalledWith('profiles');
    expect(
      mocks.from.mock.calls.filter((call) => call[0] === 'profiles'),
    ).toHaveLength(1);
  });

  it('returns isAnonymous for stable Supabase anonymous identities', async () => {
    const mocks = profileClient();
    const service = new UserService({ create: () => mocks.client } as never);
    const anonymous: AuthPrincipal = {
      userId: 'anon-1',
      role: 'anonymous',
      tier: 'anon',
      source: 'supabase',
    };

    await expect(service.me(request(), anonymous)).resolves.toMatchObject({
      id: 'anon-1',
      role: 'anonymous',
      tier: 'anon',
      isAnonymous: true,
    });
  });

  it('updates all supplied application profile fields without using upsert', async () => {
    const mocks = profileClient({
      updated: { id: 'user-1', display_name: 'Updated' },
    });
    const service = new UserService({ create: () => mocks.client } as never);

    await service.updateProfile(request(), principal, {
      displayName: '  Updated  ',
      avatarUrl: 'https://example.com/a.png',
      preferences: { language: 'zh-CN' },
    });

    expect(mocks.update).toHaveBeenCalledWith({
      display_name: 'Updated',
      avatar_url: 'https://example.com/a.png',
      preferences: { language: 'zh-CN' },
    });
    expect(mocks.updateEq).toHaveBeenCalledWith('id', 'user-1');
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('supports explicit clear for nullable fields', async () => {
    const mocks = profileClient({ updated: { id: 'user-1' } });
    const service = new UserService({ create: () => mocks.client } as never);

    await service.updateProfile(request(), principal, {
      displayName: null,
      avatarUrl: null,
    });

    expect(mocks.update).toHaveBeenCalledWith({
      display_name: null,
      avatar_url: null,
    });
  });

  it('inserts a new profile when update finds no existing row', async () => {
    const mocks = profileClient({
      updated: null,
      inserted: { id: 'user-1', preferences: { language: 'zh-CN' } },
    });
    const service = new UserService({ create: () => mocks.client } as never);

    await expect(
      service.updateProfile(request(), principal, {
        preferences: { language: 'zh-CN' },
      }),
    ).resolves.toEqual({
      profile: {
        id: 'user-1',
        preferences: { language: 'zh-CN' },
      },
      userInfo: expect.objectContaining({
        displayName: 'User One',
        source: 'auth',
      }),
    });
    expect(mocks.insert).toHaveBeenCalledWith({
      id: 'user-1',
      preferences: { language: 'zh-CN' },
    });
  });

  it('rejects an empty profile patch', async () => {
    const mocks = profileClient();
    const service = new UserService({ create: () => mocks.client } as never);
    await expect(service.updateProfile(request(), principal, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('surfaces update failures', async () => {
    const mocks = profileClient({ updateError: { message: 'rls denied' } });
    const service = new UserService({ create: () => mocks.client } as never);
    await expect(
      service.updateProfile(request(), principal, { displayName: 'Updated' }),
    ).rejects.toThrow('Failed to update user profile: rls denied');
  });

  it('surfaces insert failures for first profile creation', async () => {
    const mocks = profileClient({
      updated: null,
      insertError: { message: 'duplicate or denied' },
    });
    const service = new UserService({ create: () => mocks.client } as never);
    await expect(
      service.updateProfile(request(), principal, { displayName: 'Updated' }),
    ).rejects.toThrow('Failed to create user profile: duplicate or denied');
  });

  it('rejects legacy/local principals from the new user module', async () => {
    const service = new UserService({ create: jest.fn() } as never);
    const legacy = { ...principal, source: 'local' as const };
    await expect(service.me(request(), legacy)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('surfaces profile query failures', async () => {
    const mocks = profileClient({ loadError: { message: 'rls denied' } });
    const service = new UserService({ create: () => mocks.client } as never);
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
    const service = new UserService({ create: () => mocks.client } as never);
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
      settings: { theme: 'dark', language: 'zh-CN' },
    });
  });

  it('returns profile snapshot without requiring a PATCH', async () => {
    const mocks = profileClient({
      profile: {
        id: 'user-1',
        display_name: 'Acongm',
        avatar_url: 'https://example.com/a.png',
        preferences: {},
      },
    });
    const service = new UserService({ create: () => mocks.client } as never);

    await expect(service.getProfile(request(), principal)).resolves.toEqual({
      profile: {
        id: 'user-1',
        display_name: 'Acongm',
        avatar_url: 'https://example.com/a.png',
        preferences: {},
      },
      userInfo: expect.objectContaining({
        displayName: 'Acongm',
        avatarUrl: 'https://example.com/a.png',
        source: 'profile',
      }),
    });
  });

  it('updates typed settings by merging into preferences', async () => {
    const mocks = settingsTableClient({
      settings: null,
      profile: {
        id: 'user-1',
        display_name: 'Acongm',
        avatar_url: null,
        preferences: { density: 'compact' },
      },
      insertedSettings: {
        user_id: 'user-1',
        schema_version: 1,
        language: 'en',
        theme: 'light',
        default_model: null,
        default_prompt: null,
      },
    });
    const service = new UserService({ create: () => mocks.client } as never);

    await expect(
      service.updateSettings(request(), principal, {
        theme: 'light',
        language: 'en',
      }),
    ).resolves.toEqual({
      settings: expect.objectContaining({
        language: 'en',
        theme: 'light',
        effective: expect.objectContaining({
          language: 'en',
          theme: 'light',
        }),
      }),
      userInfo: expect.objectContaining({
        displayName: 'Acongm',
        source: 'profile',
      }),
    });
    expect(mocks.settingsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        language: 'en',
        theme: 'light',
      }),
    );
    expect(mocks.profileUpdate).not.toHaveBeenCalled();
  });

  it('returns defaults/overrides/effective and caches GET settings by uid', async () => {
    const mocks = settingsTableClient({
      settings: null,
      profile: {
        id: 'user-1',
        display_name: 'Acongm',
        avatar_url: null,
        preferences: { theme: 'dark' },
      },
    });
    const service = new UserService({ create: () => mocks.client } as never);

    const first = await service.getSettings(request(), principal);
    const second = await service.getSettings(request(), principal);

    expect(first).toMatchObject({
      schemaVersion: 1,
      overrides: { theme: 'dark' },
      effective: { theme: 'dark', language: 'zh-CN' },
    });
    expect(second).toBe(first);
    expect(mocks.from.mock.calls.filter((call) => call[0] === 'user_settings')).toHaveLength(1);
  });

  it('rejects a default model that is not on the server allow-list', async () => {
    const service = new UserService({ create: () => profileClient().client } as never);

    await expect(
      service.updateSettings(request(), principal, {
        defaultModel: 'not-a-real-model',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'SETTINGS_MODEL_NOT_ALLOWED',
      },
    });
  });
});

function settingsTableClient(
  options: {
    profile?: unknown;
    settings?: unknown;
    updatedSettings?: unknown;
    insertedSettings?: unknown;
  } = {},
) {
  const profileMaybeSingle = jest.fn().mockResolvedValue({
    data: options.profile ?? null,
    error: null,
  });
  const profileSelect = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({ maybeSingle: profileMaybeSingle }),
  });
  const profileUpdate = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        maybeSingle: jest.fn().mockResolvedValue({ data: options.profile ?? null, error: null }),
      }),
    }),
  });

  const settingsMaybeSingle = jest.fn().mockResolvedValue({
    data: Object.prototype.hasOwnProperty.call(options, 'settings')
      ? options.settings
      : null,
    error: null,
  });
  const settingsSelect = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({ maybeSingle: settingsMaybeSingle }),
  });
  const settingsUpdateMaybeSingle = jest.fn().mockResolvedValue({
    data: Object.prototype.hasOwnProperty.call(options, 'updatedSettings')
      ? options.updatedSettings
      : null,
    error: null,
  });
  const settingsUpdate = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ maybeSingle: settingsUpdateMaybeSingle }),
    }),
  });
  const settingsInsert = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue({
        data: options.insertedSettings ?? {
          user_id: 'user-1',
          schema_version: 1,
          language: 'en',
          theme: 'light',
          default_model: null,
          default_prompt: null,
        },
        error: null,
      }),
    }),
  });

  const from = jest.fn((table: string) => {
    if (table === 'user_settings') {
      return {
        select: settingsSelect,
        update: settingsUpdate,
        insert: settingsInsert,
      };
    }
    return {
      select: profileSelect,
      update: profileUpdate,
      insert: jest.fn(),
    };
  });

  return { client: { from }, from, settingsUpdate, settingsInsert, profileUpdate };
}

describe('UserService user_settings table (#61)', () => {
  it('reads overrides from user_settings and returns platform defaults when no row exists', async () => {
    const mocks = settingsTableClient({
      settings: {
        user_id: 'user-1',
        schema_version: 1,
        language: null,
        theme: 'dark',
        default_model: 'gpt-4.1-mini',
        default_prompt: 'Be concise.',
      },
    });
    const service = new UserService({ create: () => mocks.client } as never);

    await expect(service.getSettings(request(), principal)).resolves.toMatchObject({
      schemaVersion: 1,
      overrides: {
        theme: 'dark',
        chat: { defaultModel: 'gpt-4.1-mini', defaultPrompt: 'Be concise.' },
      },
      effective: {
        language: 'zh-CN',
        theme: 'dark',
        chat: { defaultModel: 'gpt-4.1-mini', defaultPrompt: 'Be concise.' },
      },
    });
    expect(mocks.from).toHaveBeenCalledWith('user_settings');
  });

  it('falls back to profiles.preferences when user_settings has no row', async () => {
    const mocks = settingsTableClient({
      settings: null,
      profile: {
        id: 'user-1',
        display_name: 'Acongm',
        avatar_url: null,
        preferences: { theme: 'light', chat: { defaultPrompt: 'Legacy prompt' } },
      },
    });
    const service = new UserService({ create: () => mocks.client } as never);

    await expect(service.getSettings(request(), principal)).resolves.toMatchObject({
      overrides: {
        theme: 'light',
        chat: { defaultPrompt: 'Legacy prompt' },
      },
      effective: {
        theme: 'light',
        chat: { defaultPrompt: 'Legacy prompt' },
      },
    });
  });

  it('writes PATCH settings to user_settings instead of profiles.preferences', async () => {
    const mocks = settingsTableClient({
      settings: null,
      profile: {
        id: 'user-1',
        display_name: 'Acongm',
        avatar_url: null,
        preferences: { density: 'compact' },
      },
      updatedSettings: null,
      insertedSettings: {
        user_id: 'user-1',
        schema_version: 1,
        language: 'en',
        theme: 'light',
        default_model: 'deepseek-v4-flash',
        default_prompt: null,
      },
    });
    const service = new UserService({ create: () => mocks.client } as never);

    await expect(
      service.updateSettings(request(), principal, {
        theme: 'light',
        language: 'en',
        defaultModel: 'deepseek-v4-flash',
      }),
    ).resolves.toMatchObject({
      settings: {
        overrides: { language: 'en', theme: 'light', chat: { defaultModel: 'deepseek-v4-flash' } },
        effective: { language: 'en', theme: 'light' },
      },
    });
    expect(mocks.from).toHaveBeenCalledWith('user_settings');
    expect(mocks.settingsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        language: 'en',
        theme: 'light',
        default_model: 'deepseek-v4-flash',
      }),
    );
    expect(mocks.profileUpdate).not.toHaveBeenCalled();
  });

  it('caches GET settings by uid and schemaVersion', async () => {
    const mocks = settingsTableClient({
      settings: {
        user_id: 'user-1',
        schema_version: 1,
        language: null,
        theme: 'dark',
        default_model: null,
        default_prompt: null,
      },
    });
    const service = new UserService({ create: () => mocks.client } as never);

    const first = await service.getSettings(request(), principal);
    const second = await service.getSettings(request(), principal);

    expect(second).toBe(first);
    expect(mocks.from.mock.calls.filter((call) => call[0] === 'user_settings')).toHaveLength(1);
  });

  it('exposes user_settings on /me even when preferences still have a legacy theme', async () => {
    const mocks = settingsTableClient({
      settings: {
        user_id: 'user-1',
        schema_version: 1,
        language: 'en',
        theme: 'light',
        default_model: null,
        default_prompt: 'Be concise.',
      },
      profile: {
        id: 'user-1',
        display_name: 'Acongm',
        avatar_url: null,
        preferences: { theme: 'dark' },
      },
    });
    const service = new UserService({ create: () => mocks.client } as never);

    await expect(service.me(request(), principal)).resolves.toMatchObject({
      settings: {
        language: 'en',
        theme: 'light',
        chat: { defaultPrompt: 'Be concise.' },
      },
    });
  });

  it('lets an anonymous Supabase UID persist settings', async () => {
    const anonymous: AuthPrincipal = {
      userId: 'anon-1',
      role: 'anonymous',
      tier: 'anon',
      source: 'supabase',
    };
    const mocks = settingsTableClient({
      settings: null,
      insertedSettings: {
        user_id: 'anon-1',
        schema_version: 1,
        language: null,
        theme: 'dark',
        default_model: null,
        default_prompt: null,
      },
    });
    const service = new UserService({ create: () => mocks.client } as never);

    await expect(
      service.updateSettings(request(), anonymous, { theme: 'dark' }),
    ).resolves.toMatchObject({
      settings: { overrides: { theme: 'dark' }, effective: { theme: 'dark' } },
    });
    expect(mocks.settingsInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'anon-1', theme: 'dark' }),
    );
  });

  it('merges agent skills from profile preferences onto a user_settings row', async () => {
    const mocks = settingsTableClient({
      settings: {
        user_id: 'user-1',
        schema_version: 1,
        language: null,
        theme: 'dark',
        default_model: 'gpt-4.1-mini',
        default_prompt: 'Be concise.',
      },
      profile: {
        id: 'user-1',
        display_name: 'Acongm',
        avatar_url: null,
        preferences: {
          chat: {
            skills: [
              {
                id: 'code-review',
                name: 'code-review',
                content: '先核对测试再改代码。',
                enabled: true,
              },
            ],
          },
        },
      },
    });
    const service = new UserService({ create: () => mocks.client } as never);

    await expect(service.getSettings(request(), principal)).resolves.toMatchObject({
      effective: {
        chat: {
          defaultPrompt: 'Be concise.',
          skills: [
            {
              id: 'code-review',
              name: 'code-review',
              content: '先核对测试再改代码。',
              enabled: true,
            },
          ],
        },
      },
    });
  });

  it('writes agent skills to profiles.preferences and not user_settings columns', async () => {
    const mocks = settingsTableClient({
      settings: {
        user_id: 'user-1',
        schema_version: 1,
        language: null,
        theme: null,
        default_model: null,
        default_prompt: null,
      },
      updatedSettings: {
        user_id: 'user-1',
        schema_version: 1,
        language: null,
        theme: null,
        default_model: null,
        default_prompt: null,
      },
      profile: {
        id: 'user-1',
        display_name: 'Acongm',
        avatar_url: null,
        preferences: { density: 'compact' },
      },
    });
    const service = new UserService({ create: () => mocks.client } as never);
    const skills = [
      {
        id: 'code-review',
        name: 'code-review',
        content: '先核对测试再改代码。',
        enabled: true,
      },
    ];

    await expect(
      service.updateSettings(request(), principal, { skills }),
    ).resolves.toMatchObject({
      settings: {
        effective: { chat: { skills } },
      },
    });
    expect(mocks.profileUpdate).toHaveBeenCalledWith({
      preferences: {
        density: 'compact',
        chat: { skills },
      },
    });
    expect(mocks.settingsUpdate).toHaveBeenCalled();
  });
});
