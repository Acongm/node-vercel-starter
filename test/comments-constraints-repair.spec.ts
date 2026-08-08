import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260808050000_comments_constraints_repair.sql',
  ),
  'utf8',
);

describe('comments constraints repair migration', () => {
  it('restores the historical author and content length checks', () => {
    expect(migration).toContain('comments_author_check');
    expect(migration).toContain('char_length(author) between 1 and 80');
    expect(migration).toContain('comments_content_check');
    expect(migration).toContain('char_length(content) between 1 and 2000');
  });

  it('validates both constraints after adding them', () => {
    expect(migration).toContain('validate constraint comments_author_check');
    expect(migration).toContain('validate constraint comments_content_check');
  });

  it('does not rewrite or delete comment rows', () => {
    const lower = migration.toLowerCase();
    expect(lower).not.toContain('delete from public.comments');
    expect(lower).not.toContain('update public.comments');
    expect(lower).not.toContain('truncate');
    expect(lower).not.toContain('drop table');
  });
});
