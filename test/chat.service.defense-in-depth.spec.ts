import { AuthPrincipal } from '../src/modules/auth/roles';
import { ChatService } from '../src/modules/chat/chat.service';
import type { ChatMessageRecord, ChatRunRecord } from '../src/modules/chat/chat.types';

const principal: AuthPrincipal = {
  userId: 'user-1',
  role: 'viewer',
  tier: 'user',
  source: 'supabase',
};
const request = { header: () => 'Bearer token' } as never;
const runId = '11111111-1111-4111-8111-111111111111';

function message(
  id: string,
  role: 'user' | 'assistant',
  text: string,
  parentMessageId: string | null,
): ChatMessageRecord {
  return {
    id,
    chat_id: 'chat-1',
    user_id: 'user-1',
    client_message_id: null,
    parent_message_id: parentMessageId,
    role,
    parts: [{ type: 'text', text }],
    metadata: {},
    created_at: '2026-08-08T00:00:00.000Z',
  };
}

function runningRun(): ChatRunRecord {
  return {
    id: runId,
    chat_id: 'chat-1',
    user_id: 'user-1',
    user_message_id: 'user-message',
    assistant_message_id: null,
    status: 'running',
    error_message: null,
    metadata: {},
    started_at: '2026-08-08T00:00:00.000Z',
    completed_at: null,
    updated_at: '2026-08-08T00:00:00.000Z',
  };
}

describe('ChatService defense-in-depth guards', () => {
  it('skips auto-title when an internal caller bypasses DTO validation with whitespace-only content', async () => {
    const repository = {
      get: jest.fn().mockResolvedValue({
        id: 'chat-1',
        title: null,
        page_path: null,
        module_key: null,
      }),
      listRecentMessages: jest.fn().mockResolvedValue([]),
      findMessageByClientId: jest.fn().mockResolvedValue(null),
      findMessageByReference: jest.fn().mockResolvedValue(null),
      createMessage: jest
        .fn()
        .mockResolvedValueOnce(message('user-message', 'user', '   ', null))
        .mockResolvedValueOnce(
          message('assistant-message', 'assistant', 'answer', 'user-message'),
        ),
      createRun: jest.fn().mockResolvedValue({ run: runningRun(), created: true }),
      updateRun: jest.fn().mockResolvedValue({}),
      touch: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue({}),
    };
    async function* provider() {
      yield { type: 'delta', content: 'answer' };
      yield { type: 'done' };
    }
    const service = new ChatService(
      repository as never,
      {
        enforceRateLimit: jest.fn().mockResolvedValue(undefined),
        stream: jest.fn(() => provider()),
      } as never,
      { logFromRequest: jest.fn().mockResolvedValue(undefined) } as never,
    );

    const events = [];
    for await (const event of service.streamMessage(
      'chat-1',
      { content: '   ' },
      request,
      principal,
    )) {
      events.push(event);
    }

    expect(events.map((event: any) => event.type)).toEqual([
      'user-persisted',
      'delta',
      'persisted',
      'done',
    ]);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
