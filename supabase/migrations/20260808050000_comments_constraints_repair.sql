-- Repair historical comments schema drift before marking the original
-- 20260606000000_create_comments migration as applied in remote history.
--
-- The live table already exists and current rows satisfy these rules, but the
-- two CHECK constraints from the tracked baseline are missing. Normalize the
-- constraint names/definitions in both fresh and existing environments.

alter table public.comments
  drop constraint if exists comments_author_check;

alter table public.comments
  add constraint comments_author_check
  check (char_length(author) between 1 and 80)
  not valid;

alter table public.comments
  validate constraint comments_author_check;

alter table public.comments
  drop constraint if exists comments_content_check;

alter table public.comments
  add constraint comments_content_check
  check (char_length(content) between 1 and 2000)
  not valid;

alter table public.comments
  validate constraint comments_content_check;
