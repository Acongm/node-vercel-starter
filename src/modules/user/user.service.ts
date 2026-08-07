import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthPrincipal } from '../auth/roles';
import { SupabaseRequestClientService } from '../auth/supabase-request-client.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

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
      .select('id, display_name, avatar_url, preferences, created_at, updated_at')
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

    const row = {
      id: userId,
      ...(dto.displayName !== undefined
        ? { display_name: dto.displayName.trim() }
        : {}),
      ...(dto.avatarUrl !== undefined ? { avatar_url: dto.avatarUrl } : {}),
      ...(dto.preferences !== undefined
        ? { preferences: dto.preferences }
        : {}),
    };

    const { data, error } = await client
      .from('profiles')
      .upsert(row, { onConflict: 'id' })
      .select('id, display_name, avatar_url, preferences, created_at, updated_at')
      .single();

    if (error) {
      throw new Error(`Failed to update user profile: ${error.message}`);
    }

    return data;
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
