import { BoundedTtlCache } from '../src/common/bounded-ttl-cache';

describe('BoundedTtlCache', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('drops expired entries instead of retaining them until the same key returns', () => {
    jest.useFakeTimers();
    const cache = new BoundedTtlCache<string>({ ttlMs: 60_000, maxSize: 10 });

    cache.set('user-1', 'dark');
    jest.advanceTimersByTime(60_001);
    cache.set('user-2', 'light');

    expect(cache.size).toBe(1);
    expect(cache.get('user-1')).toBeUndefined();
    expect(cache.get('user-2')).toBe('light');
  });

  it('evicts the oldest live entry when the size bound is exceeded', () => {
    const cache = new BoundedTtlCache<string>({ ttlMs: 60_000, maxSize: 2 });

    cache.set('user-1', 'a');
    cache.set('user-2', 'b');
    cache.set('user-3', 'c');

    expect(cache.size).toBe(2);
    expect(cache.get('user-1')).toBeUndefined();
    expect(cache.get('user-2')).toBe('b');
    expect(cache.get('user-3')).toBe('c');
  });
});
