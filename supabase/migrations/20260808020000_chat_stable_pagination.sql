-- Stable cursor pagination for Chat v2.
-- Query order and index order intentionally match so equal timestamps use the
-- UUID id as a deterministic tie-breaker.

create index if not exists chats_user_updated_id_idx
  on public.chats(user_id, updated_at desc, id desc);

create index if not exists messages_chat_created_id_idx
  on public.messages(chat_id, created_at asc, id asc);
