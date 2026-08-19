import { AuthPrincipal } from '../src/modules/auth/roles';
import {
  mergeSettingsPreferences,
  resolveUserInfo,
  resolveUserSettings,
} from '../src/modules/user/user-info';

describe('userInfo / settings resolvers', () => {
  const principal: AuthPrincipal = {
    userId: 'user-1',
    email: 'acongm@example.com',
    name: 'Auth Name',
    avatarUrl: 'https://oauth.example/a.png',
    role: 'viewer',
    tier: 'user',
    source: 'supabase',
  };

  it('prefers profile displayName and avatar over Auth metadata', () => {
    expect(
      resolveUserInfo(principal, {
        id: 'user-1',
        display_name: 'Profile Name',
        avatar_url: 'https://profile.example/a.png',
        preferences: {},
      }),
    ).toMatchObject({
      displayName: 'Profile Name',
      avatarUrl: 'https://profile.example/a.png',
      email: 'acongm@example.com',
      accountLabel: 'acongm@example.com',
      source: 'profile',
    });
  });

  it('falls back to Auth metadata when profile fields are empty', () => {
    expect(
      resolveUserInfo(principal, {
        id: 'user-1',
        display_name: null,
        avatar_url: null,
        preferences: {},
      }),
    ).toMatchObject({
      displayName: 'Auth Name',
      avatarUrl: 'https://oauth.example/a.png',
      source: 'auth',
    });
  });

  it('uses 访客 for anonymous users without profile/auth labels', () => {
    const anonymous: AuthPrincipal = {
      userId: 'anon-1',
      role: 'anonymous',
      tier: 'anon',
      source: 'supabase',
    };
    expect(resolveUserInfo(anonymous, null)).toMatchObject({
      displayName: '访客',
      isAnonymous: true,
      source: 'fallback',
    });
  });

  it('normalizes settings with defaults and merges patches', () => {
    expect(resolveUserSettings(null)).toEqual({
      language: 'zh-CN',
      theme: 'system',
      chat: { defaultModel: 'deepseek-v4-flash', defaultPrompt: '', skills: [] },
      preferences: {},
    });
    expect(
      resolveUserSettings({ language: 'en', theme: 'dark', density: 'compact' }),
    ).toEqual({
      language: 'en',
      theme: 'dark',
      chat: { defaultModel: 'deepseek-v4-flash', defaultPrompt: '', skills: [] },
      preferences: { language: 'en', theme: 'dark', density: 'compact' },
    });

    expect(
      mergeSettingsPreferences(
        { language: 'zh-CN', density: 'compact' },
        { theme: 'light', preferences: { sidebar: 'open' } },
      ),
    ).toEqual({
      language: 'zh-CN',
      density: 'compact',
      sidebar: 'open',
      theme: 'light',
    });
  });
});
