-- Stage 1.3: safely transfer durable Chat v2 ownership when an anonymous
-- Supabase principal signs in to an existing permanent account.
--
-- The API verifies both access tokens before calling this function. The
-- function is service-role-only and repeats principal-type checks in the
-- database as defense in depth. All three user_id columns are updated in one
-- transaction so RLS never observes a partially migrated chat graph.

create or replace function public.transfer_chat_ownership(
  p_source_user_id uuid,
  p_destination_user_id uuid
)
returns table (
  chats_transferred bigint,
  messages_transferred bigint,
  runs_transferred bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_is_anonymous boolean;
  destination_is_anonymous boolean;
  moved_chats bigint := 0;
  moved_messages bigint := 0;
  moved_runs bigint := 0;
begin
  if p_source_user_id is null or p_destination_user_id is null then
    raise exception 'source and destination users are required';
  end if;

  if p_source_user_id = p_destination_user_id then
    return query select 0::bigint, 0::bigint, 0::bigint;
    return;
  end if;

  select u.is_anonymous
  into source_is_anonymous
  from auth.users u
  where u.id = p_source_user_id;

  if source_is_anonymous is distinct from true then
    raise exception 'source user must be anonymous';
  end if;

  select u.is_anonymous
  into destination_is_anonymous
  from auth.users u
  where u.id = p_destination_user_id;

  if destination_is_anonymous is distinct from false then
    raise exception 'destination user must be permanent';
  end if;

  update public.messages
  set user_id = p_destination_user_id
  where user_id = p_source_user_id;
  get diagnostics moved_messages = row_count;

  update public.chat_runs
  set user_id = p_destination_user_id
  where user_id = p_source_user_id;
  get diagnostics moved_runs = row_count;

  update public.chats
  set user_id = p_destination_user_id
  where user_id = p_source_user_id;
  get diagnostics moved_chats = row_count;

  return query select moved_chats, moved_messages, moved_runs;
end;
$$;

revoke all on function public.transfer_chat_ownership(uuid, uuid) from public;
revoke all on function public.transfer_chat_ownership(uuid, uuid) from anon;
revoke all on function public.transfer_chat_ownership(uuid, uuid) from authenticated;
grant execute on function public.transfer_chat_ownership(uuid, uuid) to service_role;
