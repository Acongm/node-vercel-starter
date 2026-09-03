import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient, createClient, User } from '@supabase/supabase-js';
import { appLogger } from '../../common/app-logger';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { isAdminEmail } from './admin-emails';
import { jwtExpiresAtMs } from './bearer-token';
import { AuthPrincipal, PlatformRole, isPlatformRole } from './roles';
import {
  SupabaseJwtClaims,
  verifySupabaseJwt,
} from './supabase-access-token';

const TOKEN_CACHE_TTL_MS = 300_000;
const TOKEN_CACHE_MAX_ENTRIES = 1_000;
const JWKS_TTL_MS = 60 * 60 * 1000;

type Jwk = {
  kid?: string;
  alg?: string;
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
  n?: string;
  e?: string;
  use?: string;
};

type CachedPrincipal = {
  principal: AuthPrincipal | null;
  expiresAt: number;
};

@Injectable()
export class SupabaseAuthService {
  private client: SupabaseClient | null = null;
  private readonly tokenCache = new Map<string, CachedPrincipal>();
  private jwksCache: { keys: Jwk[]; expiresAt: number } | null = null;

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

    const localPrincipal = await this.verifySignedAccessToken(token);
    if (localPrincipal) {
      this.rememberToken(cacheKey, localPrincipal, token);
      this.logVerifyResult(localPrincipal);
      return localPrincipal;
    }

    const client = this.getClient();
    const { data, error } = await client.auth.getUser(token);
    const principal = error || !data.user ? null : this.toPrincipal(data.user);
    this.rememberToken(cacheKey, principal, token);
    this.logVerifyResult(principal);
    return principal;
  }

  private logVerifyResult(principal: AuthPrincipal | null): void {
    if (!principal) {
      appLogger.warn({ event: 'auth.verify.fail' });
      return;
    }
    appLogger.info({
      event: 'auth.verify.ok',
      userId: principal.userId,
      role: principal.role,
      tier: principal.tier,
    });
  }

  private async verifySignedAccessToken(
    token: string,
  ): Promise<AuthPrincipal | null> {
    const claims = await verifySupabaseJwt(token, {
      jwks: await this.loadJwks(),
      hs256Secret: this.config.auth.supabaseJwtSecret,
    });
    if (!claims?.sub) return null;
    return this.toPrincipalFromClaims(claims);
  }

  private async loadJwks(): Promise<Jwk[]> {
    if (this.jwksCache && this.jwksCache.expiresAt > Date.now()) {
      return this.jwksCache.keys;
    }

    const baseUrl = this.config.supabase.url?.replace(/\/$/, '');
    if (!baseUrl) return [];

    try {
      const response = await fetch(`${baseUrl}/auth/v1/.well-known/jwks.json`);
      if (!response.ok) {
        this.rememberJwks([], 30_000);
        return [];
      }
      const body = (await response.json()) as { keys?: Jwk[] };
      const keys = Array.isArray(body.keys) ? body.keys : [];
      this.rememberJwks(keys, keys.length ? JWKS_TTL_MS : 30_000);
      return keys;
    } catch {
      this.rememberJwks([], 30_000);
      return [];
    }
  }

  private rememberJwks(keys: Jwk[], ttlMs: number) {
    this.jwksCache = { keys, expiresAt: Date.now() + ttlMs };
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
    return this.toPrincipalFromIdentity(user.id, {
      email: user.email,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
      is_anonymous: Boolean(
        (user as User & { is_anonymous?: boolean }).is_anonymous,
      ),
    });
  }

  private toPrincipalFromClaims(claims: SupabaseJwtClaims): AuthPrincipal {
    return this.toPrincipalFromIdentity(claims.sub ?? '', {
      email: claims.email,
      app_metadata: claims.app_metadata,
      user_metadata: claims.user_metadata,
      is_anonymous: Boolean(claims.is_anonymous),
    });
  }

  private toPrincipalFromIdentity(
    userId: string,
    identity: SupabaseJwtClaims,
  ): AuthPrincipal {
    const isAnonymous = Boolean(identity.is_anonymous);

    return {
      userId,
      // A Supabase anonymous identity is stable enough for auth.uid()/RLS, but
      // it must not inherit viewer/editor/admin authorization from metadata.
      role: isAnonymous ? 'anonymous' : this.extractRole(identity),
      tier: isAnonymous ? 'anon' : 'user',
      source: 'supabase',
      email: identity.email,
      name: this.extractDisplayName(identity),
      avatarUrl: this.extractAvatarUrl(identity),
    };
  }

  /** Authorization only trusts server-controlled app_metadata. */
  private extractRole(identity: SupabaseJwtClaims): PlatformRole {
    if (isAdminEmail(identity.email, this.config.auth.adminEmails)) {
      return 'admin';
    }

    const appMetadata = identity.app_metadata || {};
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

  private extractDisplayName(identity: SupabaseJwtClaims): string | undefined {
    const metadata = identity.user_metadata || {};
    const value =
      metadata.display_name ||
      metadata.name ||
      metadata.full_name ||
      metadata.user_name ||
      metadata.preferred_username;
    return typeof value === 'string' && value.trim()
      ? value.trim()
      : identity.email;
  }

  private extractAvatarUrl(identity: SupabaseJwtClaims): string | undefined {
    const metadata = identity.user_metadata || {};
    const value =
      metadata.avatar_url || metadata.picture || metadata.avatar || metadata.profile_image;
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
