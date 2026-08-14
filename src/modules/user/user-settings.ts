import { BadRequestException } from '@nestjs/common';

export const USER_SETTINGS_SCHEMA_VERSION = 1;
export const DEFAULT_PROMPT_MAX_LENGTH = 2000;
export const DEFAULT_LANGUAGE = 'zh-CN';
export const DEFAULT_THEME = 'system' as const;

export type SettingsTheme = 'system' | 'light' | 'dark';

export type SettingsPolicy = {
  defaultModel: string;
  allowedModels: string[];
};

export type SettingsChatOverrides = {
  defaultModel?: string;
  defaultPrompt?: string;
};

export type SettingsOverrides = {
  language?: string;
  theme?: SettingsTheme;
  chat?: SettingsChatOverrides;
};

export type SettingsPatch = {
  language?: string;
  theme?: SettingsTheme;
  defaultModel?: string;
  defaultPrompt?: string | null;
};

export type UserSettingsEffective = {
  language: string;
  theme: SettingsTheme;
  chat: {
    defaultModel: string;
    defaultPrompt: string;
  };
};

export type UserSettingsDocument = {
  schemaVersion: number;
  defaults: UserSettingsEffective;
  overrides: SettingsOverrides;
  effective: UserSettingsEffective;
  language: string;
  theme: SettingsTheme;
  preferences: Record<string, unknown>;
};

export function platformSettingsDefaults(
  policy: SettingsPolicy,
): UserSettingsEffective {
  return {
    language: DEFAULT_LANGUAGE,
    theme: DEFAULT_THEME,
    chat: {
      defaultModel: policy.defaultModel,
      defaultPrompt: '',
    },
  };
}

export function readSettingsOverrides(
  preferences: Record<string, unknown> | null | undefined,
): SettingsOverrides {
  const prefs = asObject(preferences);
  const overrides: SettingsOverrides = {};
  const language = asNonEmptyString(prefs.language);
  const theme = asTheme(prefs.theme);
  const chat = asObject(prefs.chat);
  const defaultModel = asNonEmptyString(chat.defaultModel);
  const defaultPrompt = asString(chat.defaultPrompt);

  if (language) overrides.language = language;
  if (theme) overrides.theme = theme;
  if (defaultModel || defaultPrompt !== undefined) {
    overrides.chat = {};
    if (defaultModel) overrides.chat.defaultModel = defaultModel;
    if (defaultPrompt !== undefined) overrides.chat.defaultPrompt = defaultPrompt;
  }
  return overrides;
}

export function resolveSettingsDocument(
  overrides: SettingsOverrides | null | undefined,
  policy: SettingsPolicy,
): UserSettingsDocument {
  const defaults = platformSettingsDefaults(policy);
  const next = overrides ?? {};
  const effective: UserSettingsEffective = {
    language: next.language || defaults.language,
    theme: next.theme || defaults.theme,
    chat: {
      defaultModel: next.chat?.defaultModel || defaults.chat.defaultModel,
      defaultPrompt:
        next.chat?.defaultPrompt !== undefined
          ? next.chat.defaultPrompt
          : defaults.chat.defaultPrompt,
    },
  };

  return {
    schemaVersion: USER_SETTINGS_SCHEMA_VERSION,
    defaults,
    overrides: next,
    effective,
    language: effective.language,
    theme: effective.theme,
    preferences: toPreferences(next),
  };
}

export function mergeSettingsOverrides(
  current: SettingsOverrides | null | undefined,
  patch: SettingsPatch,
): SettingsOverrides {
  const next: SettingsOverrides = {
    ...(current ?? {}),
    chat: current?.chat ? { ...current.chat } : undefined,
  };

  if (patch.language !== undefined) next.language = patch.language;
  if (patch.theme !== undefined) next.theme = patch.theme;

  if (patch.defaultModel !== undefined || patch.defaultPrompt !== undefined) {
    const chat = { ...(next.chat ?? {}) };
    if (patch.defaultModel !== undefined) {
      chat.defaultModel = patch.defaultModel;
    }
    if (patch.defaultPrompt === null) {
      delete chat.defaultPrompt;
    } else if (patch.defaultPrompt !== undefined) {
      chat.defaultPrompt = patch.defaultPrompt;
    }
    next.chat = Object.keys(chat).length ? chat : undefined;
  }

  if (next.chat && Object.keys(next.chat).length === 0) {
    delete next.chat;
  }
  return next;
}

export function assertSettingsPatch(
  patch: SettingsPatch,
  policy: SettingsPolicy,
): void {
  if (patch.defaultModel !== undefined) {
    if (!policy.allowedModels.includes(patch.defaultModel)) {
      throw new BadRequestException({
        code: 'SETTINGS_MODEL_NOT_ALLOWED',
        message: `Model "${patch.defaultModel}" is not allowed.`,
        allowedModels: policy.allowedModels,
      });
    }
  }

  if (typeof patch.defaultPrompt === 'string') {
    if (patch.defaultPrompt.length > DEFAULT_PROMPT_MAX_LENGTH) {
      throw new BadRequestException({
        code: 'SETTINGS_PROMPT_TOO_LONG',
        message: `defaultPrompt is too long (max ${DEFAULT_PROMPT_MAX_LENGTH}).`,
      });
    }
  }
}

export function settingsPolicyFromModel(defaultModel: string): SettingsPolicy {
  return {
    defaultModel,
    allowedModels: [defaultModel],
  };
}

export type UserSettingsRow = {
  user_id: string;
  schema_version: number;
  language: string | null;
  theme: string | null;
  default_model: string | null;
  default_prompt: string | null;
};

export function overridesFromSettingsRow(
  row: UserSettingsRow,
): SettingsOverrides {
  return readSettingsOverrides({
    language: row.language ?? undefined,
    theme: row.theme ?? undefined,
    chat: {
      defaultModel: row.default_model ?? undefined,
      defaultPrompt: row.default_prompt ?? undefined,
    },
  });
}

export function settingsRowPatch(overrides: SettingsOverrides): {
  schema_version: number;
  language: string | null;
  theme: string | null;
  default_model: string | null;
  default_prompt: string | null;
} {
  return {
    schema_version: USER_SETTINGS_SCHEMA_VERSION,
    language: overrides.language ?? null,
    theme: overrides.theme ?? null,
    default_model: overrides.chat?.defaultModel ?? null,
    default_prompt: overrides.chat?.defaultPrompt ?? null,
  };
}

export function toPreferences(overrides: SettingsOverrides): Record<string, unknown> {
  const prefs: Record<string, unknown> = {};
  if (overrides.language) prefs.language = overrides.language;
  if (overrides.theme) prefs.theme = overrides.theme;
  if (overrides.chat) prefs.chat = { ...overrides.chat };
  return prefs;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...value }
    : {};
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asTheme(value: unknown): SettingsTheme | undefined {
  return value === 'system' || value === 'light' || value === 'dark'
    ? value
    : undefined;
}
