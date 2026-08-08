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
  parentMessageId: string | null,
  text: string,
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

async function collect<T>(iterable: AsyncIterable<T>) {
  const events: T[] = [];
  try {
    for await (const event of iterable) events.push(event);
    return { events } as { events: T[]; error?: unknown };
  } catch (error) {
    return { events, error };
  }
}

function successfulProvider() {
  return (async function* () {
    yield { type: 'delta', content: 'answer' };
    yield { type: 'done' };
  })();
}

describe('ChatService authoritative vs auxiliary side effects', () => {
  it('continues after initial chat touch failure once user message and run are durable', async () => {
    const repository = {
      get: jest.fn().mockResolvedValue({
        id: 'chat-1',
        title: 'Existing',
        page_path: null,
        module_key: null,
      }),
      listRecentMessages: jest.fn().mockResolvedValue([]),
      findMessageByClientId: jest.fn().mockResolvedValue(null),
      findMessageByReference: jest.fn().mockResolvedValue(null),
      createMessage: jest
        .fn()
        .mockResolvedValueOnce(message('user-message', 'user', null, 'hello'))
        .mockResolvedValueOnce(
          message('assistant-message', 'assistant', 'user-message', 'answer'),
        ),
      createRun: jest.fn().mockResolvedValue({ run: runningRun(), created: true }),
      updateRun: jest.fn().mockResolvedValue({}),
      touch: jest
        .fn()
        .mockRejectedValueOnce(new Error('touch user failed'))
        .mockResolvedValueOnce(undefined),
      update: jest.fn(),
    };
    const service = new ChatService(
      repository as never,
      {
        enforceRateLimit: jest.fn().mockResolvedValue(undefined),
        stream: jest.fn(() => successfulProvider()),
      } as never,
      { logFromRequest: jest.fn().mockResolvedValue(undefined) } as never,
    );

    const result = await collect(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(result.error).toBeUndefined();
    expect(result.events.map((event: any) => event.type)).toEqual([
      'user-persisted',
      'delta',
      'persisted',
      'done',
    ]);
    expect(repository.updateRun).toHaveBeenCalledWith(
      request,
      runId,
      expect.objectContaining({
        status: 'complete',
        assistantMessageId: 'assistant-message',
      }),
    );
  });

  it('keeps completed answer successful when post-terminal touch, auto-title and telemetry all fail', async () => {
    const order: string[] = [];
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
      createMessage: jest.fn(async (_request: unknown, input: any) => {
        if (input.role === 'user') {
          order.push('user-persisted');
          return message('user-message', 'user', null, 'hello');
        }
        order.push('assistant-persisted');
        return message('assistant-message', 'assistant', 'user-message', 'answer');
      }),
      createRun: jest.fn().mockResolvedValue({ run: runningRun(), created: true }),
      updateRun: jest.fn(async (_request: unknown, _id: string, patch: any) => {
        if (patch.status === 'complete') order.push('run-complete');
        return {};
      }),
      touch: jest.fn(async () => {
        const call = repository.touch.mock.calls.length;
        if (call > 1) {
          order.push('post-complete-touch-failed');
          throw new Error('touch assistant failed');
        }
      }),
      update: jest.fn(async () => {
        order.push('title-failed');
        throw new Error('title failed');
      }),
    };
    const logs = {
      logFromRequest: jest.fn(async () => {
        order.push('telemetry-failed');
        throw new Error('telemetry failed');
      }),
    };
    const service = new ChatService(
      repository as never,
      {
        enforceRateLimit: jest.fn().mockResolvedValue(undefined),
        stream: jest.fn(() => successfulProvider()),
      } as never,
      logs as never,
    );

    const result = await collect(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(result.error).toBeUndefined();
    expect(result.events.map((event: any) => event.type)).toEqual([
      'user-persisted',
      'delta',
      'persisted',
      'done',
    ]);
    expect(order.indexOf('run-complete')).toBeGreaterThan(
      order.indexOf('assistant-persisted'),
    );
    expect(order.indexOf('post-complete-touch-failed')).toBeGreaterThan(
      order.indexOf('run-complete'),
    );
    expect(order.indexOf('title-failed')).toBeGreaterThan(
      order.indexOf('run-complete'),
    );
    expect(order.indexOf('telemetry-failed')).toBeGreaterThan(
      order.indexOf('run-complete'),
    );
  });
});
