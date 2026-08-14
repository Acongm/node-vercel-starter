-- Independent user settings (defaults live in the API; this table stores overrides).
-- Do not store credentials, tokens, provider secrets, or authorization roles.

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version integer not null default 1,
  language text,
  theme text check (theme is null or theme in ('system', 'light', 'dark')),
  default_model text,
  default_prompt text check (
    default_prompt is null or char_length(default_prompt) between 0 and 2000
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function private.set_updated_at();

alter table public.user_settings enable row level security;

grant select, insert, update, delete on public.user_settings to authenticated;
grant select, insert, update, delete on public.user_settings to service_role;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
on public.user_settings for select
using ((select auth.uid()) = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
on public.user_settings for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
on public.user_settings for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "user_settings_delete_own" on public.user_settings;
create policy "user_settings_delete_own"
on public.user_settings for delete
using ((select auth.uid()) = user_id);
