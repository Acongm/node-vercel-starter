import type { RouteGroup } from '../../../common/request-route-meta';

export interface RequestLogRouteStat {
  method: string;
  path: string;
  routeGroup: RouteGroup;
  requestCount: number;
  errorCount: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

export interface RequestLogGroupStat {
  routeGroup: RouteGroup;
  requestCount: number;
  errorCount: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}

export interface RequestLogStatsPayload {
  enabled: true;
  hours: number;
  excludeStream: boolean;
  routeGroupFilter: RouteGroup | null;
  routes: RequestLogRouteStat[];
  groups: RequestLogGroupStat[];
  source: 'rpc' | 'fallback';
  sampleCount: number;
}

interface RawLogRow {
  method: string;
  path: string;
  route_group: string | null;
  status_code: number;
  duration_ms: number;
  is_stream?: boolean;
}

export function aggregateRequestLogStats(
  rows: RawLogRow[],
  options: {
    hours: number;
    excludeStream: boolean;
    routeGroupFilter: RouteGroup | null;
    limit: number;
  },
): Omit<RequestLogStatsPayload, 'enabled'> {
  const filtered = rows.filter((row) => {
    if (options.excludeStream && row.is_stream) {
      return false;
    }
    const group = normalizeRouteGroup(row.route_group);
    if (options.routeGroupFilter && group !== options.routeGroupFilter) {
      return false;
    }
    return true;
  });

  const byRoute = new Map<string, RawLogRow[]>();
  for (const row of filtered) {
    const key = `${row.method} ${row.path}`;
    const bucket = byRoute.get(key) ?? [];
    bucket.push(row);
    byRoute.set(key, bucket);
  }

  const routes = [...byRoute.entries()]
    .map(([key, bucket]) => {
      const [method, ...pathParts] = key.split(' ');
      const path = pathParts.join(' ');
      const durations = bucket.map((row) => row.duration_ms);
      const routeGroup = normalizeRouteGroup(bucket[0]?.route_group);
      return {
        method,
        path,
        routeGroup,
        requestCount: bucket.length,
        errorCount: bucket.filter((row) => row.status_code >= 500).length,
        avgMs: round1(mean(durations)),
        p50Ms: round1(percentile(durations, 0.5)),
        p95Ms: round1(percentile(durations, 0.95)),
        maxMs: Math.max(...durations, 0),
      };
    })
    .sort((a, b) => b.p95Ms - a.p95Ms || b.requestCount - a.requestCount)
    .slice(0, options.limit);

  const groups = aggregateGroups(routes);

  return {
    hours: options.hours,
    excludeStream: options.excludeStream,
    routeGroupFilter: options.routeGroupFilter,
    routes,
    groups,
    source: 'fallback',
    sampleCount: filtered.length,
  };
}

function aggregateGroups(routes: RequestLogRouteStat[]): RequestLogGroupStat[] {
  const byGroup = new Map<RouteGroup, RequestLogRouteStat[]>();
  for (const route of routes) {
    const bucket = byGroup.get(route.routeGroup) ?? [];
    bucket.push(route);
    byGroup.set(route.routeGroup, bucket);
  }

  const order: RouteGroup[] = ['auth', 'chat', 'admin', 'ai', 'other'];
  return order
    .map((routeGroup) => {
      const bucket = byGroup.get(routeGroup);
      if (!bucket || bucket.length === 0) {
        return null;
      }

      const weightedAvg =
        bucket.reduce((sum, row) => sum + row.avgMs * row.requestCount, 0) /
        bucket.reduce((sum, row) => sum + row.requestCount, 0);

      return {
        routeGroup,
        requestCount: bucket.reduce((sum, row) => sum + row.requestCount, 0),
        errorCount: bucket.reduce((sum, row) => sum + row.errorCount, 0),
        avgMs: round1(weightedAvg),
        p50Ms: round1(
          percentile(
            bucket.map((row) => row.p50Ms),
            0.5,
          ),
        ),
        p95Ms: round1(
          percentile(
            bucket.map((row) => row.p95Ms),
            0.95,
          ),
        ),
        maxMs: Math.max(...bucket.map((row) => row.maxMs), 0),
      };
    })
    .filter((row): row is RequestLogGroupStat => row !== null);
}

function normalizeRouteGroup(value: string | null | undefined): RouteGroup {
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

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
