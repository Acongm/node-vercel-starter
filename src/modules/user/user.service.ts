import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthPrincipal } from '../auth/roles';
import { SupabaseRequestClientService } from '../auth/supabase-request-client.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

const PROFILE_COLUMNS =
  'id, display_name, avatar_url, preferences, created_at, updated_at';

@Injectable()
export class UserService {
  constructor(
    private readonly supabaseClients: SupabaseRequestClientService,
  ) {}

  async me(request: Request, principal: AuthPrincipal) {
    const userId = this.requireUserId(principal);
    const client = this.supabaseClients.create(request);

    const { data: profile, error } = await client
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load user profile: ${error.message}`);
    }

    return {
      id: userId,
      email: principal.email,
      name: principal.name,
      role: principal.role,
      tier: principal.tier,
      isAnonymous: principal.tier === 'anon',
      profile,
    };
  }

  async updateProfile(
    request: Request,
    principal: AuthPrincipal,
    dto: UpdateUserProfileDto,
  ) {
    const userId = this.requireUserId(principal);
    const client = this.supabaseClients.create(request);
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
      return updated;
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

    return inserted;
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
