import { UnauthorizedException } from '@nestjs/common';
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
  update?: unknown;
  updateError?: unknown;
} = {}) {
  const maybeSingle = jest.fn().mockResolvedValue({
    data: options.profile ?? null,
    error: options.loadError ?? null,
  });
  const eq = jest.fn().mockReturnValue({ maybeSingle });
  const selectForLoad = jest.fn().mockReturnValue({ eq });

  const single = jest.fn().mockResolvedValue({
    data: options.update ?? { id: 'user-1', display_name: 'Updated' },
    error: options.updateError ?? null,
  });
  const selectForUpdate = jest.fn().mockReturnValue({ single });
  const upsert = jest.fn().mockReturnValue({ select: selectForUpdate });

  const from = jest.fn().mockReturnValue({
    select: selectForLoad,
    upsert,
  });

  return { client: { from }, from, upsert };
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
      profile: { id: 'user-1', display_name: 'Acongm', preferences: {} },
    });
    expect(mocks.from).toHaveBeenCalledWith('profiles');
  });

  it('upserts only application profile data and trims display name', async () => {
    const mocks = profileClient({ update: { id: 'user-1', display_name: 'Updated' } });
    const service = new UserService({ create: () => mocks.client } as never);

    await service.updateProfile(request(), principal, {
      displayName: '  Updated  ',
      avatarUrl: 'https://example.com/a.png',
      preferences: { language: 'zh-CN' },
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        id: 'user-1',
        display_name: 'Updated',
        avatar_url: 'https://example.com/a.png',
        preferences: { language: 'zh-CN' },
      },
      { onConflict: 'id' },
    );
  });

  it('rejects legacy/local principals from the new user module', async () => {
    const service = new UserService({ create: jest.fn() } as never);
    const legacy = { ...principal, source: 'local' as const };
    await expect(service.me(request(), legacy)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('surfaces profile query failures', async () => {
    const mocks = profileClient({ loadError: { message: 'rls denied' } });
    const service = new UserService({ create: () => mocks.client } as never);
    await expect(service.me(request(), principal)).rejects.toThrow('Failed to load user profile: rls denied');
  });
});
