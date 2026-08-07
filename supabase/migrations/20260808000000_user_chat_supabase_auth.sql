-- User/Chat refactor foundation.
-- Supabase Auth (auth.users) becomes the identity source for new user/chat APIs.
-- Legacy public.auth_users/chat_threads/chat_messages remain temporarily for compatibility.

create extension if not exists pgcrypto;
create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Application profile data only. Identity remains in auth.users.
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 80),
  avatar_url text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- User-owned chat domain. Message payload uses extensible parts JSON.
-- ---------------------------------------------------------------------------

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text check (title is null or char_length(title) between 1 and 200),
  page_path text,
  module_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chats_user_updated_at_idx
  on public.chats(user_id, updated_at desc);

drop trigger if exists chats_set_updated_at on public.chats;
create trigger chats_set_updated_at
before update on public.chats
for each row execute function private.set_updated_at();

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  parts jsonb not null default '[]'::jsonb check (jsonb_typeof(parts) = 'array'),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_chat_created_at_idx
  on public.messages(chat_id, created_at asc);
create index if not exists messages_user_created_at_idx
  on public.messages(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: authenticated Supabase users own their rows. Anonymous Supabase users
-- also use the authenticated Postgres role and therefore work with auth.uid().
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.chats to authenticated;
grant select, insert, update, delete on public.messages to authenticated;

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.chats to service_role;
grant select, insert, update, delete on public.messages to service_role;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "chats_select_own" on public.chats;
create policy "chats_select_own"
on public.chats for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "chats_insert_own" on public.chats;
create policy "chats_insert_own"
on public.chats for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "chats_update_own" on public.chats;
create policy "chats_update_own"
on public.chats for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "chats_delete_own" on public.chats;
create policy "chats_delete_own"
on public.chats for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "messages_select_own" on public.messages;
create policy "messages_select_own"
on public.messages for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own"
on public.messages for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.chats c
    where c.id = chat_id
      and c.user_id = (select auth.uid())
  )
);

drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own"
on public.messages for update
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

drop policy if exists "messages_delete_own" on public.messages;
create policy "messages_delete_own"
on public.messages for delete
to authenticated
using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Best-effort legacy migration: only move threads whose user_id is already a
-- real Supabase auth.users id. Custom public.auth_users identities are not
-- copied into the new identity model.
-- ---------------------------------------------------------------------------

insert into public.chats (
  id,
  user_id,
  title,
  page_path,
  module_key,
  metadata,
  created_at,
  updated_at
)
select
  t.id,
  t.user_id,
  t.title,
  t.page_path,
  t.module_key,
  coalesce(t.metadata, '{}'::jsonb) || jsonb_build_object(
    'legacyConversationId', t.conversation_id,
    'legacyCallSource', t.call_source
  ),
  t.created_at,
  t.updated_at
from public.chat_threads t
join auth.users u on u.id = t.user_id
on conflict (id) do nothing;

insert into public.messages (
  id,
  chat_id,
  user_id,
  role,
  parts,
  metadata,
  created_at
)
select
  m.id,
  m.thread_id,
  c.user_id,
  m.role,
  jsonb_build_array(
    jsonb_build_object('type', 'text', 'text', m.content)
  ),
  coalesce(m.metadata, '{}'::jsonb) || jsonb_build_object(
    'legacyThinking', m.thinking,
    'legacySources', coalesce(m.sources, '[]'::jsonb),
    'provider', m.provider,
    'model', m.model,
    'tokenInput', m.token_input,
    'tokenOutput', m.token_output
  ),
  m.created_at
from public.chat_messages m
join public.chats c on c.id = m.thread_id
on conflict (id) do nothing;
