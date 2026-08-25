import {
  decideAiCallerAccess,
  DEFAULT_ALLOWED_CALL_SOURCES,
  isAllowedCallSource,
  parseAllowedCallSources,
  parseServiceCallers,
  resolveCaller,
} from '../src/common/caller-identity';

describe('caller identity', () => {
  const callers = parseServiceCallers('portal-ci:ci-secret,portal-bff:bff-secret');

  it('defaults allowed call sources and accepts an explicit override list', () => {
    expect(parseAllowedCallSources(undefined)).toEqual(['portal:', 'chat-site']);
    expect(parseAllowedCallSources('')).toEqual(['portal:', 'chat-site']);
    expect(parseAllowedCallSources('portal:,internal:')).toEqual([
      'portal:',
      'internal:',
    ]);
  });

  it('parses whitelist service callers and ignores malformed entries', () => {
    expect(callers).toEqual([
      { id: 'portal-ci', key: 'ci-secret' },
      { id: 'portal-bff', key: 'bff-secret' },
    ]);
    expect(parseServiceCallers('')).toEqual([]);
    expect(parseServiceCallers('nocolon')).toEqual([]);
  });

  it('accepts portal and chat-site call sources and rejects crawler leftovers', () => {
    expect(isAllowedCallSource('portal:ci:summaries', DEFAULT_ALLOWED_CALL_SOURCES)).toBe(
      true,
    );
    expect(isAllowedCallSource('chat-site', DEFAULT_ALLOWED_CALL_SOURCES)).toBe(true);
    expect(isAllowedCallSource('unknown', DEFAULT_ALLOWED_CALL_SOURCES)).toBe(false);
    expect(isAllowedCallSource('', DEFAULT_ALLOWED_CALL_SOURCES)).toBe(false);
    expect(isAllowedCallSource('curl/8.0', DEFAULT_ALLOWED_CALL_SOURCES)).toBe(false);
  });

  it('resolves a valid portal CI service caller', () => {
    expect(
      resolveCaller({
        serviceId: 'portal-ci',
        serviceKey: 'ci-secret',
        callSource: 'portal:ci:summaries',
        requestId: 'req-1',
        serviceCallers: callers,
      }),
    ).toEqual({
      kind: 'service',
      callerId: 'portal-ci',
      callSource: 'portal:ci:summaries',
      requestId: 'req-1',
    });
  });

  it('does not trust a service id without the matching key', () => {
    const caller = resolveCaller({
      serviceId: 'portal-ci',
      serviceKey: 'wrong',
      callSource: 'portal:ci:summaries',
      clientId: 'GA1.1.abc123def4567890.1',
      serviceCallers: callers,
    });
    expect(caller.kind).toBe('guest');
    expect(caller.callerId).toBe('GA1.1.abc123def4567890.1');
  });

  it('prefers an authenticated user over a guest client id', () => {
    expect(
      resolveCaller({
        userId: 'user-1',
        isAnonymousUser: false,
        clientId: 'GA1.1.abc123def4567890.1',
        callSource: 'portal:doc-chat',
        serviceCallers: callers,
      }),
    ).toMatchObject({
      kind: 'user',
      callerId: 'user-1',
      callSource: 'portal:doc-chat',
    });
  });

  it('treats anonymous auth users and cid-only browsers as guests', () => {
    expect(
      resolveCaller({
        userId: 'anon-uid',
        isAnonymousUser: true,
        callSource: 'chat-site',
        serviceCallers: callers,
      }),
    ).toMatchObject({ kind: 'guest', callerId: 'anon-uid' });
  });

  it('marks crawlers without service, user, or client id as unknown', () => {
    expect(
      resolveCaller({
        callSource: 'unknown',
        userAgent: 'curl/8.0',
        serviceCallers: callers,
      }),
    ).toMatchObject({ kind: 'unknown', callSource: 'unknown' });
  });

  it('allows identified callers with a whitelisted source and blocks the rest', () => {
    expect(
      decideAiCallerAccess({
        kind: 'service',
        callerId: 'portal-ci',
        callSource: 'portal:ci:summaries',
      }),
    ).toEqual({ ok: true });

    expect(
      decideAiCallerAccess({
        kind: 'guest',
        callerId: 'GA1.1.abc123def4567890.1',
        callSource: 'portal:doc-chat',
      }),
    ).toEqual({ ok: true });

    expect(
      decideAiCallerAccess({
        kind: 'unknown',
        callerId: 'unknown',
        callSource: 'unknown',
      }),
    ).toMatchObject({ ok: false, code: 'CALLER_REQUIRED' });

    expect(
      decideAiCallerAccess({
        kind: 'guest',
        callerId: 'GA1.1.abc123def4567890.1',
        callSource: 'unknown',
      }),
    ).toMatchObject({ ok: false, code: 'CALL_SOURCE_DENIED' });
  });
});
