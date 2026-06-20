import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { ChatLogsLoginDto } from './dto/chat-logs-login.dto';

export interface ChatLogsSessionPayload {
  sub: string;
  role: 'chat-logs-admin';
}

@Injectable()
export class ChatLogsSessionService {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly jwtService: JwtService,
  ) {}

  isConfigured(): boolean {
    const { adminUsername, adminPassword, sessionSecret } =
      this.config.chatLogs;
    return Boolean(adminUsername && adminPassword && sessionSecret);
  }

  async login(dto: ChatLogsLoginDto) {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Chat logs admin login is not configured.',
      );
    }

    const { adminUsername, adminPassword, sessionSecret, sessionTtl } =
      this.config.chatLogs;

    if (dto.username !== adminUsername || dto.password !== adminPassword) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sub: adminUsername,
        role: 'chat-logs-admin',
      } satisfies ChatLogsSessionPayload,
      {
        secret: sessionSecret,
        expiresIn: sessionTtl,
      },
    );

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: sessionTtl,
      user: {
        username: adminUsername,
        role: 'chat-logs-admin',
      },
    };
  }

  async verifyToken(token: string): Promise<ChatLogsSessionPayload> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Chat logs admin login is not configured.',
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync<ChatLogsSessionPayload>(
        token,
        { secret: this.config.chatLogs.sessionSecret },
      );

      if (payload.role !== 'chat-logs-admin') {
        throw new UnauthorizedException('Invalid session.');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired session.');
    }
  }
}
