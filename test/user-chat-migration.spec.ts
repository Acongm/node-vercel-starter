import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260808000000_user_chat_supabase_auth.sql'),
  'utf8',
);

describe('user/chat Supabase migration invariants', () => {
  it('keeps identity in auth.users instead of a second identity table', () => {
    expect(migration).toContain('public.profiles');
    expect(migration).toContain('references auth.users(id) on delete cascade');
    expect(migration).toContain('user_id uuid not null references auth.users(id) on delete cascade');
  });

  it('enables RLS on every new user-owned table', () => {
    for (const table of ['profiles', 'chats', 'messages']) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('uses auth.uid ownership checks for chats and messages', () => {
    expect(migration).toContain('using ((select auth.uid()) = user_id)');
    expect(migration).toContain('with check ((select auth.uid()) = user_id)');
    expect(migration).toContain('and c.user_id = (select auth.uid())');
  });

  it('cascades message deletion from the parent chat', () => {
    expect(migration).toContain('chat_id uuid not null references public.chats(id) on delete cascade');
  });

  it('does not migrate legacy identities unless they map to auth.users', () => {
    expect(migration).toContain('join auth.users u on u.id = t.user_id');
  });
});
