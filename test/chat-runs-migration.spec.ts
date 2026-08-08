import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260808010000_chat_runs_idempotency.sql',
  ),
  'utf8',
);

describe('chat run/idempotency migration invariants', () => {
  it('adds stable client ids and a strong parent message foreign key', () => {
    expect(migration).toContain('add column if not exists client_message_id text');
    expect(migration).toContain(
      'add column if not exists parent_message_id uuid references public.messages(id) on delete set null',
    );
    expect(migration).toContain(
      'on public.messages(chat_id, client_message_id)',
    );
  });

  it('backfills legacy messages as a deterministic chronological parent chain', () => {
    expect(migration).toContain('lag(id) over');
    expect(migration).toContain('partition by chat_id');
    expect(migration).toContain('order by created_at asc, id asc');
    expect(migration).toContain('set parent_message_id = ordered_messages.previous_id');
  });

  it('stores one durable lifecycle row per model run', () => {
    expect(migration).toContain('create table if not exists public.chat_runs');
    expect(migration).toContain(
      "check (status in ('running', 'complete', 'cancelled', 'error'))",
    );
    expect(migration).toContain(
      'user_message_id uuid not null references public.messages(id) on delete cascade',
    );
    expect(migration).toContain(
      'assistant_message_id uuid references public.messages(id) on delete set null',
    );
  });

  it('enables RLS and binds run message references to the same owned chat', () => {
    expect(migration).toContain(
      'alter table public.chat_runs enable row level security',
    );
    expect(migration).toContain(
      '(select auth.uid()) = chat_runs.user_id',
    );
    expect(migration).toContain('where c.id = chat_runs.chat_id');
    expect(migration).toContain(
      'where m.id = chat_runs.user_message_id',
    );
    expect(migration).toContain(
      'where m.id = chat_runs.assistant_message_id',
    );
    expect(migration).toContain('and m.chat_id = chat_runs.chat_id');
    expect(migration).toContain("and m.role = 'user'");
    expect(migration).toContain("and m.role = 'assistant'");
  });

  it('does not drop legacy or foundation chat tables', () => {
    expect(migration.toLowerCase()).not.toContain('drop table');
  });
});
