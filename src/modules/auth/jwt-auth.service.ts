import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { extractBearerToken } from './admin-session.guard';
import {
  AuthPrincipal,
  PlatformRole,
  createAnonymousPrincipal,
  isPlatformRole,
} from './roles';

interface JwtClaims {
  sub?: string;
  role?: string;
  name?: string;
  email?: string;
  typ?: string;
  provider?: string;
  app_metadata?: {
    role?: string;
    roles?: string[];
  };
  user_metadata?: Record<string, unknown>;
  aud?: string | string[];
  role_claim?: string;
}

@Injectable()
export class JwtAuthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly jwtService: JwtService,
  ) {}

  async resolvePrincipal(request: Request): Promise<AuthPrincipal> {
    const token = extractBearerToken(request);
    if (!token) {
      return createAnonymousPrincipal();
    }

    return this.verifyAccessToken(token);
  }

  async verifyAccessToken(token: string): Promise<AuthPrincipal> {
    const localPrincipal = await this.tryVerifyLocalAccessToken(token);
    if (localPrincipal) {
      return localPrincipal;
    }

    const adminPrincipal = await this.tryVerifyAdminSession(token);
    if (adminPrincipal) {
      return adminPrincipal;
    }

    const supabasePrincipal = await this.tryVerifySupabaseJwt(token);
    if (supabasePrincipal) {
      return supabasePrincipal;
    }

    throw new UnauthorizedException({
      code: 'INVALID_TOKEN',
      message: 'Invalid or expired access token.',
    });
  }

  private async tryVerifyLocalAccessToken(
    token: string,
  ): Promise<AuthPrincipal | null> {
    const secret = this.config.auth.jwtSecret;
    if (!secret) return null;

    try {
      const payload = await this.jwtService.verifyAsync<JwtClaims>(token, {
        secret,
      });
      if (payload.typ !== 'access' || !payload.sub) {
        return null;
      }
      if (!isPlatformRole(payload.role) || payload.role === 'anonymous') {
        return null;
      }

      return {
        userId: payload.sub,
        role: payload.role,
        tier: 'user',
        email: payload.email,
        name: payload.name || payload.email,
        source: 'local',
      };
    } catch {
      return null;
    }
  }

  private async tryVerifyAdminSession(
    token: string,
  ): Promise<AuthPrincipal | null> {
    const { jwtSecret, adminUsername, adminPassword } = this.config.auth;
    if (!jwtSecret || !adminUsername || !adminPassword) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtClaims>(token, {
        secret: jwtSecret,
      });

      if (payload.typ === 'access' || payload.role !== 'admin') {
        return null;
      }

      return {
        userId: payload.sub || adminUsername,
        role: 'admin',
        tier: 'user',
        name: payload.name || adminUsername,
        source: 'admin-session',
      };
    } catch {
      return null;
    }
  }

  private async tryVerifySupabaseJwt(
    token: string,
  ): Promise<AuthPrincipal | null> {
    const secret = this.config.auth.supabaseJwtSecret;
    if (!secret) {
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtClaims>(token, {
        secret,
      });

      const role = this.extractRole(payload);
      const userId = payload.sub;
      if (!userId) {
        return null;
      }

      return {
        userId,
        role,
        tier: 'user',
        email: payload.email,
        name:
          payload.name ||
          (typeof payload.user_metadata?.name === 'string'
            ? payload.user_metadata.name
            : undefined) ||
          payload.email,
        source: 'supabase',
      };
    } catch {
      return null;
    }
  }

  /**
   * Authorization roles must come from app_metadata (not user_metadata).
   * user_metadata is user-editable in Supabase and must not drive ACL.
   */
  private extractRole(payload: JwtClaims): PlatformRole {
    const fromAppMeta = payload.app_metadata?.role;
    if (isPlatformRole(fromAppMeta) && fromAppMeta !== 'anonymous') {
      return fromAppMeta;
    }

    const roles = payload.app_metadata?.roles;
    if (Array.isArray(roles)) {
      for (const candidate of roles) {
        if (isPlatformRole(candidate) && candidate !== 'anonymous') {
          return candidate;
        }
      }
    }

    // Legacy admin-session style claim on shared secret tokens.
    if (payload.role === 'admin') {
      return 'admin';
    }

    return 'viewer';
  }
}
