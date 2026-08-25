-- Long-term API latency monitoring: route grouping + stream flag + stats RPC.

alter table public.api_request_logs
  add column if not exists is_stream boolean not null default false,
  add column if not exists route_group text;

create index if not exists api_request_logs_route_group_created_at_idx
  on public.api_request_logs (route_group, created_at desc);

create index if not exists api_request_logs_is_stream_created_at_idx
  on public.api_request_logs (is_stream, created_at desc);

-- Per-route latency stats for admin console monitoring (service_role only).
create or replace function public.api_request_logs_stats(
  since timestamptz,
  route_group_filter text default null,
  exclude_stream boolean default true,
  result_limit integer default 50
)
returns table (
  method text,
  path text,
  route_group text,
  request_count bigint,
  error_count bigint,
  avg_ms numeric,
  p50_ms numeric,
  p95_ms numeric,
  max_ms integer
)
language sql
stable
as $$
  select
    method,
    path,
    coalesce(route_group, 'other') as route_group,
    count(*)::bigint as request_count,
    count(*) filter (where status_code >= 500)::bigint as error_count,
    round(avg(duration_ms)::numeric, 1) as avg_ms,
    round(
      (percentile_cont(0.5) within group (order by duration_ms))::numeric,
      1
    ) as p50_ms,
    round(
      (percentile_cont(0.95) within group (order by duration_ms))::numeric,
      1
    ) as p95_ms,
    max(duration_ms) as max_ms
  from public.api_request_logs
  where created_at >= since
    and (
      route_group_filter is null
      or coalesce(route_group, 'other') = route_group_filter
    )
    and (not exclude_stream or is_stream = false)
  group by method, path, coalesce(route_group, 'other')
  order by p95_ms desc nulls last, request_count desc
  limit result_limit;
$$;

revoke all on function public.api_request_logs_stats(
  timestamptz,
  text,
  boolean,
  integer
) from public;

grant execute on function public.api_request_logs_stats(
  timestamptz,
  text,
  boolean,
  integer
) to service_role;

-- Manual retention (run periodically via pg_cron or ops):
-- delete from public.api_request_logs where created_at < now() - interval '30 days';
