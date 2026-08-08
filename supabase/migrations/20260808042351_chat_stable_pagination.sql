-- Stable cursor pagination for Chat v2.
-- Query order and index order intentionally match so equal timestamps use the
-- UUID id as a deterministic tie-breaker.
--
-- Reuse the original index names from the foundation migration so environments
-- replace the two-column indexes instead of keeping redundant indexes.

drop index if exists public.chats_user_updated_at_idx;
create index chats_user_updated_at_idx
  on public.chats(user_id, updated_at desc, id desc);

drop index if exists public.messages_chat_created_at_idx;
create index messages_chat_created_at_idx
  on public.messages(chat_id, created_at asc, id asc);
