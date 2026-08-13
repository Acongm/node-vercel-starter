export type BoundedTtlCacheOptions = {
  ttlMs: number;
  maxSize: number;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

/**
 * In-process cache with TTL expiry and a hard size bound.
 * Expired entries are dropped on write (and on get of that key) so distinct
 * keys cannot accumulate forever in a long-lived Node process.
 */
export class BoundedTtlCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly maxSize: number;

  constructor(options: BoundedTtlCacheOptions) {
    this.ttlMs = options.ttlMs;
    this.maxSize = options.maxSize;
  }

  get size(): number {
    return this.entries.size;
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.pruneExpired();
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
    this.evictOverflow();
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }

  private evictOverflow(): void {
    while (this.entries.size > this.maxSize) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.entries.delete(oldest);
    }
  }
}
