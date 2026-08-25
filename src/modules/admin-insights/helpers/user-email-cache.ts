export interface ResolvedUserIdentity {
  email?: string;
  isAnonymous: boolean;
}

interface CacheEntry {
  value: ResolvedUserIdentity;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 500;

export class UserEmailCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options?: {
    ttlMs?: number;
    maxEntries?: number;
    now?: () => number;
  }) {
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEntries = options?.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = options?.now ?? (() => Date.now());
  }

  get(userId: string): ResolvedUserIdentity | undefined {
    const entry = this.entries.get(userId);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(userId);
      return undefined;
    }

    return entry.value;
  }

  set(userId: string, value: ResolvedUserIdentity): void {
    this.evictExpired();

    if (this.entries.size >= this.maxEntries && !this.entries.has(userId)) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(userId, {
      value,
      expiresAt: this.now() + this.ttlMs,
    });
  }

  private evictExpired(): void {
    const current = this.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= current) {
        this.entries.delete(key);
      }
    }
  }
}
