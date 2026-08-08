import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminSessionService } from './admin-session.service';
import { extractBearerToken } from './bearer-token';

@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(private readonly adminSession: AdminSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing Bearer session token.');
    }

    await this.adminSession.verifyToken(token);
    return true;
  }
}
