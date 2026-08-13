import { AuthPrincipal } from '../auth/roles';

export type ProfileRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  preferences: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * UI-ready identity for AuthAccountButton / nav / settings menus.
 * Prefer application profile fields, then Auth principal display fields.
 */
export type UserInfoView = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  accountLabel: string;
  role: AuthPrincipal['role'];
  tier: AuthPrincipal['tier'];
  isAnonymous: boolean;
  source: 'profile' | 'auth' | 'fallback';
};

export type ChatSettingsSlice = {
  defaultModel: string;
  defaultPrompt: string;
};

export type UserSettingsEffective = {
  language: string;
  theme: 'system' | 'light' | 'dark';
  chat: ChatSettingsSlice;
};

export type UserSettingsView = {
  schemaVersion: number;
  /** Platform defaults (never persist secrets/roles here). */
  defaults: UserSettingsEffective;
  /** Only keys the user explicitly overrode. */
  overrides: Partial<{
    language: string;
    theme: 'system' | 'light' | 'dark';
    chat: Partial<ChatSettingsSlice>;
  }>;
  /** defaults merged with overrides — consumers should use this. */
  effective: UserSettingsEffective;
  /** Raw preferences bag for forward-compat extras. */
  preferences: Record<string, unknown>;
};

export type PlatformSettingsDefaults = {
  language: string;
  theme: 'system' | 'light' | 'dark';
  defaultModel: string;
  allowedModels: string[];
  defaultPrompt: string;
  maxPromptLength: number;
};

export const SETTINGS_SCHEMA_VERSION = 1;

const DEFAULT_LANGUAGE = 'zh-CN';
const DEFAULT_THEME = 'system' as const;
const DEFAULT_PROMPT = '';
const DEFAULT_MAX_PROMPT = 4000;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function defaultPlatformSettings(
  input?: Partial<PlatformSettingsDefaults>,
): PlatformSettingsDefaults {
  const defaultModel = asNonEmptyString(input?.defaultModel) || 'gpt-4.1-mini';
  const allowed =
    input?.allowedModels && input.allowedModels.length > 0
      ? input.allowedModels
      : [defaultModel];
  return {
    language: asNonEmptyString(input?.language) || DEFAULT_LANGUAGE,
    theme:
      input?.theme === 'light' || input?.theme === 'dark' || input?.theme === 'system'
        ? input.theme
        : DEFAULT_THEME,
    defaultModel,
    allowedModels: allowed,
    defaultPrompt: typeof input?.defaultPrompt === 'string' ? input.defaultPrompt : DEFAULT_PROMPT,
    maxPromptLength: input?.maxPromptLength || DEFAULT_MAX_PROMPT,
  };
}

export function resolveUserInfo(
  principal: AuthPrincipal,
  profile: ProfileRow | null,
): UserInfoView {
  const email = asNonEmptyString(principal.email);
  const profileName = asNonEmptyString(profile?.display_name);
  const authName = asNonEmptyString(principal.name);
  const emailLocal = email?.includes('@') ? email.split('@')[0] : email;

  const displayName =
    profileName || authName || emailLocal || (principal.tier === 'anon' ? '访客' : '用户');

  const profileAvatar = asNonEmptyString(profile?.avatar_url);
  const authAvatar = asNonEmptyString(principal.avatarUrl);
  const avatarUrl = profileAvatar || authAvatar;

  let source: UserInfoView['source'] = 'fallback';
  if (profileName || profileAvatar) source = 'profile';
  else if (authName || authAvatar || email) source = 'auth';

  return {
    id: principal.userId!,
    displayName,
    avatarUrl,
    email,
    accountLabel: email || displayName,
    role: principal.role,
    tier: principal.tier,
    isAnonymous: principal.tier === 'anon',
    source,
  };
}

function readChatOverrides(
  prefs: Record<string, unknown>,
): Partial<ChatSettingsSlice> {
  const chatRaw = prefs.chat;
  const chat =
    chatRaw && typeof chatRaw === 'object' && !Array.isArray(chatRaw)
      ? (chatRaw as Record<string, unknown>)
      : {};
  const out: Partial<ChatSettingsSlice> = {};
  const model = asNonEmptyString(chat.defaultModel) || asNonEmptyString(prefs['chat.default_model']);
  const prompt =
    typeof chat.defaultPrompt === 'string'
      ? chat.defaultPrompt
      : typeof prefs['chat.default_prompt'] === 'string'
        ? prefs['chat.default_prompt']
        : undefined;
  if (model) out.defaultModel = model;
  if (prompt !== undefined) out.defaultPrompt = prompt;
  return out;
}

export function resolveUserSettings(
  preferences: Record<string, unknown> | null | undefined,
  platform: PlatformSettingsDefaults = defaultPlatformSettings(),
): UserSettingsView {
  const prefs =
    preferences && typeof preferences === 'object' && !Array.isArray(preferences)
      ? { ...preferences }
      : {};

  const defaults: UserSettingsEffective = {
    language: platform.language,
    theme: platform.theme,
    chat: {
      defaultModel: platform.defaultModel,
      defaultPrompt: platform.defaultPrompt,
    },
  };

  const overrides: UserSettingsView['overrides'] = {};
  const language = asNonEmptyString(prefs.language);
  const themeRaw = asNonEmptyString(prefs.theme);
  const theme =
    themeRaw === 'light' || themeRaw === 'dark' || themeRaw === 'system'
      ? themeRaw
      : undefined;
  const chatOverrides = readChatOverrides(prefs);

  if (language) overrides.language = language;
  if (theme) overrides.theme = theme;
  if (Object.keys(chatOverrides).length > 0) overrides.chat = chatOverrides;

  let effectiveModel =
    chatOverrides.defaultModel &&
    platform.allowedModels.includes(chatOverrides.defaultModel)
      ? chatOverrides.defaultModel
      : defaults.chat.defaultModel;

  if (
    chatOverrides.defaultModel &&
    !platform.allowedModels.includes(chatOverrides.defaultModel)
  ) {
    // Invalid override is ignored for effective; still surfaced in overrides for UI repair.
    effectiveModel = defaults.chat.defaultModel;
  }

  const effective: UserSettingsEffective = {
    language: overrides.language || defaults.language,
    theme: overrides.theme || defaults.theme,
    chat: {
      defaultModel: effectiveModel,
      defaultPrompt:
        chatOverrides.defaultPrompt !== undefined
          ? chatOverrides.defaultPrompt.slice(0, platform.maxPromptLength)
          : defaults.chat.defaultPrompt,
    },
  };

  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    defaults,
    overrides,
    effective,
    preferences: prefs,
  };
}

export function mergeSettingsPreferences(
  current: Record<string, unknown> | null | undefined,
  patch: {
    language?: string;
    theme?: 'system' | 'light' | 'dark';
    chatDefaultModel?: string | null;
    chatDefaultPrompt?: string | null;
    preferences?: Record<string, unknown>;
  },
  platform: PlatformSettingsDefaults = defaultPlatformSettings(),
): Record<string, unknown> {
  const base =
    current && typeof current === 'object' && !Array.isArray(current)
      ? { ...current }
      : {};

  if (patch.preferences) {
    Object.assign(base, patch.preferences);
  }
  if (patch.language !== undefined) {
    base.language = patch.language;
  }
  if (patch.theme !== undefined) {
    base.theme = patch.theme;
  }

  const chatRaw = base.chat;
  const chat =
    chatRaw && typeof chatRaw === 'object' && !Array.isArray(chatRaw)
      ? { ...(chatRaw as Record<string, unknown>) }
      : {};

  if (patch.chatDefaultModel !== undefined) {
    if (patch.chatDefaultModel === null) {
      delete chat.defaultModel;
    } else if (!platform.allowedModels.includes(patch.chatDefaultModel)) {
      throw new Error(`MODEL_NOT_ALLOWED:${patch.chatDefaultModel}`);
    } else {
      chat.defaultModel = patch.chatDefaultModel;
    }
  }
  if (patch.chatDefaultPrompt !== undefined) {
    if (patch.chatDefaultPrompt === null) {
      delete chat.defaultPrompt;
    } else {
      chat.defaultPrompt = patch.chatDefaultPrompt.slice(0, platform.maxPromptLength);
    }
  }
  if (Object.keys(chat).length > 0) {
    base.chat = chat;
  } else {
    delete base.chat;
  }

  return base;
}
