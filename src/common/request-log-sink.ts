import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppConfig } from '../config/app-config';

export interface RequestLogEntry {
  requestId?: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: string;
  clientId?: string;
  origin?: string;
  userAgent?: string;
  errorMessage?: string;
}

let sinkEnabled = false;
let sinkClient: SupabaseClient | null = null;
let tableKnownMissing = false;

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    Boolean(error.message?.includes('api_request_logs'))
  );
}

export function initRequestLogSink(config: AppConfig): void {
  const { url, serviceRoleKey, apiKey, requestSecret } = config.supabase;
  const apiKeyForSink = serviceRoleKey || apiKey;

  sinkEnabled =
    config.requestLogSink === 'supabase' && Boolean(url && apiKeyForSink);

  tableKnownMissing = false;

  if (!sinkEnabled) {
    sinkClient = null;
    return;
  }

  sinkClient = createClient(url!, apiKeyForSink!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: requestSecret
      ? {
          headers: {
            'x-api-secret': requestSecret,
          },
        }
      : undefined,
  });
}

export function isRequestLogSinkEnabled(): boolean {
  return sinkEnabled;
}

export function recordRequestLog(entry: RequestLogEntry): void {
  if (!sinkEnabled || !sinkClient || tableKnownMissing) {
    return;
  }

  const insertPromise = sinkClient.from('api_request_logs').insert({
    request_id: entry.requestId ?? null,
    method: entry.method,
    path: entry.path,
    status_code: entry.statusCode,
    duration_ms: entry.durationMs,
    user_id: entry.userId ?? null,
    client_id: entry.clientId ?? null,
    origin: entry.origin ?? null,
    user_agent: entry.userAgent ?? null,
    error_message: entry.errorMessage ?? null,
  });

  const runInsert = async () => {
    const { error } = await insertPromise;
    if (error) {
      if (isMissingTableError(error)) {
        tableKnownMissing = true;
        console.warn('[request-log-sink] api_request_logs table missing; skipping inserts');
        return;
      }
      console.error('[request-log-sink] insert failed:', error.message);
    }
  };

  if (process.env.VERCEL) {
    void import('@vercel/functions')
      .then(({ waitUntil }) => {
        waitUntil(runInsert());
      })
      .catch((importError: unknown) => {
        console.error('[request-log-sink] waitUntil unavailable:', importError);
        void runInsert();
      });
    return;
  }

  void runInsert();
}

/** Test-only reset for module-level state. */
export function resetRequestLogSinkStateForTests(): void {
  sinkEnabled = false;
  sinkClient = null;
  tableKnownMissing = false;
}

/** Test-only accessor. */
export function isRequestLogTableKnownMissingForTests(): boolean {
  return tableKnownMissing;
}
