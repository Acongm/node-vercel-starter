import { Inject, Injectable, NotImplementedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly jwtService: JwtService,
  ) {}

  mode() {
    return {
      authMode: this.config.auth.mode,
      note:
        this.config.auth.mode === 'none'
          ? 'Anonymous mode is enabled. Add a guard when you need protected routes.'
          : 'Auth mode is configured by AUTH_MODE.',
    };
  }

  async login(dto: LoginDto) {
    if (this.config.auth.mode === 'external') {
      throw new NotImplementedException(
        'AUTH_MODE=external should be connected to Clerk, Auth.js, OAuth, or your identity provider.',
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

    const accessToken = await this.jwtService.signAsync(user, {
      secret: this.config.auth.jwtSecret,
      expiresIn: '7d',
    });

    return {
      authMode: 'jwt',
      user,
      accessToken,
      tokenType: 'Bearer',
    };
  }
}
