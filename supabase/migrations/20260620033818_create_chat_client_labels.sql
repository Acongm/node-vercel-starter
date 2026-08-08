create table if not exists public.chat_client_labels (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  label text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_client_labels_client_id_idx
  on public.chat_client_labels (client_id);

alter table public.chat_client_labels enable row level security;

revoke all on table public.chat_client_labels from anon, authenticated;
grant select, insert, update, delete on public.chat_client_labels to service_role;

drop policy if exists "service role can manage chat client labels" on public.chat_client_labels;
create policy "service role can manage chat client labels"
on public.chat_client_labels
for all
to service_role
using (true)
with check (true);
