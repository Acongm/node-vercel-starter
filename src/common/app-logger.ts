import pino, { type Logger } from 'pino';

export type AppLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppLogFields {
  event: string;
  requestId?: string;
  [key: string]: unknown;
}

export const LOG_REDACT_CENSOR = '[Redacted]';

/** Paths stripped from operational logs. Chat transcript text stays in ChatLogs DB only. */
export const LOG_REDACT_PATHS = [
  'authorization',
  'access_token',
  'refresh_token',
  'password',
  'cookie',
  'headers.authorization',
  'headers.Authorization',
  'headers.cookie',
  'headers.Cookie',
  '*.authorization',
  '*.access_token',
  '*.refresh_token',
  '*.password',
  '*.cookie',
] as const;

function writeToConsole(line: string): void {
  const payload = JSON.parse(line) as { level?: string };
  if (payload.level === 'error') {
    console.error(line);
    return;
  }
  if (payload.level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

const logger: Logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    base: null,
    timestamp: () => `,"ts":"${new Date().toISOString()}"`,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    redact: {
      paths: [...LOG_REDACT_PATHS],
      censor: LOG_REDACT_CENSOR,
    },
  },
  {
    write(chunk: string) {
      const line = chunk.trim();
      if (!line) return;
      writeToConsole(line);
    },
  },
);

function writeLog(level: AppLogLevel, fields: AppLogFields): void {
  logger[level](fields);
}

export const appLogger = {
  debug(fields: AppLogFields): void {
    writeLog('debug', fields);
  },
  info(fields: AppLogFields): void {
    writeLog('info', fields);
  },
  warn(fields: AppLogFields): void {
    writeLog('warn', fields);
  },
  error(fields: AppLogFields): void {
    writeLog('error', fields);
  },
};
