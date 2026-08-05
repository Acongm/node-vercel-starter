import { ChatRateLimitService } from '../src/modules/ai/chat-rate-limit.service';

describe('ChatRateLimitService', () => {
  it('allows requests until the daily limit then blocks', () => {
    const service = new ChatRateLimitService();
    const now = new Date('2026-08-05T10:00:00.000Z');

    const first = service.consume({
      tier: 'anon',
      clientId: 'client-a',
      limit: 2,
      now,
    });
    const second = service.consume({
      tier: 'anon',
      clientId: 'client-a',
      limit: 2,
      now,
    });
    const third = service.consume({
      tier: 'anon',
      clientId: 'client-a',
      limit: 2,
      now,
    });

    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(0);
    expect(third.allowed).toBe(false);
    expect(third.resetAt).toBe('2026-08-06T00:00:00.000Z');
  });

  it('tracks anon and user identities separately', () => {
    const service = new ChatRateLimitService();
    const now = new Date('2026-08-05T10:00:00.000Z');

    expect(
      service.consume({
        tier: 'anon',
        clientId: 'c1',
        limit: 1,
        now,
      }).allowed,
    ).toBe(true);
    expect(
      service.consume({
        tier: 'user',
        userId: 'u1',
        clientId: 'c1',
        limit: 1,
        now,
      }).allowed,
    ).toBe(true);
    expect(
      service.consume({
        tier: 'anon',
        clientId: 'c1',
        limit: 1,
        now,
      }).allowed,
    ).toBe(false);
  });
});
