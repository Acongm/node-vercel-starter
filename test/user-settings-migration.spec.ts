import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260808051000_user_settings.sql'),
  'utf8',
);

describe('user_settings migration invariants', () => {
  it('creates an owner-scoped settings table with RLS', () => {
    expect(migration).toContain('create table if not exists public.user_settings');
    expect(migration).toContain('schema_version');
    expect(migration).toContain('alter table public.user_settings enable row level security');
    expect(migration).toContain('auth.uid() = user_id');
  });

  it('backfills from profiles.preferences', () => {
    expect(migration).toContain('from public.profiles p');
    expect(migration).toContain('p.preferences');
  });
});
