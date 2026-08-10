-- Dedicated user settings table (API Product Target #61).
-- profiles.preferences remains as fallback during rollout; API prefers user_settings.

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  schema_version integer not null default 1,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists user_settings_updated_at_idx
  on public.user_settings (updated_at desc);

alter table public.user_settings enable row level security;

drop policy if exists "Users can read own settings" on public.user_settings;
create policy "Users can read own settings"
  on public.user_settings
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can upsert own settings" on public.user_settings;
create policy "Users can upsert own settings"
  on public.user_settings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.user_settings to authenticated;
grant all on table public.user_settings to service_role;

-- Backfill from profiles.preferences when present.
insert into public.user_settings (user_id, schema_version, settings, updated_at)
select p.id, 1, coalesce(p.preferences, '{}'::jsonb), now()
from public.profiles p
where p.preferences is not null
  and p.preferences <> '{}'::jsonb
on conflict (user_id) do nothing;
