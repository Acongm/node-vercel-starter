import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const migrationDir = join(process.cwd(), 'supabase/migrations');
const files = readdirSync(migrationDir).filter((name) => name.endsWith('.sql')).sort();

const expectedLiveAligned = [
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

const removedStaleNames = [
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
  it('tracks already-applied migrations using the live schema_migrations versions', () => {
    for (const name of expectedLiveAligned) {
      expect(files).toContain(name);
    }
  });

  it('does not retain stale aliases that would replay already-applied SQL', () => {
    for (const name of removedStaleNames) {
      expect(files).not.toContain(name);
    }
  });

  it('orders the foundation before durable runs and pagination', () => {
    const foundation = files.indexOf('20260808040630_user_chat_supabase_auth.sql');
    const runs = files.indexOf('20260808040700_chat_runs_idempotency.sql');
    const pagination = files.indexOf('20260808040800_chat_stable_pagination.sql');

    expect(foundation).toBeGreaterThanOrEqual(0);
    expect(runs).toBeGreaterThan(foundation);
    expect(pagination).toBeGreaterThan(runs);
  });

  it('keeps comments/api_secrets initialization before platform_v2 policies', () => {
    const comments = files.indexOf('20260606000000_create_comments.sql');
    const platform = files.indexOf('20260805090501_platform_v2.sql');

    expect(comments).toBeGreaterThanOrEqual(0);
    expect(platform).toBeGreaterThan(comments);
  });
});
