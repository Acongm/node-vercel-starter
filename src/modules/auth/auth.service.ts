import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { AdminSessionService } from './admin-session.service';
import { LoginDto } from './dto/login.dto';
import { AuthPrincipal } from './roles';

@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly adminSession: AdminSessionService,
  ) {}

  mode() {
    const configured = this.adminSession.isConfigured();
    return {
      authMode: configured ? 'jwt' : this.config.auth.mode,
      adminLoginConfigured: configured,
      supabaseJwtConfigured: Boolean(this.config.auth.supabaseJwtSecret),
      roles: ['anonymous', 'viewer', 'editor', 'admin'],
      tiers: ['anon', 'user'],
      note: configured
        ? 'Use POST /api/auth/login with AUTH_ADMIN_USERNAME and AUTH_ADMIN_PASSWORD. Supabase JWT uses SUPABASE_JWT_SECRET + app_metadata.role.'
        : this.config.auth.mode === 'none'
          ? 'Anonymous mode is enabled. Set AUTH_ADMIN_USERNAME and AUTH_ADMIN_PASSWORD for admin login, or SUPABASE_JWT_SECRET for user JWTs.'
          : 'Auth mode is configured by AUTH_MODE.',
    };
  }

  async login(dto: LoginDto) {
    if (this.config.auth.mode === 'external') {
      throw new NotImplementedException(
        'AUTH_MODE=external should be connected to Clerk, Auth.js, OAuth, or your identity provider.',
      );
    }

    if (this.adminSession.isConfigured()) {
      return this.adminSession.login(
        dto.username || '',
        dto.password || '',
      );
    }

    const user = {
      id: dto.username || 'anonymous',
      name: dto.username || 'Anonymous',
      roles: this.config.auth.mode === 'none' ? ['anonymous'] : ['user'],
      role: this.config.auth.mode === 'none' ? 'anonymous' : 'viewer',
      tier: this.config.auth.mode === 'none' ? 'anon' : 'user',
    };

    if (this.config.auth.mode === 'none') {
      return { authMode: 'none', user };
    }

    throw new NotImplementedException(
      'JWT login requires AUTH_ADMIN_USERNAME and AUTH_ADMIN_PASSWORD, or a Supabase session from auth.acongm.com.',
    );
  }

  principalResponse(principal: AuthPrincipal) {
    const authenticated = principal.tier === 'user';
    return {
      authenticated,
      role: principal.role,
      tier: principal.tier,
      source: principal.source,
      user: authenticated
        ? {
            id: principal.userId,
            name: principal.name,
            email: principal.email,
            role: principal.role,
            roles: [principal.role],
            tier: principal.tier,
          }
        : {
            id: null,
            name: 'Anonymous',
            role: 'anonymous',
            roles: ['anonymous'],
            tier: 'anon',
          },
    };
  }
}
