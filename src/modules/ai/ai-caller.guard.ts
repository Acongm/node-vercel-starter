import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  decideAiCallerAccess,
  resolveCallerFromRequest,
  type ResolvedCaller,
} from '../../common/caller-identity';
import { RequestWithId } from '../../common/request-id.middleware';
import { JwtAuthService } from '../auth/jwt-auth.service';
import { PlatformRuntimeConfigService } from '../platform-config/platform-runtime-config.service';

export type RequestWithCaller = RequestWithId & {
  resolvedCaller?: ResolvedCaller;
};

@Injectable()
export class AiCallerGuard implements CanActivate {
  constructor(
    private readonly runtimeConfig: PlatformRuntimeConfigService,
    private readonly jwtAuth: JwtAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithCaller>();
    const principal = await this.jwtAuth.resolvePrincipal(request);
    const serviceCallers = await this.runtimeConfig.getServiceCallers();
    const caller = resolveCallerFromRequest(request, principal, serviceCallers);
    request.resolvedCaller = caller;

    const allowedCallSources = await this.runtimeConfig.getAllowedCallSources();
    const decision = decideAiCallerAccess(caller, allowedCallSources);
    if (decision.ok) {
      return true;
    }
    if (decision.code === 'CALL_SOURCE_DENIED') {
      throw new ForbiddenException({
        code: decision.code,
        message: decision.message,
      });
    }
    throw new UnauthorizedException({
      code: decision.code,
      message: decision.message,
    });
  }
}
