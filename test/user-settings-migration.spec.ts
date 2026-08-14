import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260814010000_user_settings.sql'),
  'utf8',
);

describe('user_settings migration (#61)', () => {
  it('owns settings by auth.users and enables owner-only RLS', () => {
    expect(migration).toContain('create table if not exists public.user_settings');
    expect(migration).toContain('references auth.users(id) on delete cascade');
    expect(migration).toContain('alter table public.user_settings enable row level security');
    expect(migration).toContain('using ((select auth.uid()) = user_id)');
    expect(migration).toContain('with check ((select auth.uid()) = user_id)');
  });

  it('does not store secrets or authorization roles', () => {
    expect(migration).toContain('default_model');
    expect(migration).toContain('default_prompt');
    expect(migration).not.toContain('password');
    expect(migration).not.toContain('access_token');
    expect(migration).not.toContain('platform_role');
  });
});
