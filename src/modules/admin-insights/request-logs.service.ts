import { BadRequestException, Injectable } from '@nestjs/common';
import { isRequestLogSinkEnabled } from '../../common/request-log-sink';
import { SupabaseAdminClientService } from './supabase-admin-client.service';
import { ListRequestLogsDto } from './dto/request-logs.dto';
import {
  RequestLogStatsDto,
  RequestLogStatsWindow,
} from './dto/request-logs-stats.dto';

export interface RequestLogRow {
  id: number;
  request_id: string | null;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  user_id: string | null;
  client_id: string | null;
  call_source: string | null;
  caller_kind: string | null;
  route_group: string | null;
  is_stream: boolean;
  origin: string | null;
  user_agent: string | null;
  error_message: string | null;
  created_at: string;
}

export interface RequestLogPathStat {
  method: string;
  path: string;
  count: number;
  avg_duration_ms: number;
  errors: number;
}

export interface RequestLogDimensionStat {
  count: number;
  avg_duration_ms: number;
}

export interface RequestLogCallerKindStat extends RequestLogDimensionStat {
  caller_kind: string;
}

export interface RequestLogCallSourceStat extends RequestLogDimensionStat {
  call_source: string;
}

export interface RequestLogStatsPayload {
  window: RequestLogStatsWindow;
  since: string;
  total: number;
  avgDurationMs: number;
  errorCount: number;
  errorRate: number;
  byPath: RequestLogPathStat[];
  byCallerKind: RequestLogCallerKindStat[];
  byCallSource: RequestLogCallSourceStat[];
}

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    Boolean(error.message?.includes('api_request_logs'))
  );
}

function isMissingStatsFunctionError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42883' ||
    Boolean(error.message?.includes('admin_api_request_log_stats'))
  );
}

@Injectable()
export class RequestLogsService {
  constructor(private readonly supabaseAdmin: SupabaseAdminClientService) {}

  async listLogs(query: ListRequestLogsDto) {
    if (!isRequestLogSinkEnabled()) {
      return { enabled: false as const };
    }

    const client = this.supabaseAdmin.getClient();
    const limit = query.limit ?? 100;

    let request = client
      .from('api_request_logs')
      .select('*')
      .order('id', { ascending: false })
      .limit(limit);

    if (query.sinceId) {
      request = request.gt('id', query.sinceId);
    }
    if (query.path) {
      const pattern = `%${escapeIlike(query.path)}%`;
      request = request.ilike('path', pattern);
    }
    if (query.status !== undefined) {
      request = request.eq('status_code', query.status);
    }

    const { data, error } = await request;
    if (error) {
      if (isMissingTableError(error)) {
        return {
          enabled: false as const,
          reason: 'migration_missing' as const,
        };
      }
      throw new BadRequestException({
        code: 'ADMIN_REQUEST_LOGS_FAILED',
        message: error.message,
      });
    }

    return {
      enabled: true as const,
      items: (data ?? []) as RequestLogRow[],
    };
  }

  async getStats(query: RequestLogStatsDto) {
    if (!isRequestLogSinkEnabled()) {
      return { enabled: false as const };
    }

    const window = query.window ?? '24h';
    const since = windowToSinceIso(window);
    const client = this.supabaseAdmin.getClient();
    const { data, error } = await client.rpc('admin_api_request_log_stats', {
      since_ts: since,
      path_limit: 20,
    });

    if (error) {
      if (isMissingTableError(error)) {
        return {
          enabled: false as const,
          reason: 'migration_missing' as const,
        };
      }
      if (isMissingStatsFunctionError(error)) {
        return {
          enabled: false as const,
          reason: 'stats_fn_missing' as const,
        };
      }
      throw new BadRequestException({
        code: 'ADMIN_REQUEST_LOG_STATS_FAILED',
        message: error.message,
      });
    }

    const payload = (data ?? {}) as Partial<RequestLogStatsPayload>;
    return {
      enabled: true as const,
      stats: {
        window,
        since,
        total: Number(payload.total ?? 0),
        avgDurationMs: Number(payload.avgDurationMs ?? 0),
        errorCount: Number(payload.errorCount ?? 0),
        errorRate: Number(payload.errorRate ?? 0),
        byPath: (payload.byPath ?? []) as RequestLogPathStat[],
        byCallerKind: (payload.byCallerKind ?? []) as RequestLogCallerKindStat[],
        byCallSource: (payload.byCallSource ?? []) as RequestLogCallSourceStat[],
      },
    };
  }
}

function windowToSinceIso(window: RequestLogStatsWindow): string {
  const date = new Date();
  if (window === '7d') {
    date.setDate(date.getDate() - 7);
    return date.toISOString();
  }
  if (window === '30d') {
    date.setDate(date.getDate() - 30);
    return date.toISOString();
  }
  date.setHours(date.getHours() - 24);
  return date.toISOString();
}

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, '\\$&');
}
