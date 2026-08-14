import { CHAT_V2_CAPABILITIES } from '../src/modules/chat/chat.capabilities';

describe('assistant-ui durable backend capability backlog', () => {
  /**
   * Production-visible capabilities are locked by
   * `test/chat.capabilities.contract.spec.ts`. Remaining entries are
   * authorization-gated production proofs, not UI-visible Stage 6 features.
   */

  it('does not leave history update/delete or resume as unimplemented UI todos', () => {
    expect(CHAT_V2_CAPABILITIES.historyUpdate).toBe(false);
    expect(CHAT_V2_CAPABILITIES.historyDelete).toBe(false);
    expect(CHAT_V2_CAPABILITIES.resume).toBe(false);
  });

  it.todo(
    'live Supabase RLS prevents authenticated user A from reading or mutating user B chats/messages/profile on the production Data API',
  );

  it.todo(
    'live Supabase RLS isolates two production anonymous users by auth.uid() after Anonymous Auth is enabled',
  );

  it.todo(
    'anonymous Supabase identity upgrade preserves owned chats without legacy x-client-id claiming after Manual Linking is enabled',
  );
});
