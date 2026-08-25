import {
  deriveAnonFingerprint,
  resolveClientId,
} from '../src/common/anon-fingerprint';
import { normalizeCitationUrl } from '../src/modules/admin-insights/helpers/citation-url';
import { extractTextPreviewFromParts } from '../src/modules/admin-insights/helpers/message-parts';
import {
  filterAnalysisRows,
  mapSnapshotToAnalysisRows,
  paginateRows,
  PortalSnapshot,
} from '../src/modules/admin-insights/helpers/portal-snapshot';
import {
  classifyAnonymousUsers,
  isGaClientId,
  isGhostAnonymousUser,
  readUserCid,
  selectPurgeGhostIds,
  type AnonymousUserLike,
} from '../src/modules/admin-insights/helpers/anonymous-identity';
import {
  ResolvedUserIdentity,
  UserEmailCache,
} from '../src/modules/admin-insights/helpers/user-email-cache';

describe('admin-insights helpers', () => {
  describe('deriveAnonFingerprint', () => {
    it('returns stable ua-prefixed hash from user-agent and origin', () => {
      const first = deriveAnonFingerprint('Mozilla/5.0 Test', 'https://acongm.com');
      const second = deriveAnonFingerprint('Mozilla/5.0 Test', 'https://acongm.com');

      expect(first).toMatch(/^ua-[0-9a-f]{8}$/);
      expect(first).toBe(second);
    });

    it('changes when user-agent or origin changes', () => {
      const base = deriveAnonFingerprint('Mozilla/5.0 Test', 'https://acongm.com');
      const otherOrigin = deriveAnonFingerprint('Mozilla/5.0 Test', 'https://example.com');
      const otherAgent = deriveAnonFingerprint('Other Agent', 'https://acongm.com');

      expect(otherOrigin).not.toBe(base);
      expect(otherAgent).not.toBe(base);
    });

    it('resolveClientId prefers explicit client id', () => {
      expect(resolveClientId('client-abc', 'Mozilla/5.0', 'https://acongm.com')).toBe(
        'client-abc',
      );
    });
  });

  describe('portal snapshot mapping', () => {
    const fixture: PortalSnapshot = {
      generatedAt: '2026-08-25T09:00:00.000Z',
      stats: { completedFiles: 2, durationMs: 1200 },
      analysis: { model: 'deepseek-v4-pro' },
      files: {
        '/docs/a.md': {
          status: 'success',
          summary: {
            summary: 'Alpha summary',
            keyPoints: ['point-a'],
            keywords: ['nest', 'api'],
            techStack: ['NestJS'],
            difficulty: 'beginner',
          },
        },
        '/docs/b.md': {
          status: 'success',
          summary: {
            summary: 'Beta summary about react',
            keyPoints: ['point-b'],
            keywords: ['react'],
            techStack: ['React'],
            difficulty: 'intermediate',
          },
        },
      },
    };

    it('maps snapshot files to analysis rows', () => {
      const rows = mapSnapshotToAnalysisRows(fixture);

      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({
        id: '/docs/a.md',
        path: '/docs/a.md',
        title: 'a',
        summary: 'Alpha summary',
        source: 'portal-static',
      });
    });

    it('filters rows by search term', () => {
      const rows = mapSnapshotToAnalysisRows(fixture);
      const filtered = filterAnalysisRows(rows, 'react');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].path).toBe('/docs/b.md');
    });

    it('paginates filtered rows', () => {
      const rows = mapSnapshotToAnalysisRows(fixture);
      const page = paginateRows(rows, 1, 1);

      expect(page.total).toBe(2);
      expect(page.items).toHaveLength(1);
      expect(page.totalPages).toBe(2);
    });
  });

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

  describe('GA anonymous identity', () => {
    const nowMs = Date.parse('2026-08-25T10:00:00.000Z');
    const oldCreatedAt = '2026-08-25T09:00:00.000Z';
    const recentCreatedAt = '2026-08-25T09:50:00.000Z';

    const ghost: AnonymousUserLike = {
      id: 'ghost-1',
      is_anonymous: true,
      created_at: oldCreatedAt,
      user_metadata: { cid: 'GA1.1.abc123def4567890.1756110000' },
      identities: [{ provider: 'anonymous' }],
    };
    const active: AnonymousUserLike = {
      id: 'active-1',
      is_anonymous: true,
      created_at: oldCreatedAt,
      user_metadata: { cid: 'GA1.1.xyz987654321abcd.1756110001' },
      identities: [{ provider: 'anonymous' }],
    };
    const recent: AnonymousUserLike = {
      id: 'recent-1',
      is_anonymous: true,
      created_at: recentCreatedAt,
      user_metadata: { cid: 'GA1.1.recentcid0000001.1756111111' },
      identities: [{ provider: 'anonymous' }],
    };
    const linked: AnonymousUserLike = {
      id: 'linked-1',
      is_anonymous: true,
      created_at: oldCreatedAt,
      user_metadata: { cid: 'GA1.1.linkedcid0000001.1756112222' },
      identities: [{ provider: 'anonymous' }, { provider: 'github' }],
    };
    const signedIn: AnonymousUserLike = {
      id: 'user-1',
      is_anonymous: false,
      created_at: oldCreatedAt,
      user_metadata: {},
      identities: [{ provider: 'github' }],
    };

    it('accepts GA-style client ids and rejects other strings', () => {
      expect(isGaClientId('GA1.1.abc123def4567890.1756110000')).toBe(true);
      expect(isGaClientId('not-a-cid')).toBe(false);
      expect(isGaClientId(undefined)).toBe(false);
    });

    it('reads cid from user_metadata', () => {
      expect(readUserCid(ghost)).toBe('GA1.1.abc123def4567890.1756110000');
      expect(readUserCid(signedIn)).toBeUndefined();
    });

    it('treats old anonymous users without chats as ghosts', () => {
      expect(
        isGhostAnonymousUser(ghost, {
          chatUserIds: new Set(),
          nowMs,
        }),
      ).toBe(true);
    });

    it('keeps anonymous users who already have chats', () => {
      expect(
        isGhostAnonymousUser(active, {
          chatUserIds: new Set(['active-1']),
          nowMs,
        }),
      ).toBe(false);
    });

    it('skips recently created anonymous users inside the grace window', () => {
      expect(
        isGhostAnonymousUser(recent, {
          chatUserIds: new Set(),
          nowMs,
        }),
      ).toBe(false);
    });

    it('does not treat linked or signed-in accounts as ghosts', () => {
      expect(
        isGhostAnonymousUser(linked, {
          chatUserIds: new Set(),
          nowMs,
        }),
      ).toBe(false);
      expect(
        isGhostAnonymousUser(signedIn, {
          chatUserIds: new Set(),
          nowMs,
        }),
      ).toBe(false);
    });

    it('defaults the anonymous list to active users only', () => {
      const classified = classifyAnonymousUsers([ghost, active, recent, linked], {
        chatUserIds: new Set(['active-1']),
        activity: 'active',
        nowMs,
      });

      expect(classified.items.map((item) => item.id)).toEqual(['active-1']);
      expect(classified.ghostCount).toBe(1);
      expect(classified.activeCount).toBe(1);
      expect(classified.items[0]?.cid).toBe('GA1.1.xyz987654321abcd.1756110001');
      expect(classified.items[0]?.hasChats).toBe(true);
    });

    it('can list ghosts and search by cid', () => {
      const ghosts = classifyAnonymousUsers([ghost, active], {
        chatUserIds: new Set(['active-1']),
        activity: 'ghost',
        nowMs,
      });
      expect(ghosts.items.map((item) => item.id)).toEqual(['ghost-1']);

      const searched = classifyAnonymousUsers([ghost, active], {
        chatUserIds: new Set(['active-1']),
        activity: 'all',
        nowMs,
        q: 'abc123def4567890',
      });
      expect(searched.items.map((item) => item.id)).toEqual(['ghost-1']);
    });

    it('selects only purgeable ghost ids and skips recent or active users', () => {
      expect(
        selectPurgeGhostIds([ghost, active, recent, linked, signedIn], {
          chatUserIds: new Set(['active-1']),
          nowMs,
        }),
      ).toEqual(['ghost-1']);
    });
  });
});
