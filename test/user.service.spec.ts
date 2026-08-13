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

  const from = jest.fn().mockReturnValue({ select, update, insert });
  return { client: { from }, from, update, updateEq, insert };
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
        preferences: {},
      },
    });
    expect(mocks.from).toHaveBeenCalledWith('profiles');
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

  it('updates typed settings by merging into preferences', async () => {
    const mocks = profileClient({
      profile: {
        id: 'user-1',
        display_name: 'Acongm',
        avatar_url: null,
        preferences: { density: 'compact' },
      },
      updated: {
        id: 'user-1',
        display_name: 'Acongm',
        avatar_url: null,
        preferences: { density: 'compact', theme: 'light', language: 'en' },
      },
    });
    const service = new UserService({ create: () => mocks.client } as never);

    await expect(
      service.updateSettings(request(), principal, {
        theme: 'light',
        language: 'en',
      }),
    ).resolves.toEqual({
      settings: {
        language: 'en',
        theme: 'light',
        preferences: { density: 'compact', theme: 'light', language: 'en' },
      },
      userInfo: expect.objectContaining({
        displayName: 'Acongm',
        source: 'profile',
      }),
    });
    expect(mocks.update).toHaveBeenCalledWith({
      preferences: { density: 'compact', theme: 'light', language: 'en' },
    });
  });
});
