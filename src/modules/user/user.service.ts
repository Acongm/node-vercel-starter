import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig, DEFAULT_AI_MODEL } from '../../config/app-config';
import { AuthPrincipal } from '../auth/roles';
import { SupabaseRequestClientService } from '../auth/supabase-request-client.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import {
  ProfileRow,
  mergeSettingsPreferences,
  resolveUserInfo,
  resolveUserSettings,
} from './user-info';
import {
  USER_SETTINGS_SCHEMA_VERSION,
  assertSettingsPatch,
  mergeSettingsOverrides,
  overridesFromSettingsRow,
  readSettingsOverrides,
  resolveSettingsDocument,
  settingsPolicyFromModel,
  settingsRowPatch,
  toPreferences,
  type SettingsOverrides,
  type UserSettingsDocument,
  type UserSettingsRow,
} from './user-settings';

const PROFILE_COLUMNS =
  'id, display_name, avatar_url, preferences, created_at, updated_at';
const SETTINGS_COLUMNS =
  'user_id, schema_version, language, theme, default_model, default_prompt, created_at, updated_at';

export type UserMeResponse = {
  id: string;
  email?: string;
  name?: string;
  role: AuthPrincipal['role'];
  tier: AuthPrincipal['tier'];
  isAnonymous: boolean;
  profile: ProfileRow | null;
  /** UI-ready identity for auth state display (nav / avatar / menu). */
  userInfo: ReturnType<typeof resolveUserInfo>;
  /** Typed settings view from user_settings, falling back to preferences. */
  settings: ReturnType<typeof resolveUserSettings>;
};

@Injectable()
export class UserService {
  private readonly settingsCache = new Map<string, UserSettingsDocument>();

  constructor(
    private readonly supabaseClients: SupabaseRequestClientService,
    @Optional() @Inject(APP_CONFIG) private readonly appConfig?: AppConfig,
  ) {}

  /**
   * Canonical account snapshot used by Auth/Chat/Portal for login-state UI.
   * Alias: GET /api/user/info (getUserInfo).
   */
  async me(request: Request, principal: AuthPrincipal): Promise<UserMeResponse> {
    const userId = this.requireUserId(principal);
    const [profile, settings] = await this.loadProfileAndSettings(
      request,
      userId,
    );
    return this.toMeResponse(principal, profile, settings);
  }

  /** Explicit getUserInfo alias — same payload as /me. */
  async getUserInfo(
    request: Request,
    principal: AuthPrincipal,
  ): Promise<UserMeResponse> {
    return this.me(request, principal);
  }

  async getProfile(request: Request, principal: AuthPrincipal) {
    const userId = this.requireUserId(principal);
    const profile = await this.loadProfile(request, userId);
    return {
      profile,
      userInfo: resolveUserInfo(principal, profile),
    };
  }

  async getSettings(request: Request, principal: AuthPrincipal) {
    const userId = this.requireUserId(principal);
    const cached = this.settingsCache.get(this.settingsCacheKey(userId));
    if (cached) return cached;

    const document = await this.loadSettingsDocument(request, userId);
    this.settingsCache.set(this.settingsCacheKey(userId), document);
    return document;
  }

  async updateSettings(
    request: Request,
    principal: AuthPrincipal,
    dto: UpdateUserSettingsDto,
  ) {
    if (
      dto.language === undefined &&
      dto.theme === undefined &&
      dto.preferences === undefined &&
      dto.defaultModel === undefined &&
      dto.defaultPrompt === undefined &&
      dto.skills === undefined
    ) {
      throw new BadRequestException({
        code: 'SETTINGS_PATCH_EMPTY',
        message: 'At least one settings field must be supplied.',
      });
    }

    const policy = this.settingsPolicy();
    assertSettingsPatch(dto, policy);
    const userId = this.requireUserId(principal);
    const current = await this.loadSettingsOverrides(request, userId);
    const next = this.mergeSettingsPatch(current, dto);
    const row = await this.writeSettings(request, userId, next);
    if (dto.skills !== undefined) {
      await this.persistAgentSkills(request, userId, next.chat?.skills ?? []);
    }
    const persisted = overridesFromSettingsRow(row);
    const document = resolveSettingsDocument(
      {
        ...persisted,
        chat: {
          ...persisted.chat,
          ...(next.chat?.skills !== undefined ? { skills: next.chat.skills } : {}),
        },
      },
      policy,
    );
    this.settingsCache.set(this.settingsCacheKey(userId), document);
    const profile = await this.loadProfile(request, userId);
    return {
      settings: document,
      userInfo: resolveUserInfo(principal, profile),
    };
  }

  async updateProfile(
    request: Request,
    principal: AuthPrincipal,
    dto: UpdateUserProfileDto,
  ) {
    const userId = this.requireUserId(principal);
    const patch: Record<string, unknown> = {};

    if (dto.displayName !== undefined) {
      patch.display_name =
        dto.displayName === null ? null : dto.displayName.trim();
    }
    if (dto.avatarUrl !== undefined) {
      patch.avatar_url = dto.avatarUrl;
    }
    if (dto.preferences !== undefined) {
      patch.preferences = dto.preferences;
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException({
        code: 'PROFILE_PATCH_EMPTY',
        message: 'At least one profile field must be supplied.',
      });
    }

    const profile = await this.writeProfile(request, userId, patch);
    if (dto.preferences !== undefined) {
      this.settingsCache.delete(this.settingsCacheKey(userId));
    }
    return {
      profile,
      userInfo: resolveUserInfo(principal, profile),
    };
  }

  private toMeResponse(
    principal: AuthPrincipal,
    profile: ProfileRow | null,
    settings: UserSettingsDocument,
  ): UserMeResponse {
    return {
      id: principal.userId!,
      email: principal.email,
      name: principal.name,
      role: principal.role,
      tier: principal.tier,
      isAnonymous: principal.tier === 'anon',
      profile,
      userInfo: resolveUserInfo(principal, profile),
      settings: {
        language: settings.language,
        theme: settings.theme,
        chat: settings.effective.chat,
        preferences: settings.preferences,
      },
    };
  }

  private settingsCacheKey(userId: string): string {
    return `${userId}:${USER_SETTINGS_SCHEMA_VERSION}`;
  }

  private async loadProfileAndSettings(
    request: Request,
    userId: string,
  ): Promise<readonly [ProfileRow | null, UserSettingsDocument]> {
    const cacheKey = this.settingsCacheKey(userId);
    const cachedSettings = this.settingsCache.get(cacheKey);
    if (cachedSettings) {
      return [await this.loadProfile(request, userId), cachedSettings];
    }

    const [profile, settingsRow] = await Promise.all([
      this.loadProfile(request, userId),
      this.loadSettingsRow(request, userId),
    ]);
    const document = resolveSettingsDocument(
      this.composeSettingsOverrides(settingsRow, profile?.preferences),
      this.settingsPolicy(),
    );
    this.settingsCache.set(cacheKey, document);
    return [profile, document];
  }

  private async loadSettingsDocument(
    request: Request,
    userId: string,
  ): Promise<UserSettingsDocument> {
    return resolveSettingsDocument(
      await this.loadSettingsOverrides(request, userId),
      this.settingsPolicy(),
    );
  }

  private async loadSettingsOverrides(
    request: Request,
    userId: string,
  ): Promise<SettingsOverrides> {
    const [row, profile] = await Promise.all([
      this.loadSettingsRow(request, userId),
      this.loadProfile(request, userId),
    ]);
    return this.composeSettingsOverrides(row, profile?.preferences);
  }

  private composeSettingsOverrides(
    row: UserSettingsRow | null,
    preferences: Record<string, unknown> | null | undefined,
  ): SettingsOverrides {
    const fromPrefs = readSettingsOverrides(preferences);
    if (!row) return fromPrefs;
    const fromRow = overridesFromSettingsRow(row);
    if (!fromPrefs.chat?.skills) return fromRow;
    return {
      ...fromRow,
      chat: {
        ...fromRow.chat,
        skills: fromPrefs.chat.skills,
      },
    };
  }

  private async persistAgentSkills(
    request: Request,
    userId: string,
    skills: NonNullable<SettingsOverrides['chat']>['skills'],
  ): Promise<void> {
    const profile = await this.loadProfile(request, userId);
    const preferences =
      profile?.preferences && typeof profile.preferences === 'object'
        ? { ...profile.preferences }
        : {};
    const chat =
      preferences.chat &&
      typeof preferences.chat === 'object' &&
      !Array.isArray(preferences.chat)
        ? { ...(preferences.chat as Record<string, unknown>) }
        : {};
    if (skills && skills.length > 0) {
      chat.skills = skills;
    } else {
      delete chat.skills;
    }
    if (Object.keys(chat).length > 0) {
      preferences.chat = chat;
    } else {
      delete preferences.chat;
    }
    await this.writeProfile(request, userId, { preferences });
  }

  private mergeSettingsPatch(
    current: SettingsOverrides,
    dto: UpdateUserSettingsDto,
  ): SettingsOverrides {
    const fromPreferences = dto.preferences
      ? readSettingsOverrides(
          mergeSettingsPreferences(toPreferences(current), {
            preferences: dto.preferences,
          }),
        )
      : current;
    return mergeSettingsOverrides(fromPreferences, dto);
  }

  private async loadSettingsRow(
    request: Request,
    userId: string,
  ): Promise<UserSettingsRow | null> {
    const client = this.supabaseClients.create(request);
    const { data, error } = await client
      .from('user_settings')
      .select(SETTINGS_COLUMNS)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load user settings: ${error.message}`);
    }
    return (data as UserSettingsRow | null) ?? null;
  }

  private async writeSettings(
    request: Request,
    userId: string,
    overrides: SettingsOverrides,
  ): Promise<UserSettingsRow> {
    const client = this.supabaseClients.create(request);
    const patch = settingsRowPatch(overrides);
    const { data: updated, error: updateError } = await client
      .from('user_settings')
      .update(patch)
      .eq('user_id', userId)
      .select(SETTINGS_COLUMNS)
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed to update user settings: ${updateError.message}`);
    }
    if (updated) {
      return updated as UserSettingsRow;
    }

    const { data: inserted, error: insertError } = await client
      .from('user_settings')
      .insert({ user_id: userId, ...patch })
      .select(SETTINGS_COLUMNS)
      .single();

    if (insertError) {
      throw new Error(`Failed to create user settings: ${insertError.message}`);
    }
    return inserted as UserSettingsRow;
  }

  private settingsPolicy() {
    return settingsPolicyFromModel(this.appConfig?.ai.model || DEFAULT_AI_MODEL);
  }

  private async loadProfile(
    request: Request,
    userId: string,
  ): Promise<ProfileRow | null> {
    const client = this.supabaseClients.create(request);
    const { data: profile, error } = await client
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load user profile: ${error.message}`);
    }
    return (profile as ProfileRow | null) ?? null;
  }

  private async writeProfile(
    request: Request,
    userId: string,
    patch: Record<string, unknown>,
  ): Promise<ProfileRow> {
    const client = this.supabaseClients.create(request);

    // PATCH existing rows with PostgREST update semantics so omitted fields are
    // never rewritten. This avoids relying on partial upsert behavior.
    const { data: updated, error: updateError } = await client
      .from('profiles')
      .update(patch)
      .eq('id', userId)
      .select(PROFILE_COLUMNS)
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed to update user profile: ${updateError.message}`);
    }
    if (updated) {
      return updated as ProfileRow;
    }

    // No row exists yet: create the application profile. Database defaults fill
    // omitted fields (notably preferences = {}). A concurrent first-write may
    // conflict and is surfaced rather than silently overwriting another patch.
    const { data: inserted, error: insertError } = await client
      .from('profiles')
      .insert({ id: userId, ...patch })
      .select(PROFILE_COLUMNS)
      .single();

    if (insertError) {
      throw new Error(`Failed to create user profile: ${insertError.message}`);
    }

    return inserted as ProfileRow;
  }

  private requireUserId(principal: AuthPrincipal): string {
    if (!principal.userId || principal.source !== 'supabase') {
      throw new UnauthorizedException({
        code: 'SUPABASE_AUTH_REQUIRED',
        message: 'A verified Supabase user is required.',
      });
    }
    return principal.userId;
  }
}
