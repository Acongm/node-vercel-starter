import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { AuthUserRecord } from './auth-user-record';
import { PlatformRole } from './roles';

export interface AccessTokenClaims {
  sub: string;
  email?: string;
  name?: string;
  role: Exclude<PlatformRole, 'anonymous'>;
  provider: string;
  typ: 'access';
}

@Injectable()
export class AccessTokenService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly jwtService: JwtService,
  ) {}

  async issueForUser(user: AuthUserRecord) {
    const claims: AccessTokenClaims = {
      sub: user.id,
      email: user.email,
      name: user.name || user.username || user.email,
      role: user.role,
      provider: user.provider,
      typ: 'access',
    };

    const accessToken = await this.jwtService.signAsync(claims, {
      secret: this.config.auth.jwtSecret,
      expiresIn: this.config.auth.sessionTtl,
    });

    return {
      authMode: 'jwt' as const,
      accessToken,
      tokenType: 'Bearer' as const,
      expiresIn: this.config.auth.sessionTtl,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name || user.username || user.email,
        role: user.role,
        roles: [user.role],
        provider: user.provider,
        tier: 'user' as const,
      },
    };
  }

  async verifyLocalAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenClaims>(
        token,
        { secret: this.config.auth.jwtSecret },
      );
      if (payload.typ !== 'access' || !payload.sub || !payload.role) {
        throw new UnauthorizedException('Invalid access token.');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}
