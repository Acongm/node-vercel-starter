import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { JwtAuthService } from './jwt-auth.service';
import { ROLES_KEY } from './roles.decorator';
import {
  AuthPrincipal,
  PlatformRole,
  createAnonymousPrincipal,
  roleAtLeast,
} from './roles';

export type AuthenticatedRequest = Request & {
  auth?: AuthPrincipal;
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtAuth: JwtAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles =
      this.reflector.getAllAndOverride<PlatformRole[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const principal = await this.jwtAuth.resolvePrincipal(request);
    request.auth = principal;

    if (requiredRoles.length === 0) {
      return true;
    }

    const allowsAnonymous = requiredRoles.includes('anonymous');
    if (principal.tier === 'anon') {
      if (allowsAnonymous) {
        return true;
      }
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Authentication required.',
      });
    }

    const allowed = requiredRoles.some((role) =>
      roleAtLeast(principal.role, role),
    );

    if (!allowed) {
      throw new ForbiddenException({
        code: 'ROLE_FORBIDDEN',
        message: `Requires one of roles: ${requiredRoles.join(', ')}`,
        role: principal.role,
        tier: principal.tier,
      });
    }

    return true;
  }
}

/** Attach auth principal without enforcing a role (chat / public routes). */
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly jwtAuth: JwtAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    try {
      request.auth = await this.jwtAuth.resolvePrincipal(request);
    } catch {
      request.auth = createAnonymousPrincipal();
    }
    return true;
  }
}
