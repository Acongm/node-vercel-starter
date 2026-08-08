-- Durable assistant-ui message identity, branching and run lifecycle.
--
-- This migration is additive. Existing messages are backfilled as one linear
-- branch in chronological order; new messages may form explicit branches via
-- parent_message_id. A stable client_message_id lets LocalRuntime/history
-- adapters retry without creating duplicate durable messages.

alter table public.messages
  add column if not exists client_message_id text,
  add column if not exists parent_message_id uuid references public.messages(id) on delete set null;

create unique index if not exists messages_chat_client_message_id_uidx
  on public.messages(chat_id, client_message_id)
  where client_message_id is not null;

create index if not exists messages_parent_message_id_idx
  on public.messages(parent_message_id)
  where parent_message_id is not null;

-- Legacy rows predate branching. Preserve their existing chronological order
-- as a single parent chain so branch traversal has deterministic semantics.
with ordered_messages as (
  select
    id,
    lag(id) over (
      partition by chat_id
      order by created_at asc, id asc
    ) as previous_id
  from public.messages
)
update public.messages as m
set parent_message_id = ordered_messages.previous_id
from ordered_messages
where m.id = ordered_messages.id
  and m.parent_message_id is null
  and ordered_messages.previous_id is not null;

create table if not exists public.chat_runs (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_message_id uuid not null references public.messages(id) on delete cascade,
  assistant_message_id uuid references public.messages(id) on delete set null,
  status text not null default 'running'
    check (status in ('running', 'complete', 'cancelled', 'error')),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists chat_runs_chat_started_at_idx
  on public.chat_runs(chat_id, started_at desc);
create index if not exists chat_runs_user_started_at_idx
  on public.chat_runs(user_id, started_at desc);
create index if not exists chat_runs_user_message_idx
  on public.chat_runs(user_message_id, started_at desc);

drop trigger if exists chat_runs_set_updated_at on public.chat_runs;
create trigger chat_runs_set_updated_at
before update on public.chat_runs
for each row execute function private.set_updated_at();

alter table public.chat_runs enable row level security;

grant select, insert, update, delete on public.chat_runs to authenticated;
grant select, insert, update, delete on public.chat_runs to service_role;

drop policy if exists "chat_runs_select_own" on public.chat_runs;
create policy "chat_runs_select_own"
on public.chat_runs for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "chat_runs_insert_own" on public.chat_runs;
create policy "chat_runs_insert_own"
on public.chat_runs for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.chats c
    where c.id = chat_id
      and c.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.messages m
    where m.id = user_message_id
      and m.chat_id = chat_id
      and m.user_id = (select auth.uid())
      and m.role = 'user'
  )
);

drop policy if exists "chat_runs_update_own" on public.chat_runs;
create policy "chat_runs_update_own"
on public.chat_runs for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.chats c
    where c.id = chat_id
      and c.user_id = (select auth.uid())
  )
);

drop policy if exists "chat_runs_delete_own" on public.chat_runs;
create policy "chat_runs_delete_own"
on public.chat_runs for delete
to authenticated
using ((select auth.uid()) = user_id);
