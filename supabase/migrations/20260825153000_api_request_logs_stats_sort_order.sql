-- Add ascending/descending control for path ranking in APM stats.

drop function if exists public.admin_api_request_log_stats(timestamptz, int, boolean, text);

create or replace function public.admin_api_request_log_stats(
  since_ts timestamptz,
  path_limit int default 50,
  exclude_stream boolean default true,
  path_sort text default 'p95',
  path_sort_order text default 'desc'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
  normalized_sort text := lower(coalesce(path_sort, 'p95'));
  normalized_order text := lower(coalesce(path_sort_order, 'desc'));
  direction_multiplier int := -1;
begin
  if normalized_sort not in ('count', 'avg_duration', 'p95', 'max_duration', 'errors') then
    normalized_sort := 'p95';
  end if;
  if normalized_order not in ('asc', 'desc') then
    normalized_order := 'desc';
  end if;
  if normalized_order = 'asc' then
    direction_multiplier := 1;
  end if;

  select jsonb_build_object(
    'total', count(*),
    'avgDurationMs', coalesce(round(avg(duration_ms)::numeric, 1), 0),
    'errorCount', count(*) filter (where status_code >= 500),
    'errorRate', case
      when count(*) = 0 then 0
      else round((count(*) filter (where status_code >= 500))::numeric / count(*), 4)
    end,
    'excludeStream', exclude_stream,
    'pathSort', normalized_sort,
    'pathSortOrder', normalized_order,
    'byPath', coalesce((
      select jsonb_agg(row_to_json(path_row)::jsonb)
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
          max(duration_ms)::int as max_duration_ms,
          count(*) filter (where status_code >= 500)::int as errors
        from public.api_request_logs
        where created_at >= since_ts
          and (not exclude_stream or is_stream = false)
        group by method, path
        order by
          (case normalized_sort
            when 'count' then count(*)::numeric
            when 'avg_duration' then avg(duration_ms)
            when 'max_duration' then max(duration_ms)::numeric
            when 'errors' then count(*) filter (where status_code >= 500)::numeric
            else percentile_cont(0.95) within group (order by duration_ms)
          end) * direction_multiplier desc nulls last
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
          max(duration_ms)::int as max_duration_ms,
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
    'pathSort', normalized_sort,
    'pathSortOrder', normalized_order,
    'byPath', '[]'::jsonb,
    'byRouteGroup', '[]'::jsonb,
    'byCallerKind', '[]'::jsonb,
    'byCallSource', '[]'::jsonb
  ));
end;
$$;

revoke all on function public.admin_api_request_log_stats(timestamptz, int, boolean, text, text) from public, anon, authenticated;
grant execute on function public.admin_api_request_log_stats(timestamptz, int, boolean, text, text) to service_role;
