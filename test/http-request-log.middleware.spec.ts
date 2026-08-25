import { EventEmitter } from 'node:events';
import { deriveAnonFingerprint } from '../src/common/anon-fingerprint';
import { httpRequestLogMiddleware } from '../src/common/http-request-log.middleware';
import { RequestWithId } from '../src/common/request-id.middleware';

describe('httpRequestLogMiddleware', () => {
  it('logs request metadata when the response finishes', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const req = Object.assign(new EventEmitter(), {
      method: 'GET',
      path: '/api/user/info',
      originalUrl: '/api/user/info',
      requestId: 'req-42',
    }) as RequestWithId;
    const res = Object.assign(new EventEmitter(), {
      statusCode: 200,
      locals: {},
    });

    const next = jest.fn();
    httpRequestLogMiddleware(req, res as never, next);
    expect(next).toHaveBeenCalled();

    res.emit('finish');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(logSpy.mock.calls[0][0]));
    expect(payload).toMatchObject({
      level: 'info',
      event: 'http.request',
      requestId: 'req-42',
      method: 'GET',
      path: '/api/user/info',
      statusCode: 200,
    });
    expect(typeof payload.durationMs).toBe('number');

    logSpy.mockRestore();
  });

  it('skips noisy static paths', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const req = Object.assign(new EventEmitter(), {
      method: 'GET',
      path: '/favicon.ico',
      originalUrl: '/favicon.ico',
      requestId: 'req-skip',
    }) as RequestWithId;
    const res = Object.assign(new EventEmitter(), { statusCode: 200 });
    const next = jest.fn();

    httpRequestLogMiddleware(req, res as never, next);
    res.emit('finish');

    expect(next).toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('skips admin SPA, legacy console, health, and request-log tail paths', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const paths = ['/fe/dashboard', '/legacy/index.html', '/api/health', '/api/admin/request-logs'];

    for (const path of paths) {
      const req = Object.assign(new EventEmitter(), {
        method: 'GET',
        path,
        originalUrl: path,
        requestId: 'req-skip-prefix',
      }) as RequestWithId;
      const res = Object.assign(new EventEmitter(), { statusCode: 200 });
      httpRequestLogMiddleware(req, res as never, jest.fn());
      res.emit('finish');
    }

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('derives client id from user-agent when x-client-id is missing', () => {
    const ua = 'Mozilla/5.0 Test Agent';
    const origin = 'https://acongm.com';
    expect(deriveAnonFingerprint(ua, origin)).toMatch(/^ua-[0-9a-f]{8}$/);
  });
});
