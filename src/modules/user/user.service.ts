import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
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

const PROFILE_COLUMNS =
  'id, display_name, avatar_url, preferences, created_at, updated_at';

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
  constructor(
    private readonly supabaseClients: SupabaseRequestClientService,
  ) {}

  /**
   * Canonical account snapshot used by Auth/Chat/Portal for login-state UI.
   * Alias: GET /api/user/info (getUserInfo).
   */
  async me(request: Request, principal: AuthPrincipal): Promise<UserMeResponse> {
    const userId = this.requireUserId(principal);
    const profile = await this.loadProfile(request, userId);
    return this.toMeResponse(principal, profile);
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
    const profile = await this.loadProfile(request, userId);
    return resolveUserSettings(profile?.preferences ?? null);
  }

  async updateSettings(
    request: Request,
    principal: AuthPrincipal,
    dto: UpdateUserSettingsDto,
  ) {
    if (
      dto.language === undefined &&
      dto.theme === undefined &&
      dto.preferences === undefined
    ) {
      throw new BadRequestException({
        code: 'SETTINGS_PATCH_EMPTY',
        message: 'At least one settings field must be supplied.',
      });
    }

    const userId = this.requireUserId(principal);
    const profile = await this.loadProfile(request, userId);
    const nextPreferences = mergeSettingsPreferences(profile?.preferences, dto);
    const updated = await this.writeProfile(request, userId, {
      preferences: nextPreferences,
    });
    return {
      settings: resolveUserSettings(updated.preferences),
      userInfo: resolveUserInfo(principal, updated),
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
    return {
      profile,
      userInfo: resolveUserInfo(principal, profile),
    };
  }

  private toMeResponse(
    principal: AuthPrincipal,
    profile: ProfileRow | null,
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
      settings: resolveUserSettings(profile?.preferences ?? null),
    };
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
