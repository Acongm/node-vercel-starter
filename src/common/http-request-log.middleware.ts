import { NextFunction, Response } from 'express';
import { appLogger } from './app-logger';
import { RequestWithId } from './request-id.middleware';

const SKIP_PATHS = new Set(['/favicon.ico', '/health']);

export function httpRequestLogMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
) {
  if (SKIP_PATHS.has(req.path)) {
    next();
    return;
  }

  const startedAt = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

    appLogger[level]({
      event: 'http.request',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
    });
  });

  next();
}
