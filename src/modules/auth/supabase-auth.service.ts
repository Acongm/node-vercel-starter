import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient, createClient, User } from '@supabase/supabase-js';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { jwtExpiresAtMs } from './bearer-token';
import { AuthPrincipal, PlatformRole, isPlatformRole } from './roles';

const TOKEN_CACHE_TTL_MS = 300_000;
const TOKEN_CACHE_MAX_ENTRIES = 1_000;

type CachedPrincipal = {
  principal: AuthPrincipal | null;
  expiresAt: number;
};

@Injectable()
export class SupabaseAuthService {
  private client: SupabaseClient | null = null;
  private readonly tokenCache = new Map<string, CachedPrincipal>();

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

    const cacheKey = this.hashToken(token);
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.principal;
    }

    const client = this.getClient();
    const { data, error } = await client.auth.getUser(token);
    const principal = error || !data.user ? null : this.toPrincipal(data.user);
    this.rememberToken(cacheKey, principal, token);
    return principal;
  }

  private getClient(): SupabaseClient {
    if (this.client) {
      return this.client;
    }

    this.client = createClient(
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
    return this.client;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private rememberToken(
    cacheKey: string,
    principal: AuthPrincipal | null,
    token: string,
  ): void {
    const ttlMs = this.cacheTtlMs(token);
    if (ttlMs <= 0) {
      this.tokenCache.delete(cacheKey);
      return;
    }

    if (this.tokenCache.size >= TOKEN_CACHE_MAX_ENTRIES) {
      const oldestKey = this.tokenCache.keys().next().value;
      if (oldestKey) {
        this.tokenCache.delete(oldestKey);
      }
    }

    this.tokenCache.set(cacheKey, {
      principal,
      expiresAt: Date.now() + ttlMs,
    });
  }

  private cacheTtlMs(token: string): number {
    const expMs = jwtExpiresAtMs(token);
    if (expMs === undefined) return TOKEN_CACHE_TTL_MS;
    return Math.max(0, Math.min(TOKEN_CACHE_TTL_MS, expMs - Date.now()));
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
      source: 'supabase',
      email: user.email,
      name: this.extractDisplayName(user),
      avatarUrl: this.extractAvatarUrl(user),
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
    const value =
      metadata.display_name ||
      metadata.name ||
      metadata.full_name ||
      metadata.user_name ||
      metadata.preferred_username;
    return typeof value === 'string' && value.trim()
      ? value.trim()
      : user.email;
  }

  private extractAvatarUrl(user: User): string | undefined {
    const metadata = user.user_metadata || {};
    const value =
      metadata.avatar_url || metadata.picture || metadata.avatar || metadata.profile_image;
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
