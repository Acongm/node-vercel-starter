\set ON_ERROR_STOP on

do $$
declare
  author_ok boolean;
  content_ok boolean;
  blocked boolean;
begin
  select exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.comments'::regclass
      and c.contype = 'c'
      and c.conname = 'comments_author_check'
      and c.convalidated
  ) into author_ok;

  select exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.comments'::regclass
      and c.contype = 'c'
      and c.conname = 'comments_content_check'
      and c.convalidated
  ) into content_ok;

  if not author_ok then
    raise exception 'comments_author_check is missing or not validated';
  end if;
  if not content_ok then
    raise exception 'comments_content_check is missing or not validated';
  end if;

  blocked := false;
  begin
    insert into public.comments (author, content)
    values (repeat('A', 81), 'invalid author');
  exception when check_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'author length constraint did not reject 81 characters';
  end if;

  blocked := false;
  begin
    insert into public.comments (author, content)
    values ('valid', repeat('B', 2001));
  exception when check_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'content length constraint did not reject 2001 characters';
  end if;

  if (select count(*) from public.comments) <> 2 then
    raise exception 'constraint repair unexpectedly changed existing comment rows';
  end if;
end;
$$;
