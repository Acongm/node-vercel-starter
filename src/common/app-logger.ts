export type AppLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppLogFields {
  event: string;
  requestId?: string;
  [key: string]: unknown;
}

function writeLog(level: AppLogLevel, fields: AppLogFields): void {
  const payload = {
    level,
    ts: new Date().toISOString(),
    ...fields,
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
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
