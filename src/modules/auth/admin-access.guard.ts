import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminSessionService } from './admin-session.service';
import { extractAccessToken } from './bearer-token';
import { JwtAuthService } from './jwt-auth.service';
import { roleAtLeast } from './roles';

/**
 * Accepts legacy admin-session JWTs and Supabase sessions whose principal
 * resolves to platform role `admin` (including configured email whitelist).
 */
@Injectable()
export class AdminAccessGuard implements CanActivate {
  constructor(
    private readonly adminSession: AdminSessionService,
    private readonly jwtAuth: JwtAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = extractAccessToken(request);

    if (!token) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Admin session required.',
      });
    }

    if (this.adminSession.isConfigured()) {
      try {
        await this.adminSession.verifyToken(token);
        return true;
      } catch {
        // Fall through to Supabase / local JWT principals.
      }
    }

    const principal = await this.jwtAuth.verifyAccessToken(token);
    if (roleAtLeast(principal.role, 'admin')) {
      return true;
    }

    throw new ForbiddenException({
      code: 'ROLE_FORBIDDEN',
      message: 'Admin access required.',
      role: principal.role,
    });
  }
}
