import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { AuthPrincipal } from '../auth/roles';
import { SupabaseRequestClientService } from '../auth/supabase-request-client.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import {
  ProfileRow,
  SETTINGS_SCHEMA_VERSION,
  defaultPlatformSettings,
  mergeSettingsPreferences,
  resolveUserInfo,
  resolveUserSettings,
} from './user-info';

const PROFILE_COLUMNS =
  'id, display_name, avatar_url, preferences, created_at, updated_at';

const SETTINGS_CACHE_TTL_MS = 60_000;

type CachedSettings = {
  expiresAt: number;
  preferences: Record<string, unknown> | null;
};

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
  /** Typed settings view derived from preferences. */
  settings: ReturnType<typeof resolveUserSettings>;
};

@Injectable()
export class UserService {
  private readonly settingsCache = new Map<string, CachedSettings>();

  constructor(
    private readonly supabaseClients: SupabaseRequestClientService,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
  ) {}

  private platformDefaults() {
    return defaultPlatformSettings({
      defaultModel: this.appConfig.ai.model,
      allowedModels: [this.appConfig.ai.model],
    });
  }

  /**
   * Canonical account snapshot used by Auth/Chat/Portal for login-state UI.
   * Alias: GET /api/user/info (getUserInfo).
   */
  async me(request: Request, principal: AuthPrincipal): Promise<UserMeResponse> {
    const userId = this.requireUserId(principal);
    const profile = await this.loadProfile(request, userId);
    const preferences = await this.loadSettingsPreferences(
      request,
      userId,
      profile?.preferences ?? null,
    );
    return this.toMeResponse(principal, profile, preferences);
  }

  /** Explicit getUserInfo alias — same payload as /me. */
  async getUserInfo(
    request: Request,
    principal: AuthPrincipal,
  ): Promise<UserMeResponse> {
    return this.me(request, principal);
  }

  async getSettings(request: Request, principal: AuthPrincipal) {
    const userId = this.requireUserId(principal);
    const preferences = await this.loadSettingsPreferences(request, userId);
    return resolveUserSettings(preferences, this.platformDefaults());
  }

  /**
   * Cached effective settings for Chat send path. Avoids a remote round-trip
   * when settings were already loaded (me/settings) within the TTL window.
   */
  async getSettingsCached(request: Request, principal: AuthPrincipal) {
    return this.getSettings(request, principal);
  }

  async updateSettings(
    request: Request,
    principal: AuthPrincipal,
    dto: UpdateUserSettingsDto,
  ) {
    if (
      dto.language === undefined &&
      dto.theme === undefined &&
      dto.chatDefaultModel === undefined &&
      dto.chatDefaultPrompt === undefined &&
      dto.preferences === undefined
    ) {
      throw new BadRequestException({
        code: 'SETTINGS_PATCH_EMPTY',
        message: 'At least one settings field must be supplied.',
      });
    }

    const userId = this.requireUserId(principal);
    const current = await this.loadSettingsPreferences(request, userId);
    const platform = this.platformDefaults();
    let nextPreferences: Record<string, unknown>;
    try {
      nextPreferences = mergeSettingsPreferences(
        current,
        {
          language: dto.language,
          theme: dto.theme,
          chatDefaultModel: dto.chatDefaultModel,
          chatDefaultPrompt: dto.chatDefaultPrompt,
          preferences: dto.preferences,
        },
        platform,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.startsWith('MODEL_NOT_ALLOWED:')) {
        throw new BadRequestException({
          code: 'SETTINGS_MODEL_NOT_ALLOWED',
          message: `Model is not in the server allow-list: ${message.slice('MODEL_NOT_ALLOWED:'.length)}`,
          allowedModels: platform.allowedModels,
        });
      }
      throw error;
    }

    await this.writeSettingsPreferences(request, userId, nextPreferences);
    this.invalidateSettingsCache(userId);
    return resolveUserSettings(nextPreferences, platform);
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

    const updated = await this.writeProfile(request, userId, patch);
    if (dto.preferences !== undefined) {
      await this.writeSettingsPreferences(
        request,
        userId,
        dto.preferences,
      ).catch(() => {
        // user_settings may be unavailable until migration; profile remains source of truth.
      });
      this.invalidateSettingsCache(userId);
    }
    return updated;
  }

  invalidateSettingsCache(userId: string) {
    this.settingsCache.delete(userId);
  }

  private toMeResponse(
    principal: AuthPrincipal,
    profile: ProfileRow | null,
    preferences: Record<string, unknown> | null,
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
      settings: resolveUserSettings(preferences, this.platformDefaults()),
    };
  }

  private async loadSettingsPreferences(
    request: Request,
    userId: string,
    profileFallback: Record<string, unknown> | null = null,
  ): Promise<Record<string, unknown> | null> {
    const cached = this.settingsCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.preferences;
    }

    const client = this.supabaseClients.create(request);
    const { data, error } = await client
      .from('user_settings')
      .select('settings')
      .eq('user_id', userId)
      .maybeSingle();

    let preferences: Record<string, unknown> | null = null;
    if (!error && data && typeof data === 'object' && 'settings' in data) {
      const settings = (data as { settings: unknown }).settings;
      if (settings && typeof settings === 'object' && !Array.isArray(settings)) {
        preferences = settings as Record<string, unknown>;
      } else {
        preferences = {};
      }
    } else if (profileFallback) {
      preferences = profileFallback;
    } else {
      const profile = await this.loadProfile(request, userId);
      preferences = profile?.preferences ?? null;
    }

    this.settingsCache.set(userId, {
      expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
      preferences,
    });
    return preferences;
  }

  private async writeSettingsPreferences(
    request: Request,
    userId: string,
    preferences: Record<string, unknown>,
  ): Promise<void> {
    const client = this.supabaseClients.create(request);
    const now = new Date().toISOString();

    const { error: upsertError } = await client.from('user_settings').upsert(
      {
        user_id: userId,
        schema_version: SETTINGS_SCHEMA_VERSION,
        settings: preferences,
        updated_at: now,
      },
      { onConflict: 'user_id' },
    );

    if (upsertError) {
      // Fall back to profiles.preferences so settings remain usable before
      // the user_settings migration is applied in every environment.
      await this.writeProfile(request, userId, { preferences });
      return;
    }

    // Dual-write keeps older readers of profiles.preferences in sync.
    await this.writeProfile(request, userId, { preferences }).catch(() => {
      // Primary write already succeeded on user_settings.
    });
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
