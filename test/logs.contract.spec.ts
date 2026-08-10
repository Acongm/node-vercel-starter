import {
  createRequestId,
  logEvent,
  redactForTest,
} from '../src/modules/logs';

describe('operational logs foundation', () => {
  it('passes through a trusted x-request-id and generates otherwise', () => {
    expect(createRequestId('req-abc')).toBe('req-abc');
    expect(createRequestId('')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('redacts secrets/tokens/cookies and keeps safe fields', () => {
    expect(
      redactForTest({
        authorization: 'Bearer secret',
        cookie: 'sid=1',
        password: 'pw',
        access_token: 'tok',
        requestId: 'r1',
        nested: { apiKey: 'k', ok: true },
      }),
    ).toEqual({
      authorization: '[Redacted]',
      cookie: '[Redacted]',
      password: '[Redacted]',
      access_token: '[Redacted]',
      requestId: 'r1',
      nested: { apiKey: '[Redacted]', ok: true },
    });
  });

  it('emits structured events without throwing', () => {
    expect(() =>
      logEvent({
        event: 'chat.first_token',
        module: 'chat',
        requestId: 'r1',
        runId: 'run-1',
        durationMs: 12,
        authorization: 'Bearer should-redact',
      }),
    ).not.toThrow();
  });
});
