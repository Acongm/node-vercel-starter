import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import {
  decideAiCallerAccess,
  resolveCallerFromRequest,
  type ResolvedCaller,
} from '../../common/caller-identity';
import { RequestWithId } from '../../common/request-id.middleware';
import { JwtAuthService } from '../auth/jwt-auth.service';

export type RequestWithCaller = RequestWithId & {
  resolvedCaller?: ResolvedCaller;
};

@Injectable()
export class AiCallerGuard implements CanActivate {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly jwtAuth: JwtAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithCaller>();
    const principal = await this.jwtAuth.resolvePrincipal(request);
    const caller = resolveCallerFromRequest(
      request,
      principal,
      this.config.serviceCallers,
    );
    request.resolvedCaller = caller;

    const decision = decideAiCallerAccess(
      caller,
      this.config.allowedCallSources,
    );
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
