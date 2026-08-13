import { randomUUID } from 'node:crypto';
import pino, { Logger } from 'pino';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type StructuredLogEvent = {
  level?: LogLevel;
  event: string;
  message?: string;
  module?: string;
  requestId?: string;
  runId?: string;
  chatId?: string;
  userId?: string | null;
  durationMs?: number;
  statusCode?: number;
  errorCode?: string;
  [key: string]: unknown;
};

const REDACT_KEYS = new Set(
  [
    'authorization',
    'cookie',
    'set-cookie',
    'password',
    'access_token',
    'refresh_token',
    'token',
    'apikey',
    'api_key',
    'secret',
  ].map((key) => key.toLowerCase()),
);

function redactValue(key: string, value: unknown): unknown {
  if (REDACT_KEYS.has(key.toLowerCase())) return '[Redacted]';
  if (Array.isArray(value)) return value.map((item) => redactValue(key, item));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      out[childKey] = redactValue(childKey, childValue);
    }
    return out;
  }
  return value;
}

const rootLogger: Logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'node-vercel-starter' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Operational logger (Pino JSON stdout). Domain transcript/audit stays in
 * chats/messages/chat_runs — do not put message bodies here by default.
 */
export function logEvent(input: StructuredLogEvent): void {
  const level = input.level || 'info';
  const { level: _level, message, event, ...rest } = input;
  const payload: Record<string, unknown> = {
    event,
    msg: message || event,
  };

  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) {
      payload[key] = redactValue(key, value);
    }
  }

  rootLogger[level](payload);
}

export function createRequestId(incoming?: string | null): string {
  if (incoming && incoming.trim() && incoming.length < 128) {
    return incoming.trim();
  }
  return randomUUID();
}

export function getRootLogger(): Logger {
  return rootLogger;
}

/**
 * Persist only the pathname. Query strings can contain OAuth `code` / `state`
 * and must not land in durable runtime logs.
 */
export function requestPathForLog(originalUrl?: string): string {
  if (!originalUrl) return '';
  const queryIndex = originalUrl.indexOf('?');
  const hashIndex = originalUrl.indexOf('#');
  let end = originalUrl.length;
  if (queryIndex !== -1) end = Math.min(end, queryIndex);
  if (hashIndex !== -1) end = Math.min(end, hashIndex);
  return originalUrl.slice(0, end);
}

/** Test helper — exposes redaction without logging. */
export function redactForTest(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    out[key] = redactValue(key, value);
  }
  return out;
}
