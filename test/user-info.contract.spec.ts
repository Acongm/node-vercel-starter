import { AuthPrincipal } from '../src/modules/auth/roles';
import {
  defaultPlatformSettings,
  mergeSettingsPreferences,
  resolveUserInfo,
  resolveUserSettings,
} from '../src/modules/user/user-info';
import { prepareChatV1Messages } from '../src/modules/ai/v1/chat-v1.policy';

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

  const platform = defaultPlatformSettings({
    defaultModel: 'gpt-4.1-mini',
    allowedModels: ['gpt-4.1-mini', 'gpt-4.1'],
  });

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

  it('normalizes settings with defaults/overrides/effective', () => {
    expect(resolveUserSettings(null, platform)).toEqual({
      schemaVersion: 1,
      defaults: {
        language: 'zh-CN',
        theme: 'system',
        chat: { defaultModel: 'gpt-4.1-mini', defaultPrompt: '' },
      },
      overrides: {},
      effective: {
        language: 'zh-CN',
        theme: 'system',
        chat: { defaultModel: 'gpt-4.1-mini', defaultPrompt: '' },
      },
      preferences: {},
    });

    expect(
      resolveUserSettings(
        {
          language: 'en',
          theme: 'dark',
          density: 'compact',
          chat: { defaultModel: 'gpt-4.1', defaultPrompt: 'be concise' },
        },
        platform,
      ),
    ).toEqual({
      schemaVersion: 1,
      defaults: {
        language: 'zh-CN',
        theme: 'system',
        chat: { defaultModel: 'gpt-4.1-mini', defaultPrompt: '' },
      },
      overrides: {
        language: 'en',
        theme: 'dark',
        chat: { defaultModel: 'gpt-4.1', defaultPrompt: 'be concise' },
      },
      effective: {
        language: 'en',
        theme: 'dark',
        chat: { defaultModel: 'gpt-4.1', defaultPrompt: 'be concise' },
      },
      preferences: {
        language: 'en',
        theme: 'dark',
        density: 'compact',
        chat: { defaultModel: 'gpt-4.1', defaultPrompt: 'be concise' },
      },
    });
  });

  it('falls back when overridden model is not allow-listed', () => {
    const view = resolveUserSettings(
      { chat: { defaultModel: 'evil-model' } },
      platform,
    );
    expect(view.overrides.chat?.defaultModel).toBe('evil-model');
    expect(view.effective.chat.defaultModel).toBe('gpt-4.1-mini');
  });

  it('merges patches and supports clearing chat overrides with null', () => {
    expect(
      mergeSettingsPreferences(
        { language: 'zh-CN', density: 'compact', chat: { defaultModel: 'gpt-4.1' } },
        { theme: 'light', preferences: { sidebar: 'open' }, chatDefaultModel: null },
        platform,
      ),
    ).toEqual({
      language: 'zh-CN',
      density: 'compact',
      sidebar: 'open',
      theme: 'light',
    });
  });

  it('appends userDefaultPrompt after security system policy', () => {
    const messages = prepareChatV1Messages({
      prompt: 'hello',
      userDefaultPrompt: 'always answer in pirate speak',
    });
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('你是技术知识库的 AI 阅读助手');
    expect(messages[0].content).toContain('用户偏好指令');
    expect(messages[0].content).toContain('always answer in pirate speak');
    expect(messages[0].content.indexOf('你是技术知识库')).toBeLessThan(
      messages[0].content.indexOf('用户偏好指令'),
    );
  });
});
