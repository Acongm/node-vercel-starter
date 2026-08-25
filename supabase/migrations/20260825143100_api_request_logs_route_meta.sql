-- Route grouping + stream flag for per-domain latency monitoring.

alter table public.api_request_logs
  add column if not exists is_stream boolean not null default false,
  add column if not exists route_group text;

create index if not exists api_request_logs_route_group_created_at_idx
  on public.api_request_logs (route_group, created_at desc);

create index if not exists api_request_logs_is_stream_created_at_idx
  on public.api_request_logs (is_stream, created_at desc);
