/**
 * Durable assistant-ui capability matrix.
 * Keep this aligned with Chat/Portal `CHAT_V2_CAPABILITIES`.
 * `false` flags are explicitly out of scope until a real adapter lands.
 */
export type ChatV2Capabilities = {
  durableSend: true;
  durableRetry: true;
  durableReload: true;
  durableEditBranch: true;
  durableCancel: true;
  cursorPagination: true;
  historyUpdate: false;
  historyDelete: false;
  resume: false;
};

export const CHAT_V2_CAPABILITIES: ChatV2Capabilities = {
  durableSend: true,
  durableRetry: true,
  durableReload: true,
  durableEditBranch: true,
  durableCancel: true,
  cursorPagination: true,
  historyUpdate: false,
  historyDelete: false,
  resume: false,
};
