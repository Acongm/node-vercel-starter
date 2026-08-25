import { normalizeCitationUrl } from '../src/modules/admin-insights/helpers/citation-url';
import { extractTextPreviewFromParts } from '../src/modules/admin-insights/helpers/message-parts';
import {
  ResolvedUserIdentity,
  UserEmailCache,
} from '../src/modules/admin-insights/helpers/user-email-cache';

describe('admin-insights helpers', () => {
  describe('normalizeCitationUrl', () => {
    it('strips hash fragments and utm tracking params', () => {
      const normalized = normalizeCitationUrl(
        'https://example.com/docs/page?utm_source=chat&utm_campaign=test#section-2',
      );

      expect(normalized).toBe('https://example.com/docs/page');
    });

    it('preserves non-utm query params', () => {
      const normalized = normalizeCitationUrl(
        'https://example.com/search?q=nestjs&utm_medium=email',
      );

      expect(normalized).toBe('https://example.com/search?q=nestjs');
    });

    it('returns the original string for invalid URLs', () => {
      expect(normalizeCitationUrl('not-a-url')).toBe('not-a-url');
    });
  });

  describe('extractTextPreviewFromParts', () => {
    it('concatenates text parts where type is text', () => {
      const preview = extractTextPreviewFromParts([
        { type: 'reasoning', text: 'hidden' },
        { type: 'text', text: 'Hello ' },
        { type: 'text', text: 'world' },
        { type: 'image', url: 'https://example.com/a.png' },
      ]);

      expect(preview).toBe('Hello world');
    });

    it('returns empty string for non-array input', () => {
      expect(extractTextPreviewFromParts(null)).toBe('');
      expect(extractTextPreviewFromParts({})).toBe('');
    });
  });

  describe('UserEmailCache', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns cached values within TTL and evicts after expiry', () => {
      let now = 1_000;
      const cache = new UserEmailCache({ now: () => now });
      const identity: ResolvedUserIdentity = {
        email: 'user@example.com',
        isAnonymous: false,
      };

      cache.set('user-1', identity);
      expect(cache.get('user-1')).toEqual(identity);

      now += 9 * 60 * 1000;
      expect(cache.get('user-1')).toEqual(identity);

      now += 2 * 60 * 1000;
      expect(cache.get('user-1')).toBeUndefined();
    });

    it('evicts oldest entry when max size is exceeded', () => {
      const cache = new UserEmailCache({ maxEntries: 2 });
      cache.set('user-1', { email: 'a@example.com', isAnonymous: false });
      cache.set('user-2', { email: 'b@example.com', isAnonymous: true });
      cache.set('user-3', { email: 'c@example.com', isAnonymous: false });

      expect(cache.get('user-1')).toBeUndefined();
      expect(cache.get('user-2')).toBeDefined();
      expect(cache.get('user-3')).toBeDefined();
    });
  });
});
