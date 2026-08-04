-- Platform v2 schema: document versioning, KB analysis, sync jobs, chat threads.
-- Versions are append-only; heads point at the current version and sync state.
-- Access model: backend service_role (and optional server secret) only.
-- Roles viewer/editor/admin are enforced in the API layer via JWT app_metadata.

create extension if not exists pgcrypto;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

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

create or replace function private.request_has_platform_secret()
returns boolean
language sql
security definer
set search_path = private, public
stable
as $$
  select exists (
    select 1
    from private.api_secrets
    where name = 'platform'
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

-- ---------------------------------------------------------------------------
-- DocHub namespaces + document versioning
-- ---------------------------------------------------------------------------

create table if not exists public.dochub_namespaces (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (char_length(key) between 1 and 64),
  name text not null check (char_length(name) between 1 and 120),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  namespace_id uuid not null references public.dochub_namespaces (id) on delete cascade,
  path text not null check (char_length(path) between 1 and 512),
  content text not null,
  content_hash text not null check (char_length(content_hash) between 8 and 128),
  source text not null check (source in ('git', 'dochub', 'pipeline')),
  git_sha text,
  created_by text,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists document_versions_path_idx
  on public.document_versions (namespace_id, path, created_at desc);

create index if not exists document_versions_hash_idx
  on public.document_versions (content_hash);

create table if not exists public.document_heads (
  namespace_id uuid not null references public.dochub_namespaces (id) on delete cascade,
  path text not null check (char_length(path) between 1 and 512),
  current_version_id uuid references public.document_versions (id) on delete set null,
  draft_version_id uuid references public.document_versions (id) on delete set null,
  sync_state text not null default 'in_sync'
    check (sync_state in ('in_sync', 'git_ahead', 'db_ahead', 'conflict')),
  git_sha text,
  draft_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (namespace_id, path)
);

create index if not exists document_heads_sync_state_idx
  on public.document_heads (sync_state);

-- ---------------------------------------------------------------------------
-- Knowledge base analysis + chunks
-- ---------------------------------------------------------------------------

create table if not exists public.kb_analysis (
  id uuid primary key default gen_random_uuid(),
  namespace_id uuid references public.dochub_namespaces (id) on delete set null,
  path text not null check (char_length(path) between 1 and 512),
  source_hash text not null,
  analysis_hash text not null,
  title text,
  summary text,
  key_points jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  tech_stack jsonb not null default '[]'::jsonb,
  difficulty text,
  content_type text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kb_analysis_path_source_unique unique (path, source_hash)
);

create index if not exists kb_analysis_path_idx
  on public.kb_analysis (path);

create index if not exists kb_analysis_analysis_hash_idx
  on public.kb_analysis (analysis_hash);

create table if not exists public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  namespace_id uuid references public.dochub_namespaces (id) on delete set null,
  path text not null check (char_length(path) between 1 and 512),
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  source_hash text not null,
  heading text,
  token_count integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint kb_chunks_path_index_unique unique (path, source_hash, chunk_index)
);

create index if not exists kb_chunks_path_idx
  on public.kb_chunks (path);

create index if not exists kb_chunks_source_hash_idx
  on public.kb_chunks (source_hash);

-- ---------------------------------------------------------------------------
-- Sync jobs + failures (versions are never deleted on failure)
-- ---------------------------------------------------------------------------

create table if not exists public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null
    check (job_type in ('git_to_db', 'db_to_git', 'reconcile', 'pipeline', 'webhook')),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'succeeded', 'failed', 'cancelled')),
  trigger_source text not null default 'manual'
    check (trigger_source in ('manual', 'webhook', 'cron', 'api')),
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sync_jobs_status_idx
  on public.sync_jobs (status, created_at desc);

create index if not exists sync_jobs_type_idx
  on public.sync_jobs (job_type, created_at desc);

create table if not exists public.sync_failures (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.sync_jobs (id) on delete set null,
  namespace_id uuid references public.dochub_namespaces (id) on delete set null,
  path text,
  failure_code text not null,
  reason text not null,
  context jsonb not null default '{}'::jsonb,
  retry_count integer not null default 0 check (retry_count >= 0),
  next_retry_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sync_failures_open_idx
  on public.sync_failures (resolved_at, next_retry_at)
  where resolved_at is null;

create index if not exists sync_failures_path_idx
  on public.sync_failures (path);

-- ---------------------------------------------------------------------------
-- Chat threads / messages (Phase 5 persistence; schema reserved in P0)
-- ---------------------------------------------------------------------------

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  client_id text,
  conversation_id text,
  title text,
  call_source text not null default 'unknown',
  page_path text,
  module_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_threads_user_id_idx
  on public.chat_threads (user_id, updated_at desc);

create index if not exists chat_threads_client_id_idx
  on public.chat_threads (client_id);

create index if not exists chat_threads_conversation_id_idx
  on public.chat_threads (conversation_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null,
  model text,
  provider text,
  token_input integer,
  token_output integer,
  sources jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_id_idx
  on public.chat_messages (thread_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

drop trigger if exists dochub_namespaces_set_updated_at on public.dochub_namespaces;
create trigger dochub_namespaces_set_updated_at
before update on public.dochub_namespaces
for each row execute function private.set_updated_at();

drop trigger if exists document_heads_set_updated_at on public.document_heads;
create trigger document_heads_set_updated_at
before update on public.document_heads
for each row execute function private.set_updated_at();

drop trigger if exists kb_analysis_set_updated_at on public.kb_analysis;
create trigger kb_analysis_set_updated_at
before update on public.kb_analysis
for each row execute function private.set_updated_at();

drop trigger if exists sync_jobs_set_updated_at on public.sync_jobs;
create trigger sync_jobs_set_updated_at
before update on public.sync_jobs
for each row execute function private.set_updated_at();

drop trigger if exists sync_failures_set_updated_at on public.sync_failures;
create trigger sync_failures_set_updated_at
before update on public.sync_failures
for each row execute function private.set_updated_at();

drop trigger if exists chat_threads_set_updated_at on public.chat_threads;
create trigger chat_threads_set_updated_at
before update on public.chat_threads
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Grants + RLS (backend-only)
-- ---------------------------------------------------------------------------

revoke all on function private.request_has_platform_secret() from public, authenticated;
grant execute on function private.request_has_platform_secret() to anon, service_role;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'dochub_namespaces',
    'document_versions',
    'document_heads',
    'kb_analysis',
    'kb_chunks',
    'sync_jobs',
    'sync_failures',
    'chat_threads',
    'chat_messages'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on table public.%I from anon, authenticated', tbl);
    execute format(
      'grant select, insert, update, delete on table public.%I to service_role',
      tbl
    );
    execute format(
      'grant select, insert, update, delete on table public.%I to anon',
      tbl
    );

    execute format('drop policy if exists "service role manage %s" on public.%I', tbl, tbl);
    execute format(
      'create policy "service role manage %s" on public.%I for all to service_role using (true) with check (true)',
      tbl,
      tbl
    );

    execute format('drop policy if exists "server secret manage %s" on public.%I', tbl, tbl);
    execute format(
      'create policy "server secret manage %s" on public.%I for all to anon using (private.request_has_platform_secret()) with check (private.request_has_platform_secret())',
      tbl,
      tbl
    );
  end loop;
end;
$$;

-- document_versions must remain append-only at the API layer.
-- No UPDATE/DELETE policies beyond service_role for emergency ops.
