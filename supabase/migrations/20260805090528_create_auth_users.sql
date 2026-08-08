-- Local + OAuth auth users for API-issued access tokens.
-- Registration is closed; seed via scripts/seed-auth-user.ts.
-- Access model: backend service_role (and optional server secret) only.

create extension if not exists pgcrypto;

create schema if not exists private;

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

create table if not exists public.auth_users (
  id uuid primary key default gen_random_uuid(),
  email text not null check (char_length(email) between 3 and 320),
  username text check (username is null or char_length(username) between 1 and 80),
  password_hash text,
  provider text not null check (provider in ('local', 'github', 'google')),
  provider_user_id text,
  role text not null default 'viewer'
    check (role in ('viewer', 'editor', 'admin')),
  name text,
  avatar_url text,
  disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint auth_users_email_unique unique (email),
  constraint auth_users_username_unique unique (username),
  constraint auth_users_provider_identity_unique unique (provider, provider_user_id)
);

create index if not exists auth_users_provider_idx
  on public.auth_users (provider, provider_user_id);

drop trigger if exists auth_users_set_updated_at on public.auth_users;
create trigger auth_users_set_updated_at
before update on public.auth_users
for each row execute function private.set_updated_at();

alter table public.auth_users enable row level security;

revoke all on table public.auth_users from anon, authenticated;
grant select, insert, update, delete on table public.auth_users to service_role;

drop policy if exists "service role can manage auth users" on public.auth_users;
create policy "service role can manage auth users"
on public.auth_users
for all
to service_role
using (true)
with check (true);
