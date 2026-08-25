-- Enhance APM stats: P95 latency, route_group breakdown, optional stream exclusion.

create or replace function public.admin_api_request_log_stats(
  since_ts timestamptz,
  path_limit int default 20,
  exclude_stream boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'total', count(*),
    'avgDurationMs', coalesce(round(avg(duration_ms)::numeric, 1), 0),
    'errorCount', count(*) filter (where status_code >= 500),
    'errorRate', case
      when count(*) = 0 then 0
      else round((count(*) filter (where status_code >= 500))::numeric / count(*), 4)
    end,
    'excludeStream', exclude_stream,
    'byPath', coalesce((
      select jsonb_agg(row_to_json(path_row)::jsonb order by path_row.p95_ms desc)
      from (
        select
          method,
          path,
          count(*)::int as count,
          round(avg(duration_ms)::numeric, 1) as avg_duration_ms,
          round(
            (percentile_cont(0.95) within group (order by duration_ms))::numeric,
            1
          ) as p95_ms,
          count(*) filter (where status_code >= 500)::int as errors
        from public.api_request_logs
        where created_at >= since_ts
          and (not exclude_stream or is_stream = false)
        group by method, path
        order by percentile_cont(0.95) within group (order by duration_ms) desc
        limit path_limit
      ) path_row
    ), '[]'::jsonb),
    'byRouteGroup', coalesce((
      select jsonb_agg(row_to_json(group_row)::jsonb order by group_row.p95_ms desc)
      from (
        select
          coalesce(route_group, 'other') as route_group,
          count(*)::int as count,
          round(avg(duration_ms)::numeric, 1) as avg_duration_ms,
          round(
            (percentile_cont(0.95) within group (order by duration_ms))::numeric,
            1
          ) as p95_ms,
          count(*) filter (where status_code >= 500)::int as errors
        from public.api_request_logs
        where created_at >= since_ts
          and (not exclude_stream or is_stream = false)
        group by coalesce(route_group, 'other')
        order by percentile_cont(0.95) within group (order by duration_ms) desc
      ) group_row
    ), '[]'::jsonb),
    'byCallerKind', coalesce((
      select jsonb_agg(row_to_json(kind_row)::jsonb order by kind_row.count desc)
      from (
        select
          coalesce(caller_kind, 'unknown') as caller_kind,
          count(*)::int as count,
          round(avg(duration_ms)::numeric, 1) as avg_duration_ms
        from public.api_request_logs
        where created_at >= since_ts
          and (not exclude_stream or is_stream = false)
        group by coalesce(caller_kind, 'unknown')
        order by count(*) desc
      ) kind_row
    ), '[]'::jsonb),
    'byCallSource', coalesce((
      select jsonb_agg(row_to_json(source_row)::jsonb order by source_row.count desc)
      from (
        select
          coalesce(call_source, 'unknown') as call_source,
          count(*)::int as count,
          round(avg(duration_ms)::numeric, 1) as avg_duration_ms
        from public.api_request_logs
        where created_at >= since_ts
          and (not exclude_stream or is_stream = false)
        group by coalesce(call_source, 'unknown')
        order by count(*) desc
        limit path_limit
      ) source_row
    ), '[]'::jsonb)
  )
  into result
  from public.api_request_logs
  where created_at >= since_ts
    and (not exclude_stream or is_stream = false);

  return coalesce(result, jsonb_build_object(
    'total', 0,
    'avgDurationMs', 0,
    'errorCount', 0,
    'errorRate', 0,
    'excludeStream', exclude_stream,
    'byPath', '[]'::jsonb,
    'byRouteGroup', '[]'::jsonb,
    'byCallerKind', '[]'::jsonb,
    'byCallSource', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.admin_api_request_log_stats(timestamptz, int, boolean) from public, anon, authenticated;
grant execute on function public.admin_api_request_log_stats(timestamptz, int, boolean) to service_role;
