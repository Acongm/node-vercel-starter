create extension if not exists pgcrypto;

create schema if not exists private;

create table if not exists private.api_secrets (
  name text primary key,
  secret_hash text not null,
  updated_at timestamptz not null default now()
);

alter table private.api_secrets enable row level security;

drop policy if exists "service role can read api secrets" on private.api_secrets;
create policy "service role can read api secrets"
on private.api_secrets
for select
to service_role
using (true);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  author text not null default 'Anonymous' check (char_length(author) between 1 and 80),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = private, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop function if exists public.set_updated_at();

create or replace function private.request_has_comments_secret()
returns boolean
language sql
security definer
set search_path = private, public
stable
as $$
  select exists (
    select 1
    from private.api_secrets
    where name = 'comments'
      and secret_hash = encode(
        extensions.digest(
          coalesce(
            nullif(current_setting('request.headers', true), '')::json->>'x-api-secret',
            ''
          ),
          'sha256'::text
        ),
        'hex'
      )
  );
$$;

drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at
before update on public.comments
for each row
execute function private.set_updated_at();

alter table public.comments enable row level security;

revoke all on table public.comments from anon, authenticated;
grant usage on schema public to anon;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.comments to anon;
grant select, insert, update, delete on table public.comments to service_role;

grant usage on schema private to service_role;
revoke all on function private.set_updated_at() from public, anon, authenticated;
grant execute on function private.set_updated_at() to service_role;
revoke all on function private.request_has_comments_secret() from public, authenticated;
grant execute on function private.request_has_comments_secret() to anon, service_role;

drop policy if exists "service role can manage comments" on public.comments;
create policy "service role can manage comments"
on public.comments
for all
to service_role
using (true)
with check (true);

drop policy if exists "server secret can manage comments" on public.comments;
create policy "server secret can manage comments"
on public.comments
for all
to anon
using (private.request_has_comments_secret())
with check (private.request_has_comments_secret());
