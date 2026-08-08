describe('assistant-ui durable backend capability backlog', () => {
  /**
   * These are deliberately executable TODOs, not skipped happy-path tests.
   * The current Acongm/chat UI exposes these behaviors through assistant-ui,
   * but the new /api/chats persistence contract does not yet prove them.
   *
   * Convert each TODO into a failing contract test before implementing the
   * corresponding backend capability, then remove the TODO only after CI
   * proves the durable behavior end to end.
   */

  it.todo(
    'reload/regenerate reuses the persisted user turn instead of appending a duplicate user message',
  );

  it.todo(
    'duplicate clientMessageId retries are idempotent and return the same persisted user message',
  );

  it.todo(
    'each generation has a stable runId and repeated delivery cannot create duplicate assistant completion rows',
  );

  it.todo(
    'cancelling a running assistant-ui generation persists a cancelled/incomplete run status',
  );

  it.todo(
    'provider failure persists an error/incomplete run status without marking an assistant message complete',
  );

  it.todo(
    'editing a historical user message records a durable parent/branch relationship instead of rewriting linear history ambiguously',
  );

  it.todo(
    'history load returns the active branch in assistant-ui ThreadHistoryAdapter-compatible order',
  );

  it.todo(
    'history update behaves as an upsert by stable message id for assistant-ui ThreadHistoryAdapter.update',
  );

  it.todo(
    'history delete removes the intended durable branch/message without corrupting sibling branches',
  );

  it.todo(
    'interrupted runs can be resumed or are explicitly reported as non-resumable through a stable capability contract',
  );

  it.todo(
    'thread listing supports cursor pagination without duplicate or missing chats across pages',
  );

  it.todo(
    'real Supabase RLS prevents authenticated user A from reading or mutating user B chats/messages/profile',
  );

  it.todo(
    'real Supabase RLS isolates two Supabase anonymous users by auth.uid()',
  );

  it.todo(
    'anonymous Supabase identity upgrade preserves owned chats without legacy x-client-id claiming',
  );
});
