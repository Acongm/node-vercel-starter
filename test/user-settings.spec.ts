import {
  AGENT_SKILLS_MAX_COUNT,
  DEFAULT_PROMPT_MAX_LENGTH,
  USER_SETTINGS_SCHEMA_VERSION,
  assertSettingsPatch,
  mergeSettingsOverrides,
  overridesFromSettingsRow,
  platformSettingsDefaults,
  resolveSettingsDocument,
  settingsRowPatch,
} from '../src/modules/user/user-settings';

const reviewSkill = {
  id: 'code-review',
  name: 'code-review',
  content: '先核对测试再改代码。',
  enabled: true,
};

const policy = {
  defaultModel: 'gpt-4.1-mini',
  allowedModels: ['gpt-4.1-mini', 'gpt-4.1'],
};

describe('User Settings document (#61)', () => {
  it('returns platform defaults when the user has no overrides', () => {
    const document = resolveSettingsDocument(null, policy);

    expect(document.schemaVersion).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(document.defaults).toEqual(platformSettingsDefaults(policy));
    expect(document.overrides).toEqual({});
    expect(document.effective).toEqual({
      language: 'zh-CN',
      theme: 'system',
      chat: { defaultModel: 'gpt-4.1-mini', defaultPrompt: '', skills: [] },
    });
    expect(document.language).toBe('zh-CN');
    expect(document.theme).toBe('system');
  });

  it('applies partial overrides without consumers merging defaults themselves', () => {
    const document = resolveSettingsDocument(
      { theme: 'dark', chat: { defaultPrompt: 'Be concise.' } },
      policy,
    );

    expect(document.overrides).toEqual({
      theme: 'dark',
      chat: { defaultPrompt: 'Be concise.' },
    });
    expect(document.effective).toEqual({
      language: 'zh-CN',
      theme: 'dark',
      chat: { defaultModel: 'gpt-4.1-mini', defaultPrompt: 'Be concise.', skills: [] },
    });
  });

  it('stores agent skills on chat overrides and treats null as a reset', () => {
    const document = resolveSettingsDocument(
      { chat: { skills: [reviewSkill] } },
      policy,
    );

    expect(document.effective.chat.skills).toEqual([reviewSkill]);

    const merged = mergeSettingsOverrides(
      { chat: { skills: [reviewSkill], defaultPrompt: 'Be concise.' } },
      { skills: null },
    );
    expect(merged.chat?.skills).toBeUndefined();
    expect(merged.chat?.defaultPrompt).toBe('Be concise.');
    expect(resolveSettingsDocument(merged, policy).effective.chat.skills).toEqual(
      [],
    );
  });

  it('rejects too many skills or oversized skill fields', () => {
    expect(() =>
      assertSettingsPatch(
        {
          skills: Array.from({ length: AGENT_SKILLS_MAX_COUNT + 1 }, (_, index) => ({
            id: `skill-${index}`,
            name: `skill-${index}`,
            content: 'ok',
            enabled: true,
          })),
        },
        policy,
      ),
    ).toThrow(/SETTINGS_SKILLS_TOO_MANY|cannot exceed/);
    expect(() =>
      assertSettingsPatch(
        {
          skills: [
            {
              id: 'x',
              name: 'x'.repeat(81),
              content: '',
              enabled: true,
            },
          ],
        },
        policy,
      ),
    ).toThrow(/SETTINGS_SKILL_NAME_TOO_LONG|too long/);
  });

  it('rejects models outside the server allow-list and overlong prompts', () => {
    expect(() =>
      assertSettingsPatch({ defaultModel: 'evil-model' }, policy),
    ).toThrow(/SETTINGS_MODEL_NOT_ALLOWED|not allowed/);
    expect(() =>
      assertSettingsPatch(
        { defaultPrompt: 'x'.repeat(DEFAULT_PROMPT_MAX_LENGTH + 1) },
        policy,
      ),
    ).toThrow(/SETTINGS_PROMPT_TOO_LONG|too long/);
  });

  it('treats null defaultPrompt as a reset back to the platform default', () => {
    const merged = mergeSettingsOverrides(
      { chat: { defaultPrompt: 'Be concise.', defaultModel: 'gpt-4.1' } },
      { defaultPrompt: null },
    );

    expect(merged.chat?.defaultPrompt).toBeUndefined();
    expect(merged.chat?.defaultModel).toBe('gpt-4.1');
    expect(resolveSettingsDocument(merged, policy).effective.chat.defaultPrompt).toBe(
      '',
    );
  });

  it('maps user_settings rows to overrides and back', () => {
    const overrides = overridesFromSettingsRow({
      user_id: 'user-1',
      schema_version: 1,
      language: 'en',
      theme: 'dark',
      default_model: 'gpt-4.1',
      default_prompt: 'Be concise.',
    });

    expect(overrides).toEqual({
      language: 'en',
      theme: 'dark',
      chat: { defaultModel: 'gpt-4.1', defaultPrompt: 'Be concise.' },
    });
    expect(settingsRowPatch(overrides)).toEqual({
      schema_version: 1,
      language: 'en',
      theme: 'dark',
      default_model: 'gpt-4.1',
      default_prompt: 'Be concise.',
    });
  });
});
