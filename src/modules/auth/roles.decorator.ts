import { SetMetadata } from '@nestjs/common';
import { PlatformRole } from './roles';

export const ROLES_KEY = 'platform_roles';

/** Require at least one of the listed roles (or a higher role). */
export const RequireRoles = (...roles: PlatformRole[]) =>
  SetMetadata(ROLES_KEY, roles);
