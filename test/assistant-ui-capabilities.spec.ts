import { CHAT_V2_CAPABILITIES } from '../src/modules/chat/chat.capabilities';

describe('assistant-ui durable backend capability contract', () => {
  it('publishes the same capability matrix as Chat/Portal CHAT_V2_CAPABILITIES', () => {
    expect(CHAT_V2_CAPABILITIES).toEqual({
      durableSend: true,
      durableRetry: true,
      durableReload: true,
      durableEditBranch: true,
      durableCancel: true,
      cursorPagination: true,
      historyUpdate: false,
      historyDelete: false,
      resume: false,
    });
  });

  it('keeps history upsert/delete and resume explicitly disabled', () => {
    expect(CHAT_V2_CAPABILITIES.historyUpdate).toBe(false);
    expect(CHAT_V2_CAPABILITIES.historyDelete).toBe(false);
    expect(CHAT_V2_CAPABILITIES.resume).toBe(false);
  });
});
