-- API request logs for admin console tail view.
-- Access model: backend service_role only (same pattern as auth_users).

create table if not exists public.api_request_logs (
  id bigint generated always as identity primary key,
  request_id text,
  method text not null,
  path text not null,
  status_code integer not null,
  duration_ms integer not null,
  user_id text,
  client_id text,
  origin text,
  user_agent text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists api_request_logs_created_at_idx
  on public.api_request_logs (created_at desc);

create index if not exists api_request_logs_path_created_at_idx
  on public.api_request_logs (path, created_at desc);

alter table public.api_request_logs enable row level security;

revoke all on table public.api_request_logs from anon, authenticated;
grant select, insert, update, delete on table public.api_request_logs to service_role;

drop policy if exists "service role can manage api request logs" on public.api_request_logs;
create policy "service role can manage api request logs"
on public.api_request_logs
for all
to service_role
using (true)
with check (true);

-- Manual retention (run periodically via pg_cron or ops):
-- delete from public.api_request_logs where created_at < now() - interval '14 days';

notify pgrst, 'reload schema';
