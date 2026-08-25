import { BadRequestException, Injectable } from '@nestjs/common';
import { isRequestLogSinkEnabled } from '../../common/request-log-sink';
import type { RouteGroup } from '../../common/request-route-meta';
import { SupabaseAdminClientService } from './supabase-admin-client.service';
import { ListRequestLogsDto, RequestLogStatsDto } from './dto/request-logs.dto';
import {
  aggregateRequestLogStats,
  type RequestLogGroupStat,
  type RequestLogRouteStat,
} from './helpers/request-log-stats';

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

interface RpcStatsRow {
  method: string;
  path: string;
  route_group: string;
  request_count: number | string;
  error_count: number | string;
  avg_ms: number | string;
  p50_ms: number | string;
  p95_ms: number | string;
  max_ms: number;
}

const FALLBACK_SAMPLE_LIMIT = 5000;

function isMissingTableError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42P01' ||
    Boolean(error.message?.includes('api_request_logs'))
  );
}

function isMissingRpcError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42883' ||
    Boolean(error.message?.includes('api_request_logs_stats'))
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

    const hours = query.hours ?? 24;
    const excludeStream = query.excludeStream ?? true;
    const limit = query.limit ?? 50;
    const routeGroupFilter = query.group ?? null;
    const since = new Date();
    since.setHours(since.getHours() - hours);

    const rpcResult = await this.fetchStatsViaRpc({
      since,
      routeGroupFilter,
      excludeStream,
      limit,
      hours,
    });
    if (rpcResult) {
      return rpcResult;
    }

    return this.fetchStatsViaFallback({
      since,
      routeGroupFilter,
      excludeStream,
      limit,
      hours,
    });
  }

  private async fetchStatsViaRpc(input: {
    since: Date;
    routeGroupFilter: RouteGroup | null;
    excludeStream: boolean;
    limit: number;
    hours: number;
  }) {
    const client = this.supabaseAdmin.getClient();
    const { data, error } = await client.rpc('api_request_logs_stats', {
      since: input.since.toISOString(),
      route_group_filter: input.routeGroupFilter,
      exclude_stream: input.excludeStream,
      result_limit: input.limit,
    });

    if (error) {
      if (isMissingTableError(error)) {
        return null;
      }
      if (!isMissingRpcError(error)) {
        throw new BadRequestException({
          code: 'ADMIN_REQUEST_LOG_STATS_FAILED',
          message: error.message,
        });
      }
      return null;
    }

    const routes = ((data ?? []) as RpcStatsRow[]).map((row) =>
      mapRpcRow(row),
    );
    const requestCount = routes.reduce((sum, row) => sum + row.requestCount, 0);

    return {
      enabled: true as const,
      hours: input.hours,
      excludeStream: input.excludeStream,
      routeGroupFilter: input.routeGroupFilter,
      routes,
      groups: aggregateGroupsFromRoutes(routes),
      source: 'rpc' as const,
      sampleCount: requestCount,
    };
  }

  private async fetchStatsViaFallback(input: {
    since: Date;
    routeGroupFilter: RouteGroup | null;
    excludeStream: boolean;
    limit: number;
    hours: number;
  }) {
    const client = this.supabaseAdmin.getClient();
    const { data, error } = await client
      .from('api_request_logs')
      .select('method, path, route_group, status_code, duration_ms, is_stream')
      .gte('created_at', input.since.toISOString())
      .order('created_at', { ascending: false })
      .limit(FALLBACK_SAMPLE_LIMIT);

    if (error) {
      if (isMissingTableError(error)) {
        return {
          enabled: false as const,
          reason: 'migration_missing' as const,
        };
      }
      throw new BadRequestException({
        code: 'ADMIN_REQUEST_LOG_STATS_FAILED',
        message: error.message,
      });
    }

    const stats = aggregateRequestLogStats((data ?? []) as RequestLogRow[], {
      hours: input.hours,
      excludeStream: input.excludeStream,
      routeGroupFilter: input.routeGroupFilter,
      limit: input.limit,
    });

    return {
      enabled: true as const,
      ...stats,
    };
  }
}

function mapRpcRow(row: RpcStatsRow): RequestLogRouteStat {
  return {
    method: row.method,
    path: row.path,
    routeGroup: normalizeRouteGroup(row.route_group),
    requestCount: toNumber(row.request_count),
    errorCount: toNumber(row.error_count),
    avgMs: toNumber(row.avg_ms),
    p50Ms: toNumber(row.p50_ms),
    p95Ms: toNumber(row.p95_ms),
    maxMs: row.max_ms,
  };
}

function aggregateGroupsFromRoutes(
  routes: RequestLogRouteStat[],
): RequestLogGroupStat[] {
  const order: RouteGroup[] = ['auth', 'chat', 'admin', 'ai', 'other'];
  const byGroup = new Map<RouteGroup, RequestLogRouteStat[]>();

  for (const route of routes) {
    const bucket = byGroup.get(route.routeGroup) ?? [];
    bucket.push(route);
    byGroup.set(route.routeGroup, bucket);
  }

  return order
    .map((routeGroup) => {
      const bucket = byGroup.get(routeGroup);
      if (!bucket || bucket.length === 0) {
        return null;
      }

      const requestCount = bucket.reduce((sum, row) => sum + row.requestCount, 0);
      const errorCount = bucket.reduce((sum, row) => sum + row.errorCount, 0);
      const weightedAvg =
        bucket.reduce((sum, row) => sum + row.avgMs * row.requestCount, 0) /
        requestCount;

      return {
        routeGroup,
        requestCount,
        errorCount,
        avgMs: round1(weightedAvg),
        p50Ms: round1(
          percentile(bucket.map((row) => row.p50Ms), 0.5),
        ),
        p95Ms: round1(
          percentile(bucket.map((row) => row.p95Ms), 0.95),
        ),
        maxMs: Math.max(...bucket.map((row) => row.maxMs), 0),
      };
    })
    .filter((row): row is RequestLogGroupStat => row !== null);
}

function normalizeRouteGroup(value: string): RouteGroup {
  if (
    value === 'auth' ||
    value === 'chat' ||
    value === 'admin' ||
    value === 'ai' ||
    value === 'other'
  ) {
    return value;
  }
  return 'other';
}

function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, '\\$&');
}
