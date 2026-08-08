\set ON_ERROR_STOP on

-- Structural + legacy migration invariants after both application migrations.
do $$
declare
  value integer;
  parent_id uuid;
begin
  select count(*) into value from public.chats;
  if value <> 2 then
    raise exception 'expected 2 auth-backed migrated chats, got %', value;
  end if;

  if exists (
    select 1 from public.chats
    where id = '66666666-6666-4666-8666-666666666666'
  ) then
    raise exception 'client-id-only legacy thread must not be auto-migrated';
  end if;

  select count(*) into value from public.messages;
  if value <> 3 then
    raise exception 'expected 3 auth-backed migrated messages, got %', value;
  end if;

  select parent_message_id into parent_id
  from public.messages
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  if parent_id is not null then
    raise exception 'first message in a legacy chat must remain a root';
  end if;

  select parent_message_id into parent_id
  from public.messages
  where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  if parent_id is distinct from 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid then
    raise exception 'legacy chronological parent backfill is incorrect: %', parent_id;
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'messages'
      and column_name = 'client_message_id'
  ) then
    raise exception 'messages.client_message_id is missing';
  end if;

  if to_regclass('public.chat_runs') is null then
    raise exception 'public.chat_runs is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'messages_chat_client_message_id_uidx'
  ) then
    raise exception 'message idempotency unique index is missing';
  end if;

  if (
    select metadata->>'legacyConversationId'
    from public.chats
    where id = '44444444-4444-4444-8444-444444444444'
  ) is distinct from 'legacy-a' then
    raise exception 'legacy chat metadata was not preserved';
  end if;
end;
$$;

-- RLS must be enabled on every new user-owned table.
do $$
declare
  table_name text;
  enabled boolean;
begin
  foreach table_name in array array['profiles', 'chats', 'messages', 'chat_runs'] loop
    select c.relrowsecurity into enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = table_name;

    if enabled is distinct from true then
      raise exception 'RLS is not enabled on public.%', table_name;
    end if;
  end loop;
end;
$$;

-- client_message_id is a true idempotency key within one chat.
update public.messages
set client_message_id = 'fixture-user-a'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

do $$
declare
  blocked boolean := false;
begin
  begin
    insert into public.messages (
      id, chat_id, user_id, client_message_id, role, parts
    ) values (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
      '44444444-4444-4444-8444-444444444444',
      '11111111-1111-4111-8111-111111111111',
      'fixture-user-a',
      'user',
      '[{"type":"text","text":"duplicate"}]'
    );
  exception when unique_violation then
    blocked := true;
  end;

  if not blocked then
    raise exception 'duplicate client_message_id was not rejected';
  end if;
end;
$$;

-- User A: sees only A rows; can create a valid run; cannot target B's chat.
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  false
);

do $$
declare
  value integer;
  blocked boolean;
begin
  select count(*) into value from public.chats;
  if value <> 1 then
    raise exception 'user A should see exactly 1 chat through RLS, got %', value;
  end if;

  select count(*) into value from public.messages;
  if value <> 2 then
    raise exception 'user A should see exactly 2 messages through RLS, got %', value;
  end if;

  blocked := false;
  begin
    insert into public.chats (
      id, user_id, title
    ) values (
      '77777777-7777-4777-8777-777777777777',
      '22222222-2222-4222-8222-222222222222',
      'cross-user insert must fail'
    );
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'RLS allowed user A to create user B chat';
  end if;

  blocked := false;
  begin
    insert into public.messages (
      id, chat_id, user_id, role, parts
    ) values (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
      '55555555-5555-4555-8555-555555555555',
      '11111111-1111-4111-8111-111111111111',
      'user',
      '[{"type":"text","text":"cross-user message"}]'
    );
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'RLS allowed user A to insert into user B chat';
  end if;

  insert into public.chat_runs (
    id,
    chat_id,
    user_id,
    user_message_id,
    status
  ) values (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    '44444444-4444-4444-8444-444444444444',
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    'running'
  );

  select count(*) into value from public.chat_runs;
  if value <> 1 then
    raise exception 'user A valid run insert did not persist through RLS';
  end if;

  blocked := false;
  begin
    insert into public.chat_runs (
      id,
      chat_id,
      user_id,
      user_message_id,
      status
    ) values (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
      '55555555-5555-4555-8555-555555555555',
      '11111111-1111-4111-8111-111111111111',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      'running'
    );
  exception when insufficient_privilege then
    blocked := true;
  end;
  if not blocked then
    raise exception 'RLS allowed a run to bind user A to user B chat';
  end if;
end;
$$;

-- Supabase anonymous users use the same authenticated DB role. Switching only
-- auth.uid() must isolate them to their own rows.
select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  false
);

do $$
declare
  value integer;
begin
  select count(*) into value from public.chats;
  if value <> 1 then
    raise exception 'anonymous user B should see exactly 1 own chat, got %', value;
  end if;

  select count(*) into value from public.messages;
  if value <> 1 then
    raise exception 'anonymous user B should see exactly 1 own message, got %', value;
  end if;

  select count(*) into value from public.chat_runs;
  if value <> 0 then
    raise exception 'anonymous user B must not see user A runs';
  end if;
end;
$$;

reset role;

-- Database cascade is the authoritative delete behavior for chat state.
delete from public.chats
where id = '44444444-4444-4444-8444-444444444444';

do $$
declare
  value integer;
begin
  select count(*) into value
  from public.messages
  where chat_id = '44444444-4444-4444-8444-444444444444';
  if value <> 0 then
    raise exception 'chat delete did not cascade to messages';
  end if;

  select count(*) into value
  from public.chat_runs
  where chat_id = '44444444-4444-4444-8444-444444444444';
  if value <> 0 then
    raise exception 'chat delete did not cascade to runs';
  end if;

  if not exists (
    select 1 from public.chat_threads
    where id = '66666666-6666-4666-8666-666666666666'
  ) then
    raise exception 'new migration unexpectedly removed legacy client-only data';
  end if;
end;
$$;
