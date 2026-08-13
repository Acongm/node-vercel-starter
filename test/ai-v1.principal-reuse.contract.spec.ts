import { AiV1Service } from '../src/modules/ai/v1/ai-v1.service';
import { AuthPrincipal } from '../src/modules/auth/roles';

describe('AiV1Service principal reuse (#59)', () => {
  const principal: AuthPrincipal = {
    userId: 'user-1',
    role: 'viewer',
    tier: 'user',
    source: 'supabase',
  };

  it('does not re-resolve principal when one is already verified', async () => {
    const resolvePrincipal = jest.fn();
    const consume = jest.fn().mockReturnValue({
      allowed: true,
      limit: 100,
      remaining: 99,
      resetAt: new Date().toISOString(),
      tier: 'user',
    });

    const service = new AiV1Service(
      {} as never,
      { ai: { provider: 'mock', model: 'gpt-4.1-mini' } } as never,
      { limits: { anon: { chatPerDay: 10 }, user: { chatPerDay: 100 } } } as never,
      {} as never,
      { consume } as never,
      { resolvePrincipal } as never,
    );

    const request = {
      header: () => undefined,
      headers: {},
    } as never;

    await expect(
      service.enforceRateLimit(request, principal),
    ).resolves.toEqual(principal);
    expect(resolvePrincipal).not.toHaveBeenCalled();
    expect(consume).toHaveBeenCalled();
  });

  it('resolves principal only when not supplied (legacy /ai/v1 path)', async () => {
    const resolvePrincipal = jest.fn().mockResolvedValue(principal);
    const consume = jest.fn().mockReturnValue({
      allowed: true,
      limit: 100,
      remaining: 99,
      resetAt: new Date().toISOString(),
      tier: 'user',
    });

    const service = new AiV1Service(
      {} as never,
      { ai: { provider: 'mock', model: 'gpt-4.1-mini' } } as never,
      { limits: { anon: { chatPerDay: 10 }, user: { chatPerDay: 100 } } } as never,
      {} as never,
      { consume } as never,
      { resolvePrincipal } as never,
    );

    await service.enforceRateLimit({ header: () => undefined, headers: {} } as never);
    expect(resolvePrincipal).toHaveBeenCalledTimes(1);
  });
});
