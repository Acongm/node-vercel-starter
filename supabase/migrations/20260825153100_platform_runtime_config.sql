-- Platform-wide runtime config (LLM, KB service callers, OpenAPI flags).
-- Secrets live in private.platform_secret_values; only service_role reads them.

create table if not exists public.platform_runtime_config (
  id text primary key default 'default',
  schema_version integer not null default 1,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists platform_runtime_config_set_updated_at on public.platform_runtime_config;
create trigger platform_runtime_config_set_updated_at
before update on public.platform_runtime_config
for each row execute function private.set_updated_at();

create table if not exists private.platform_secret_values (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists platform_secret_values_set_updated_at on private.platform_secret_values;
create trigger platform_secret_values_set_updated_at
before update on private.platform_secret_values
for each row execute function private.set_updated_at();

alter table public.platform_runtime_config enable row level security;
alter table private.platform_secret_values enable row level security;

revoke all on public.platform_runtime_config from anon, authenticated;
grant select, insert, update, delete on public.platform_runtime_config to service_role;

revoke all on private.platform_secret_values from anon, authenticated;
grant select, insert, update, delete on private.platform_secret_values to service_role;
