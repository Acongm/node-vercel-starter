import { UserController } from '../src/modules/user/user.controller';
import { AuthPrincipal } from '../src/modules/auth/roles';

const principal: AuthPrincipal = {
  userId: 'user-1',
  source: 'supabase',
  role: 'viewer',
  tier: 'user',
};
const request = { auth: principal } as never;

describe('UserController contract (#56)', () => {
  it('exposes me/info/profile/settings without substituting client identity', async () => {
    const snapshot = { id: 'user-1', userInfo: { displayName: 'Acongm' } };
    const profile = { profile: { id: 'user-1' }, userInfo: snapshot.userInfo };
    const settings = { language: 'zh-CN', theme: 'system', preferences: {} };
    const me = jest.fn().mockResolvedValue(snapshot);
    const getUserInfo = jest.fn().mockResolvedValue(snapshot);
    const getProfile = jest.fn().mockResolvedValue(profile);
    const getSettings = jest.fn().mockResolvedValue(settings);
    const updateSettings = jest.fn().mockResolvedValue({ settings, userInfo: snapshot.userInfo });
    const updateProfile = jest.fn().mockResolvedValue(profile);
    const controller = new UserController({
      me,
      getUserInfo,
      getProfile,
      getSettings,
      updateSettings,
      updateProfile,
    } as never);

    await expect(controller.me(request)).resolves.toBe(snapshot);
    await expect(controller.getUserInfo(request)).resolves.toBe(snapshot);
    await expect(controller.getProfile(request)).resolves.toBe(profile);
    await expect(controller.getSettings(request)).resolves.toBe(settings);
    await expect(
      controller.updateSettings(request, { theme: 'dark' }),
    ).resolves.toEqual({ settings, userInfo: snapshot.userInfo });
    await expect(
      controller.updateProfile(request, { displayName: 'Acongm' }),
    ).resolves.toBe(profile);

    expect(me).toHaveBeenCalledWith(request, principal);
    expect(getUserInfo).toHaveBeenCalledWith(request, principal);
    expect(getProfile).toHaveBeenCalledWith(request, principal);
    expect(getSettings).toHaveBeenCalledWith(request, principal);
    expect(updateSettings).toHaveBeenCalledWith(request, principal, {
      theme: 'dark',
    });
    expect(updateProfile).toHaveBeenCalledWith(request, principal, {
      displayName: 'Acongm',
    });
  });
});
