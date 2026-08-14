import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const files = readdirSync(join(process.cwd(), 'supabase/migrations'))
  .filter((name) => name.endsWith('.sql'))
  .sort();

const required = [
  // This prerequisite exists in the repository and creates comments/api_secrets.
  // The live DB has those objects but is missing this historical version entry.
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
  '20260808042345_chat_runs_idempotency.sql',
  '20260808042351_chat_stable_pagination.sql',
  // Read-only parity audit found the live comments table lacks the two length
  // CHECKs from the historical baseline, so history repair alone is not enough.
  '20260808050000_comments_constraints_repair.sql',
  '20260814010000_user_settings.sql',
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
  '20260808040700_chat_runs_idempotency.sql',
  '20260808040800_chat_stable_pagination.sql',
] as const;

describe('Supabase migration history ordering', () => {
  it('contains the reproducible prerequisite, live-version migrations and drift repair', () => {
    for (const name of required) expect(files).toContain(name);
  });

  it('removes stale aliases that could replay already-applied SQL', () => {
    for (const name of stale) expect(files).not.toContain(name);
  });

  it('initializes api_secrets before platform_v2 uses secret policies', () => {
    expect(files.indexOf('20260805090501_platform_v2.sql')).toBeGreaterThan(
      files.indexOf('20260606000000_create_comments.sql'),
    );
  });

  it('runs foundation before durable runs, pagination and comments drift repair', () => {
    const foundation = files.indexOf('20260808040630_user_chat_supabase_auth.sql');
    const runs = files.indexOf('20260808042345_chat_runs_idempotency.sql');
    const pagination = files.indexOf('20260808042351_chat_stable_pagination.sql');
    const commentsRepair = files.indexOf(
      '20260808050000_comments_constraints_repair.sql',
    );

    expect(foundation).toBeGreaterThanOrEqual(0);
    expect(runs).toBeGreaterThan(foundation);
    expect(pagination).toBeGreaterThan(runs);
    expect(commentsRepair).toBeGreaterThan(pagination);
    expect(files.indexOf('20260814010000_user_settings.sql')).toBeGreaterThan(
      foundation,
    );
  });
});
