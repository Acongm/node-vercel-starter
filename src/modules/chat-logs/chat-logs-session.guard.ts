import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ChatLogsSessionService } from './chat-logs-session.service';

function extractBearerToken(request: Request): string | undefined {
  const authorization = request.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return undefined;
  }
  return authorization.slice('Bearer '.length).trim() || undefined;
}

@Injectable()
export class ChatLogsSessionGuard implements CanActivate {
  constructor(private readonly sessionService: ChatLogsSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing Bearer session token.');
    }

    await this.sessionService.verifyToken(token);
    return true;
  }
}
