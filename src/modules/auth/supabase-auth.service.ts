import { Inject, Injectable } from '@nestjs/common';
import { createClient, User } from '@supabase/supabase-js';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { logEvent } from '../logs';
import { AuthPrincipal, PlatformRole, isPlatformRole } from './roles';

type ClaimsLike = {
  sub?: string;
  email?: string;
  is_anonymous?: boolean;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

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

    const started = Date.now();
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

    // Prefer local JWKS / getClaims when the Auth client supports it so ordinary
    // API requests avoid a remote getUser round-trip. Fall back to getUser for
    // HS256/legacy deployments or when claims cannot be resolved.
    const fromClaims = await this.tryVerifyWithClaims(client as never, token);
    if (fromClaims) {
      logEvent({
        event: 'auth.verify.success',
        module: 'auth',
        durationMs: Date.now() - started,
        source: 'getClaims',
        tier: fromClaims.tier,
      });
      return fromClaims;
    }

    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      logEvent({
        level: 'warn',
        event: 'auth.verify.failure',
        module: 'auth',
        durationMs: Date.now() - started,
        source: 'getUser',
        errorCode: error?.name || 'INVALID_TOKEN',
      });
      return null;
    }

    const principal = this.toPrincipal(data.user);
    logEvent({
      event: 'auth.verify.success',
      module: 'auth',
      durationMs: Date.now() - started,
      source: 'getUser',
      tier: principal.tier,
    });
    return principal;
  }

  private async tryVerifyWithClaims(
    client: { auth: Record<string, unknown> },
    token: string,
  ): Promise<AuthPrincipal | null> {
    const getClaims = client.auth.getClaims as
      | ((
          jwt?: string,
        ) => Promise<{
          data: { claims: ClaimsLike } | null;
          error: { message?: string } | null;
        }>)
      | undefined;
    if (typeof getClaims !== 'function') {
      return null;
    }

    try {
      const { data, error } = await getClaims(token);
      if (error || !data?.claims?.sub) {
        return null;
      }
      return this.toPrincipalFromClaims(data.claims);
    } catch {
      return null;
    }
  }

  private toPrincipalFromClaims(claims: ClaimsLike): AuthPrincipal {
    const isAnonymous = Boolean(claims.is_anonymous);
    const appMetadata = claims.app_metadata || {};
    const userMetadata = claims.user_metadata || {};

    return {
      userId: claims.sub!,
      role: isAnonymous ? 'anonymous' : this.extractRoleFromMetadata(appMetadata),
      tier: isAnonymous ? 'anon' : 'user',
      email: typeof claims.email === 'string' ? claims.email : undefined,
      name: this.extractDisplayNameFromMetadata(
        userMetadata,
        typeof claims.email === 'string' ? claims.email : undefined,
      ),
      avatarUrl: this.extractAvatarUrlFromMetadata(userMetadata),
      source: 'supabase',
    };
  }

  private toPrincipal(user: User): AuthPrincipal {
    const isAnonymous = Boolean(
      (user as User & { is_anonymous?: boolean }).is_anonymous,
    );

    return {
      userId: user.id,
      // A Supabase anonymous identity is stable enough for auth.uid()/RLS, but
      // it must not inherit viewer/editor/admin authorization from metadata.
      role: isAnonymous ? 'anonymous' : this.extractRole(user),
      tier: isAnonymous ? 'anon' : 'user',
      email: user.email,
      name: this.extractDisplayName(user),
      avatarUrl: this.extractAvatarUrl(user),
      source: 'supabase',
    };
  }

  /** Authorization only trusts server-controlled app_metadata. */
  private extractRole(user: User): PlatformRole {
    return this.extractRoleFromMetadata(user.app_metadata || {});
  }

  private extractRoleFromMetadata(
    appMetadata: Record<string, unknown>,
  ): PlatformRole {
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
    return this.extractDisplayNameFromMetadata(
      user.user_metadata || {},
      user.email,
    );
  }

  private extractDisplayNameFromMetadata(
    metadata: Record<string, unknown>,
    email?: string,
  ): string | undefined {
    const value =
      metadata.display_name ||
      metadata.name ||
      metadata.full_name ||
      metadata.user_name ||
      metadata.preferred_username;
    return typeof value === 'string' && value.trim()
      ? value.trim()
      : email;
  }

  private extractAvatarUrl(user: User): string | undefined {
    return this.extractAvatarUrlFromMetadata(user.user_metadata || {});
  }

  private extractAvatarUrlFromMetadata(
    metadata: Record<string, unknown>,
  ): string | undefined {
    const value =
      metadata.avatar_url ||
      metadata.picture ||
      metadata.avatar ||
      metadata.profile_image;
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
