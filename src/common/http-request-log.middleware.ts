import { NextFunction, Response } from 'express';
import { appLogger } from './app-logger';
import { recordRequestLog } from './request-log-sink';
import { RequestWithId } from './request-id.middleware';

const SKIP_PATHS = new Set([
  '/favicon.ico',
  '/health',
  '/api/health',
  '/icon.png',
]);

const SKIP_PREFIXES = ['/fe', '/legacy', '/api/admin/request-logs'];

function shouldSkipRequestLog(path: string): boolean {
  if (SKIP_PATHS.has(path)) {
    return true;
  }

  if (SKIP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return true;
  }

  const lastSegment = path.split('/').pop() ?? '';
  if (lastSegment.includes('.')) {
    return true;
  }

  return false;
}

export function httpRequestLogMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
) {
  if (shouldSkipRequestLog(req.path)) {
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

    const locals = (res.locals ?? {}) as { errorMessage?: string };
    recordRequestLog({
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      clientId: readHeader(req, 'x-client-id'),
      origin: readHeader(req, 'origin'),
      userAgent: readHeader(req, 'user-agent'),
      errorMessage: locals.errorMessage,
    });
  });

  next();
}

function readHeader(req: RequestWithId, name: string): string | undefined {
  if (typeof req.header !== 'function') {
    return undefined;
  }

  const value = req.header(name);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
