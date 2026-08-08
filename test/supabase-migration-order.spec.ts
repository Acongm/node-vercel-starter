import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const files = readdirSync(join(process.cwd(), 'supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort();

const expected = [
  '20260606000000_create_comments.sql',
  '20260620022412_create_chat_logs.sql',
  '20260620030938_chat_logs_anon_secret_policy.sql',
  '20260620033818_create_chat_client_labels.sql',
  '20260620034506_chat_client_labels_anon_secret_policy.sql',
  '20260805090501_platform_v2.sql',
  '20260805090518_chat_messages_thinking.sql',
  '20260805090524_chat_logs_structured_fields.sql',
  '20260805090528_create_auth_users.sql',
  '20260808040630_user_chat_supabase_auth.sql',
  '20260808040700_chat_runs_idempotency.sql',
  '20260808040800_chat_stable_pagination.sql',
] as const;

const stale = [
  '001_platform_v2.sql',
  '20260619000000_create_chat_logs.sql',
  '20260620000000_chat_logs_anon_secret_policy.sql',
  '20260621000000_create_chat_client_labels.sql',
  '20260622000000_chat_client_labels_anon_secret_policy.sql',
  '20260805000000_chat_logs_structured_fields.sql',
  '20260805000001_chat_messages_thinking.sql',
  '20260805000002_create_auth_users.sql',
  '20260808000000_user_chat_supabase_auth.sql',
  '20260808010000_chat_runs_idempotency.sql',
  '20260808020000_chat_stable_pagination.sql',
] as const;

describe('Supabase migration history ordering', () => {
  it('contains the live-aligned migration versions and durable successors', () => {
    for (const name of expected) expect(files).toContain(name);
  });

  it('removes stale aliases that could replay already-applied SQL', () => {
    for (const name of stale) expect(files).not.toContain(name);
  });

  it('initializes api_secrets before platform_v2 uses secret policies', () => {
    expect(files.indexOf('20260805090501_platform_v2.sql')).toBeGreaterThan(
      files.indexOf('20260606000000_create_comments.sql'),
    );
  });

  it('runs foundation before durable runs and stable pagination', () => {
    const foundation = files.indexOf('20260808040630_user_chat_supabase_auth.sql');
    const runs = files.indexOf('20260808040700_chat_runs_idempotency.sql');
    const pagination = files.indexOf('20260808040800_chat_stable_pagination.sql');

    expect(foundation).toBeGreaterThanOrEqual(0);
    expect(runs).toBeGreaterThan(foundation);
    expect(pagination).toBeGreaterThan(runs);
  });
});
