-- Align B-tree ordering with deterministic cursor pagination.
--
-- Earlier migration names are reused so environments that already created the
-- two-column indexes replace them instead of keeping redundant indexes.

drop index if exists public.chats_user_updated_at_idx;
create index chats_user_updated_at_idx
  on public.chats(user_id, updated_at desc, id desc);

drop index if exists public.messages_chat_created_at_idx;
create index messages_chat_created_at_idx
  on public.messages(chat_id, created_at asc, id asc);
