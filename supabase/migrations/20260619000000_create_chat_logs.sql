create table if not exists public.chat_logs (
  id uuid primary key default gen_random_uuid(),
  client_id text,
  call_source text not null default 'unknown',
  conversation_id text,
  endpoint text not null,
  request_id text,
  user_message text not null,
  assistant_message text not null,
  context jsonb,
  provider text,
  model text,
  enable_web_search boolean not null default false,
  sources jsonb,
  origin text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists chat_logs_created_at_idx
  on public.chat_logs (created_at desc);

create index if not exists chat_logs_client_id_idx
  on public.chat_logs (client_id);

create index if not exists chat_logs_call_source_idx
  on public.chat_logs (call_source);

alter table public.chat_logs enable row level security;

revoke all on table public.chat_logs from anon, authenticated;
grant select, insert, update, delete on table public.chat_logs to service_role;

drop policy if exists "service role can manage chat logs" on public.chat_logs;
create policy "service role can manage chat logs"
on public.chat_logs
for all
to service_role
using (true)
with check (true);
