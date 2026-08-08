import { UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from '../src/modules/auth/supabase-auth.guard';

function context(request: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe('SupabaseAuthGuard', () => {
  it('rejects requests without a bearer token', async () => {
    const guard = new SupabaseAuthGuard({ verifyAccessToken: jest.fn() } as never);
    await expect(
      guard.canActivate(context({ header: () => undefined })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects invalid Supabase tokens', async () => {
    const verifyAccessToken = jest.fn().mockResolvedValue(null);
    const guard = new SupabaseAuthGuard({ verifyAccessToken } as never);
    const request = { header: () => 'Bearer bad-token' };

    await expect(guard.canActivate(context(request))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verifyAccessToken).toHaveBeenCalledWith('bad-token');
  });

  it('attaches the verified principal to the request', async () => {
    const principal = {
      userId: 'user-1',
      role: 'viewer',
      tier: 'user',
      source: 'supabase',
    };
    const verifyAccessToken = jest.fn().mockResolvedValue(principal);
    const guard = new SupabaseAuthGuard({ verifyAccessToken } as never);
    const request: { header: () => string; auth?: unknown } = {
      header: () => 'Bearer valid-token',
    };

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request.auth).toBe(principal);
  });
});
