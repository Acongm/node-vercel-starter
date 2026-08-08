\set ON_ERROR_STOP on

-- Verify B-tree column order and direction against ChatRepository cursor queries.
-- indoption bit 0 means DESC for the corresponding key column.
do $$
declare
  chat_columns text[];
  chat_options int2vector;
  message_columns text[];
  message_options int2vector;
begin
  select
    array_agg(a.attname order by key_position),
    i.indoption
  into chat_columns, chat_options
  from pg_index i
  join pg_class idx on idx.oid = i.indexrelid
  join lateral unnest(i.indkey) with ordinality as keys(attnum, key_position) on true
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = keys.attnum
  where idx.relname = 'chats_user_updated_at_idx'
  group by i.indoption;

  if chat_columns is distinct from array['user_id', 'updated_at', 'id']::text[] then
    raise exception 'unexpected chats cursor index columns: %', chat_columns;
  end if;
  if (chat_options[0] & 1) <> 0
     or (chat_options[1] & 1) = 0
     or (chat_options[2] & 1) = 0 then
    raise exception 'chats cursor index must be user_id ASC, updated_at DESC, id DESC; indoption=%', chat_options;
  end if;

  select
    array_agg(a.attname order by key_position),
    i.indoption
  into message_columns, message_options
  from pg_index i
  join pg_class idx on idx.oid = i.indexrelid
  join lateral unnest(i.indkey) with ordinality as keys(attnum, key_position) on true
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = keys.attnum
  where idx.relname = 'messages_chat_created_at_idx'
  group by i.indoption;

  if message_columns is distinct from array['chat_id', 'created_at', 'id']::text[] then
    raise exception 'unexpected messages cursor index columns: %', message_columns;
  end if;
  if (message_options[0] & 1) <> 0
     or (message_options[1] & 1) <> 0
     or (message_options[2] & 1) <> 0 then
    raise exception 'messages cursor index must be chat_id ASC, created_at ASC, id ASC; indoption=%', message_options;
  end if;
end;
$$;
