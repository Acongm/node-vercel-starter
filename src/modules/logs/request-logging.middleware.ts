import { NextFunction, Response } from 'express';
import { RequestWithId } from '../../common/request-id.middleware';
import { logEvent } from './structured-logger';

/**
 * Complements requestIdMiddleware with structured HTTP completed events.
 */
export function requestLoggingMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
) {
  const started = Date.now();
  res.on('finish', () => {
    const statusCode = res.statusCode;
    const level =
      statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    logEvent({
      level,
      event: 'http.request.completed',
      module: 'http',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode,
      durationMs: Date.now() - started,
    });
  });
  next();
}
