import { DEFAULT_AI_MODEL } from '../../config/app-config';
import { AuthPrincipal } from '../auth/roles';
import {
  readSettingsOverrides,
  resolveSettingsDocument,
  settingsPolicyFromModel,
  type AgentSkill,
  type SettingsPatch,
} from './user-settings';

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

export type UserSettingsView = {
  language: string;
  theme: 'system' | 'light' | 'dark';
  chat: {
    defaultModel: string;
    defaultPrompt: string;
    skills: AgentSkill[];
  };
  /** Full preferences object; known keys are also mirrored above. */
  preferences: Record<string, unknown>;
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

export function resolveUserSettings(
  preferences: Record<string, unknown> | null | undefined,
  defaultModel = DEFAULT_AI_MODEL,
): UserSettingsView {
  const prefs =
    preferences && typeof preferences === 'object' && !Array.isArray(preferences)
      ? { ...preferences }
      : {};
  const document = resolveSettingsDocument(
    readSettingsOverrides(prefs),
    settingsPolicyFromModel(defaultModel),
  );
  return {
    language: document.language,
    theme: document.theme,
    chat: document.effective.chat,
    preferences: { ...prefs, ...document.preferences },
  };
}

export function mergeSettingsPreferences(
  current: Record<string, unknown> | null | undefined,
  patch: SettingsPatch & { preferences?: Record<string, unknown> },
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

  const chat =
    base.chat && typeof base.chat === 'object' && !Array.isArray(base.chat)
      ? { ...(base.chat as Record<string, unknown>) }
      : {};
  if (patch.defaultModel !== undefined) {
    chat.defaultModel = patch.defaultModel;
  }
  if (patch.defaultPrompt === null) {
    delete chat.defaultPrompt;
  } else if (patch.defaultPrompt !== undefined) {
    chat.defaultPrompt = patch.defaultPrompt;
  }
  if (patch.skills === null) {
    delete chat.skills;
  } else if (patch.skills !== undefined) {
    chat.skills = patch.skills;
  }
  if (Object.keys(chat).length) {
    base.chat = chat;
  } else {
    delete base.chat;
  }
  return base;
}
