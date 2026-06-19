import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';

@Injectable()
export class AdminSecretGuard implements CanActivate {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const secret = request.header('x-api-secret');
    const expected = this.config.supabase.requestSecret;

    if (!expected || secret !== expected) {
      throw new ForbiddenException('Invalid or missing x-api-secret.');
    }

    return true;
  }
}
