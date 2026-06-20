import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { AdminSessionService } from './admin-session.service';
import { LoginDto } from './dto/login.dto';

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
      note: configured
        ? 'Use POST /api/auth/login with AUTH_ADMIN_USERNAME and AUTH_ADMIN_PASSWORD.'
        : this.config.auth.mode === 'none'
          ? 'Anonymous mode is enabled. Set AUTH_ADMIN_USERNAME and AUTH_ADMIN_PASSWORD for admin login.'
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
    };

    if (this.config.auth.mode === 'none') {
      return { authMode: 'none', user };
    }

    throw new NotImplementedException(
      'JWT login requires AUTH_ADMIN_USERNAME and AUTH_ADMIN_PASSWORD.',
    );
  }

  me(token: string) {
    return this.adminSession.verifyToken(token).then((payload) => ({
      authenticated: true,
      user: {
        id: payload.sub,
        name: payload.name,
        username: payload.sub,
        roles: ['admin'],
      },
    }));
  }
}
