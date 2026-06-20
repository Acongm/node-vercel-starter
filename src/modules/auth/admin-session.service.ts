import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';

export interface AdminSessionPayload {
  sub: string;
  role: 'admin';
  name: string;
}

@Injectable()
export class AdminSessionService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly jwtService: JwtService,
  ) {}

  isConfigured(): boolean {
    const { adminUsername, adminPassword, jwtSecret } = this.config.auth;
    return Boolean(adminUsername && adminPassword && jwtSecret);
  }

  validateCredentials(username: string, password: string): boolean {
    const { adminUsername, adminPassword } = this.config.auth;
    return username === adminUsername && password === adminPassword;
  }

  assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Admin login is not configured. Set AUTH_ADMIN_USERNAME, AUTH_ADMIN_PASSWORD, and AUTH_JWT_SECRET.',
      );
    }
  }

  async login(username: string, password: string) {
    this.assertConfigured();

    if (!this.validateCredentials(username, password)) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const { adminUsername, jwtSecret, sessionTtl } = this.config.auth;

    const accessToken = await this.jwtService.signAsync(
      {
        sub: adminUsername!,
        role: 'admin',
        name: adminUsername!,
      } satisfies AdminSessionPayload,
      {
        secret: jwtSecret,
        expiresIn: sessionTtl,
      },
    );

    return {
      authMode: 'jwt' as const,
      accessToken,
      tokenType: 'Bearer',
      expiresIn: sessionTtl,
      user: {
        id: adminUsername!,
        name: adminUsername!,
        username: adminUsername!,
        roles: ['admin'],
      },
    };
  }

  async verifyToken(token: string): Promise<AdminSessionPayload> {
    this.assertConfigured();

    try {
      const payload = await this.jwtService.verifyAsync<AdminSessionPayload>(
        token,
        { secret: this.config.auth.jwtSecret },
      );

      if (payload.role !== 'admin') {
        throw new UnauthorizedException('Invalid session.');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired session.');
    }
  }
}
