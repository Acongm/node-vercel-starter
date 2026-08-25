-- Track who initiated an API call (guest cid, login uid, or svc:portal-ci).
alter table public.api_request_logs
  add column if not exists call_source text,
  add column if not exists caller_kind text;

create index if not exists api_request_logs_call_source_idx
  on public.api_request_logs (call_source, created_at desc);

notify pgrst, 'reload schema';
