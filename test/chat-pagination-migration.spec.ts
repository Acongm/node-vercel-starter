import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260808042351_chat_stable_pagination.sql',
  ),
  'utf8',
);

describe('chat stable pagination migration invariants', () => {
  it('matches chat list ownership and descending cursor order', () => {
    expect(migration).toContain(
      'on public.chats(user_id, updated_at desc, id desc)',
    );
  });

  it('matches message history chat scope and ascending cursor order', () => {
    expect(migration).toContain(
      'on public.messages(chat_id, created_at asc, id asc)',
    );
  });

  it('is additive and does not destroy existing data', () => {
    expect(migration.toLowerCase()).not.toContain('drop table');
    expect(migration.toLowerCase()).not.toContain('delete from');
  });
});
