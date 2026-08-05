-- P1-09: structured chat log fields for identity + tokens + thinking sample.

alter table public.chat_logs
  add column if not exists user_id text,
  add column if not exists thinking text,
  add column if not exists prompt_tokens integer,
  add column if not exists completion_tokens integer,
  add column if not exists total_tokens integer;

create index if not exists chat_logs_user_id_idx
  on public.chat_logs (user_id);

create index if not exists chat_logs_conversation_id_idx
  on public.chat_logs (conversation_id);
