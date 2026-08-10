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

export type UserSettingsView = {
  language: string;
  theme: 'system' | 'light' | 'dark';
  /** Full preferences object; known keys are also mirrored above. */
  preferences: Record<string, unknown>;
};

const DEFAULT_LANGUAGE = 'zh-CN';
const DEFAULT_THEME = 'system' as const;

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
): UserSettingsView {
  const prefs =
    preferences && typeof preferences === 'object' && !Array.isArray(preferences)
      ? { ...preferences }
      : {};

  const language = asNonEmptyString(prefs.language) || DEFAULT_LANGUAGE;
  const themeRaw = asNonEmptyString(prefs.theme);
  const theme =
    themeRaw === 'light' || themeRaw === 'dark' || themeRaw === 'system'
      ? themeRaw
      : DEFAULT_THEME;

  return {
    language,
    theme,
    preferences: prefs,
  };
}

export function mergeSettingsPreferences(
  current: Record<string, unknown> | null | undefined,
  patch: { language?: string; theme?: 'system' | 'light' | 'dark'; preferences?: Record<string, unknown> },
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
  return base;
}
