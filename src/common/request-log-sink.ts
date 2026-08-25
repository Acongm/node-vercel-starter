import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppConfig } from '../config/app-config';
import type { RouteGroup } from './request-route-meta';

export interface RequestLogEntry {
  requestId?: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: string;
  clientId?: string;
  callSource?: string;
  callerKind?: string;
  routeGroup?: RouteGroup;
  isStream?: boolean;
  origin?: string;
  userAgent?: string;
  errorMessage?: string;
}

let sinkEnabled = false;
let sinkClient: SupabaseClient | null = null;
let tableKnownMissing = false;
let callerColumnsKnownMissing = false;
let monitoringColumnsKnownMissing = false;

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    Boolean(error.message?.includes('api_request_logs'))
  );
}

function isMissingColumnError(error: { code?: string; message?: string }): boolean {
  return error.code === '42703';
}

function buildInsertRow(
  entry: RequestLogEntry,
  options: { includeCallerFields: boolean; includeMonitoringFields: boolean },
): Record<string, string | number | boolean | null> {
  const row: Record<string, string | number | boolean | null> = {
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
  };
  if (options.includeCallerFields) {
    row.call_source = entry.callSource ?? null;
    row.caller_kind = entry.callerKind ?? null;
  }
  if (options.includeMonitoringFields) {
    row.is_stream = entry.isStream ?? false;
    row.route_group = entry.routeGroup ?? null;
  }
  return row;
}

export function initRequestLogSink(config: AppConfig): void {
  const { url, serviceRoleKey, apiKey, requestSecret } = config.supabase;
  const apiKeyForSink = serviceRoleKey || apiKey;

  sinkEnabled =
    config.requestLogSink === 'supabase' && Boolean(url && apiKeyForSink);

  tableKnownMissing = false;
  callerColumnsKnownMissing = false;
  monitoringColumnsKnownMissing = false;

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

  const client = sinkClient;

  const runInsert = async () => {
    const first = await client
      .from('api_request_logs')
      .insert(
        buildInsertRow(entry, {
          includeCallerFields: !callerColumnsKnownMissing,
          includeMonitoringFields: !monitoringColumnsKnownMissing,
        }),
      );
    if (!first.error) {
      return;
    }
    if (isMissingTableError(first.error)) {
      tableKnownMissing = true;
      console.warn('[request-log-sink] api_request_logs table missing; skipping inserts');
      return;
    }
    if (isMissingColumnError(first.error)) {
      if (!callerColumnsKnownMissing) {
        callerColumnsKnownMissing = true;
      } else if (!monitoringColumnsKnownMissing) {
        monitoringColumnsKnownMissing = true;
      }
      const retry = await client
        .from('api_request_logs')
        .insert(
          buildInsertRow(entry, {
            includeCallerFields: !callerColumnsKnownMissing,
            includeMonitoringFields: !monitoringColumnsKnownMissing,
          }),
        );
      if (retry.error) {
        console.error('[request-log-sink] insert failed:', retry.error.message);
      }
      return;
    }
    console.error('[request-log-sink] insert failed:', first.error.message);
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
  callerColumnsKnownMissing = false;
  monitoringColumnsKnownMissing = false;
}

/** Test-only accessor. */
export function isRequestLogTableKnownMissingForTests(): boolean {
  return tableKnownMissing;
}

/** Test-only accessor. */
export function areRequestLogCallerColumnsKnownMissingForTests(): boolean {
  return callerColumnsKnownMissing;
}
