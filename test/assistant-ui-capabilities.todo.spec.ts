describe('assistant-ui durable backend capability backlog', () => {
  /**
   * These are deliberately executable TODOs, not skipped happy-path tests.
   * Implemented capabilities are removed only after a real contract test is
   * green. Remaining entries are still not claimed by coverage percentages.
   */

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
