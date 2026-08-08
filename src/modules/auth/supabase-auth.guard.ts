import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { extractBearerToken } from './bearer-token';
import { AuthPrincipal } from './roles';
import { SupabaseAuthService } from './supabase-auth.service';

export type SupabaseAuthenticatedRequest = Request & {
  auth?: AuthPrincipal;
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseAuth: SupabaseAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<SupabaseAuthenticatedRequest>();
    const token = extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Missing Supabase access token.',
      });
    }

    const principal = await this.supabaseAuth.verifyAccessToken(token);
    if (!principal?.userId) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired Supabase access token.',
      });
    }

    request.auth = principal;
    return true;
  }
}
