import { UnauthorizedException } from '@nestjs/common';
import { AuthPrincipal } from '../src/modules/auth/roles';
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
    data: options.update ?? { id: 'user-1' },
    error: options.updateError ?? null,
  });
  const selectForUpdate = jest.fn().mockReturnValue({ single });
  const upsert = jest.fn().mockReturnValue({ select: selectForUpdate });
  const from = jest.fn().mockReturnValue({ select: selectForLoad, upsert });

  return { client: { from }, from, upsert };
}

describe('UserService contract', () => {
  it('returns a Supabase anonymous identity even when no application profile exists yet', async () => {
    const mocks = profileClient({ profile: null });
    const service = new UserService({ create: () => mocks.client } as never);
    const anonymous: AuthPrincipal = {
      userId: 'anon-user-1',
      role: 'viewer',
      tier: 'anon',
      source: 'supabase',
    };

    await expect(service.me(request, anonymous)).resolves.toEqual({
      id: 'anon-user-1',
      email: undefined,
      name: undefined,
      role: 'viewer',
      tier: 'anon',
      profile: null,
    });
  });

  it('always derives the profile owner id from the verified principal', async () => {
    const mocks = profileClient({ update: { id: 'user-1', display_name: 'Only Name' } });
    const service = new UserService({ create: () => mocks.client } as never);

    await service.updateProfile(request, userPrincipal, {
      displayName: '  Only Name  ',
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        id: 'user-1',
        display_name: 'Only Name',
      },
      { onConflict: 'id' },
    );
  });

  it('does not overwrite omitted profile fields during a partial patch', async () => {
    const mocks = profileClient({ update: { id: 'user-1', preferences: { language: 'zh-CN' } } });
    const service = new UserService({ create: () => mocks.client } as never);

    await service.updateProfile(request, userPrincipal, {
      preferences: { language: 'zh-CN' },
    });

    const row = mocks.upsert.mock.calls[0][0];
    expect(row).toEqual({
      id: 'user-1',
      preferences: { language: 'zh-CN' },
    });
    expect(row).not.toHaveProperty('display_name');
    expect(row).not.toHaveProperty('avatar_url');
  });

  it('surfaces profile write failures instead of returning an optimistic profile', async () => {
    const mocks = profileClient({
      updateError: { message: 'rls denied' },
    });
    const service = new UserService({ create: () => mocks.client } as never);

    await expect(
      service.updateProfile(request, userPrincipal, { displayName: 'New Name' }),
    ).rejects.toThrow('Failed to update user profile: rls denied');
  });

  it('rejects a Supabase-shaped principal without a stable user id', async () => {
    const service = new UserService({ create: jest.fn() } as never);
    const invalid = {
      ...userPrincipal,
      userId: undefined,
    } as AuthPrincipal;

    await expect(service.me(request, invalid)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
