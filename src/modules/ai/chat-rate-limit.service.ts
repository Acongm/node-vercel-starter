import { Injectable } from '@nestjs/common';
import { AuthTier } from '../auth/roles';

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: string;
  tier: AuthTier;
  identity: string;
}

@Injectable()
export class ChatRateLimitService {
  private readonly counters = new Map<string, number>();

  consume(input: {
    tier: AuthTier;
    userId?: string | null;
    clientId?: string;
    limit: number;
    now?: Date;
  }): RateLimitDecision {
    const now = input.now ?? new Date();
    const day = now.toISOString().slice(0, 10);
    // Supabase anonymous users have a stable auth.uid() even though their
    // application tier is still `anon`. Prefer that identity when available;
    // x-client-id remains the fallback for legacy unauthenticated callers.
    const identity = input.userId
      ? input.tier === 'user'
        ? `user:${input.userId}`
        : `anon-user:${input.userId}`
      : `anon:${input.clientId || 'anonymous'}`;
    const key = `${identity}:${day}`;
    const used = this.counters.get(key) ?? 0;
    const limit = Math.max(0, Math.floor(input.limit));
    const resetAt = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
      ),
    ).toISOString();

    if (used >= limit) {
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt,
        tier: input.tier,
        identity,
      };
    }

    this.counters.set(key, used + 1);
    return {
      allowed: true,
      limit,
      remaining: Math.max(0, limit - used - 1),
      resetAt,
      tier: input.tier,
      identity,
    };
  }

  /** Test helper */
  reset() {
    this.counters.clear();
  }
}
