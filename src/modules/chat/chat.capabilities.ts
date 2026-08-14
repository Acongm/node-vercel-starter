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

/**
 * Durable Chat v2 capability matrix. Must stay aligned with
 * `Acongm/chat` `CHAT_V2_CAPABILITIES`. Unsupported adapters are
 * explicitly false so consumers cannot treat LocalRuntime behavior as
 * a server guarantee.
 */
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
