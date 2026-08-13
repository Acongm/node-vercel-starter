import { UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from '../src/modules/auth/supabase-auth.guard';

function context(request: unknown) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

async function expectUnauthorized(
  promise: Promise<unknown>,
  response: { code: string; message: string },
) {
  try {
    await promise;
    throw new Error('Expected request to be rejected');
  } catch (error) {
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect((error as UnauthorizedException).getStatus()).toBe(401);
    expect((error as UnauthorizedException).getResponse()).toEqual(response);
  }
}

describe('SupabaseAuthGuard', () => {
  it('rejects missing bearer tokens with the stable AUTH_REQUIRED contract', async () => {
    const guard = new SupabaseAuthGuard({ verifyAccessToken: jest.fn() } as never);

    await expectUnauthorized(
      guard.canActivate(context({ header: () => undefined })),
      {
        code: 'AUTH_REQUIRED',
        message: 'Missing Supabase access token.',
      },
    );
  });

  it('rejects invalid Supabase tokens with the stable INVALID_TOKEN contract', async () => {
    const verifyAccessToken = jest.fn().mockResolvedValue(null);
    const guard = new SupabaseAuthGuard({ verifyAccessToken } as never);
    const request = { header: () => 'Bearer bad-token' };

    await expectUnauthorized(guard.canActivate(context(request)), {
      code: 'INVALID_TOKEN',
      message: 'Invalid or expired Supabase access token.',
    });
    expect(verifyAccessToken).toHaveBeenCalledWith('bad-token');
  });

  it('rejects expired JWTs with TOKEN_EXPIRED', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
      'base64url',
    );
    const payload = Buffer.from(JSON.stringify({ exp: 1, sub: 'user-1' })).toString(
      'base64url',
    );
    const token = `${header}.${payload}.sig`;
    const verifyAccessToken = jest.fn().mockResolvedValue(null);
    const guard = new SupabaseAuthGuard({ verifyAccessToken } as never);

    await expectUnauthorized(
      guard.canActivate(context({ header: () => `Bearer ${token}` })),
      {
        code: 'TOKEN_EXPIRED',
        message: 'Supabase access token has expired.',
      },
    );
  });

  it('rejects a verified result that has no stable auth.users id', async () => {
    const verifyAccessToken = jest.fn().mockResolvedValue({
      userId: null,
      role: 'viewer',
      tier: 'user',
      source: 'supabase',
    });
    const guard = new SupabaseAuthGuard({ verifyAccessToken } as never);

    await expectUnauthorized(
      guard.canActivate(context({ header: () => 'Bearer malformed-principal' })),
      {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired Supabase access token.',
      },
    );
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
