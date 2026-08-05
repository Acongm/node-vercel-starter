import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AppConfig } from '../src/config/app-config';
import { JwtAuthService } from '../src/modules/auth/jwt-auth.service';
import { roleAtLeast } from '../src/modules/auth/roles';

describe('roles + JwtAuthService', () => {
  const jwtService = new JwtService();

  function createService(overrides: Partial<AppConfig['auth']> = {}) {
    const config = {
      auth: {
        mode: 'jwt',
        jwtSecret: 'admin-secret',
        supabaseJwtSecret: 'supabase-secret',
        adminUsername: 'admin',
        adminPassword: 'admin123',
        sessionTtl: '1h',
        ...overrides,
      },
    } as AppConfig;
    return new JwtAuthService(config, jwtService);
  }

  it('ranks roles for ACL checks', () => {
    expect(roleAtLeast('admin', 'editor')).toBe(true);
    expect(roleAtLeast('editor', 'admin')).toBe(false);
    expect(roleAtLeast('viewer', 'viewer')).toBe(true);
    expect(roleAtLeast('anonymous', 'viewer')).toBe(false);
  });

  it('resolves anonymous principal without bearer token', async () => {
    const service = createService();
    const principal = await service.resolvePrincipal({
      header: () => undefined,
    } as never);

    expect(principal).toEqual({
      userId: null,
      role: 'anonymous',
      tier: 'anon',
      source: 'none',
    });
  });

  it('verifies admin session JWT as admin tier=user', async () => {
    const service = createService();
    const token = await jwtService.signAsync(
      { sub: 'admin', role: 'admin', name: 'admin' },
      { secret: 'admin-secret', expiresIn: '1h' },
    );

    const principal = await service.verifyAccessToken(token);
    expect(principal).toMatchObject({
      userId: 'admin',
      role: 'admin',
      tier: 'user',
      source: 'admin-session',
    });
  });

  it('reads role from supabase app_metadata only', async () => {
    const service = createService();
    const token = await jwtService.signAsync(
      {
        sub: 'user-1',
        email: 'editor@acongm.com',
        app_metadata: { role: 'editor' },
        user_metadata: { role: 'admin' },
      },
      { secret: 'supabase-secret', expiresIn: '1h' },
    );

    const principal = await service.verifyAccessToken(token);
    expect(principal).toMatchObject({
      userId: 'user-1',
      role: 'editor',
      tier: 'user',
      source: 'supabase',
      email: 'editor@acongm.com',
    });
  });

  it('defaults authenticated supabase users without role to viewer', async () => {
    const service = createService();
    const token = await jwtService.signAsync(
      { sub: 'user-2', email: 'viewer@acongm.com', app_metadata: {} },
      { secret: 'supabase-secret', expiresIn: '1h' },
    );

    const principal = await service.verifyAccessToken(token);
    expect(principal.role).toBe('viewer');
  });

  it('rejects invalid tokens', async () => {
    const service = createService();
    await expect(service.verifyAccessToken('not-a-jwt')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
