import { LOG_REDACT_CENSOR, appLogger } from '../src/common/app-logger';

describe('appLogger', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes JSON info logs', () => {
    appLogger.info({ event: 'test.event', requestId: 'req-1', ok: true });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(payload).toMatchObject({
      level: 'info',
      event: 'test.event',
      requestId: 'req-1',
      ok: true,
    });
    expect(typeof payload.ts).toBe('string');
  });

  it('routes warn and error to the matching console stream', () => {
    appLogger.warn({ event: 'warn.event' });
    appLogger.error({ event: 'error.event' });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it('redacts tokens, cookies, and passwords in operational logs', () => {
    appLogger.info({
      event: 'secret.event',
      authorization: 'Bearer super-secret',
      access_token: 'tok-1',
      refresh_token: 'tok-2',
      password: 'hunter2',
      cookie: 'sb-auth=abc',
      headers: {
        authorization: 'Bearer nested-secret',
        cookie: 'session=abc',
      },
    });

    const payload = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(payload.authorization).toBe(LOG_REDACT_CENSOR);
    expect(payload.access_token).toBe(LOG_REDACT_CENSOR);
    expect(payload.refresh_token).toBe(LOG_REDACT_CENSOR);
    expect(payload.password).toBe(LOG_REDACT_CENSOR);
    expect(payload.cookie).toBe(LOG_REDACT_CENSOR);
    expect(payload.headers).toEqual({
      authorization: LOG_REDACT_CENSOR,
      cookie: LOG_REDACT_CENSOR,
    });
    expect(JSON.stringify(payload)).not.toMatch(/super-secret|tok-1|hunter2/);
  });
});
