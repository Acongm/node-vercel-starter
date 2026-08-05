-- Add thinking sample column for persisted assistant messages.

alter table public.chat_messages
  add column if not exists thinking text;
