import { Inject, Injectable } from '@nestjs/common';
import { createClient, User } from '@supabase/supabase-js';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { AuthPrincipal, PlatformRole, isPlatformRole } from './roles';

@Injectable()
export class SupabaseAuthService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.supabase.url &&
        (this.config.supabase.publicKey || this.config.supabase.apiKey),
    );
  }

  async verifyAccessToken(token: string): Promise<AuthPrincipal | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const client = createClient(
      this.config.supabase.url!,
      this.config.supabase.publicKey || this.config.supabase.apiKey!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    );

    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }

    return this.toPrincipal(data.user);
  }

  private toPrincipal(user: User): AuthPrincipal {
    const isAnonymous = Boolean(
      (user as User & { is_anonymous?: boolean }).is_anonymous,
    );

    return {
      userId: user.id,
      role: this.extractRole(user),
      tier: isAnonymous ? 'anon' : 'user',
      email: user.email,
      name: this.extractDisplayName(user),
      source: 'supabase',
    };
  }

  /** Authorization only trusts server-controlled app_metadata. */
  private extractRole(user: User): PlatformRole {
    const appMetadata = user.app_metadata || {};
    const direct = appMetadata.platform_role || appMetadata.role;
    if (isPlatformRole(direct) && direct !== 'anonymous') {
      return direct;
    }

    const roles = appMetadata.roles;
    if (Array.isArray(roles)) {
      for (const candidate of roles) {
        if (isPlatformRole(candidate) && candidate !== 'anonymous') {
          return candidate;
        }
      }
    }

    return 'viewer';
  }

  private extractDisplayName(user: User): string | undefined {
    const metadata = user.user_metadata || {};
    const value = metadata.name || metadata.full_name || metadata.user_name;
    return typeof value === 'string' && value.trim()
      ? value.trim()
      : user.email;
  }
}
