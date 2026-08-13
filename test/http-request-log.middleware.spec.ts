import { EventEmitter } from 'node:events';
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
});
