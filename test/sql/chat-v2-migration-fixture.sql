\set ON_ERROR_STOP on

-- Minimal Supabase Auth surface required by the application migrations.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

create schema if not exists auth;

create table auth.users (
  id uuid primary key,
  is_anonymous boolean not null default false
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant usage on schema auth to authenticated, service_role;
grant execute on function auth.uid() to authenticated, service_role;

-- Minimal legacy Chat schema: only columns referenced by the new migrations.
create table public.chat_threads (
  id uuid primary key,
  user_id uuid,
  client_id text,
  title text,
  conversation_id text,
  page_path text,
  module_key text,
  call_source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.chat_messages (
  id uuid primary key,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null,
  content text not null,
  thinking text,
  sources jsonb not null default '[]'::jsonb,
  provider text,
  model text,
  token_input integer,
  token_output integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

insert into auth.users (id, is_anonymous) values
  ('11111111-1111-4111-8111-111111111111', false),
  ('22222222-2222-4222-8222-222222222222', true);

-- Two auth-backed threads should migrate. The client-only thread must remain
-- legacy-only because it has no trustworthy auth.users owner.
insert into public.chat_threads (
  id, user_id, client_id, title, conversation_id, page_path, module_key,
  call_source, metadata, created_at, updated_at
) values
  (
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    null,
    'User A chat',
    'legacy-a',
    '/a',
    'a',
    'fixture',
    '{"fixture":"a"}',
    '2026-01-01T00:00:00Z',
    '2026-01-01T00:02:00Z'
  ),
  (
    '55555555-5555-4555-8555-555555555555',
    '22222222-2222-4222-8222-222222222222',
    null,
    'User B anonymous chat',
    'legacy-b',
    '/b',
    'b',
    'fixture',
    '{"fixture":"b"}',
    '2026-01-01T00:00:00Z',
    '2026-01-01T00:03:00Z'
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    null,
    'legacy-client-only',
    'Client-only legacy chat',
    'legacy-client',
    '/legacy',
    'legacy',
    'fixture',
    '{"fixture":"client-only"}',
    '2026-01-01T00:00:00Z',
    '2026-01-01T00:04:00Z'
  );

insert into public.chat_messages (
  id, thread_id, role, content, thinking, sources, provider, model,
  token_input, token_output, metadata, created_at
) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    '44444444-4444-4444-8444-444444444444',
    'user',
    'first user turn',
    null,
    '[]',
    null,
    null,
    3,
    0,
    '{}',
    '2026-01-01T00:00:00Z'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    '44444444-4444-4444-8444-444444444444',
    'assistant',
    'first assistant turn',
    'reasoning',
    '[{"title":"fixture"}]',
    'fixture-provider',
    'fixture-model',
    3,
    5,
    '{}',
    '2026-01-01T00:01:00Z'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    '55555555-5555-4555-8555-555555555555',
    'user',
    'anonymous Supabase user turn',
    null,
    '[]',
    null,
    null,
    2,
    0,
    '{}',
    '2026-01-01T00:00:30Z'
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    '66666666-6666-4666-8666-666666666666',
    'user',
    'client-only legacy turn',
    null,
    '[]',
    null,
    null,
    2,
    0,
    '{}',
    '2026-01-01T00:00:30Z'
  );
