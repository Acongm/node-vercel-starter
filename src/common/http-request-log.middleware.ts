import { NextFunction, Response } from 'express';
import { resolveClientId } from './anon-fingerprint';
import { appLogger } from './app-logger';
import {
  displayCallerId,
  parseServiceCallers,
  readOptionalHeader,
  resolveCaller,
} from './caller-identity';
import { classifyRequestRoute } from './request-route-meta';
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
    const origin = readHeader(req, 'origin');
    const userAgent = readHeader(req, 'user-agent');
    const callSource = readOptionalHeader(req, 'x-call-source') ?? 'unknown';
    const caller = resolveCaller({
      serviceId: readOptionalHeader(req, 'x-service-id'),
      serviceKey: readOptionalHeader(req, 'x-service-key'),
      clientId: readOptionalHeader(req, 'x-client-id'),
      callSource,
      serviceCallers: parseServiceCallers(process.env.SERVICE_CALLERS),
    });
    const clientId =
      caller.kind === 'unknown'
        ? resolveClientId(readHeader(req, 'x-client-id'), userAgent, origin)
        : displayCallerId(caller);
    const routeMeta = classifyRequestRoute(req.path);
    recordRequestLog({
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      clientId,
      callSource: caller.callSource,
      callerKind: caller.kind,
      routeGroup: routeMeta.routeGroup,
      isStream: routeMeta.isStream,
      origin,
      userAgent,
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
