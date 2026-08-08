import { UnauthorizedException } from '@nestjs/common';
import { ChatService } from '../src/modules/chat/chat.service';
import { AuthPrincipal } from '../src/modules/auth/roles';
import type { ChatMessageRecord, ChatRunRecord } from '../src/modules/chat/chat.types';

const principal: AuthPrincipal = {
  userId: 'user-1',
  email: 'u@example.com',
  name: 'User',
  role: 'viewer',
  tier: 'user',
  source: 'supabase',
};
const request = { header: () => 'Bearer token' } as never;
const runId = '11111111-1111-4111-8111-111111111111';

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iterable) result.push(item);
  return result;
}

async function collectResult<T>(iterable: AsyncIterable<T>) {
  const events: T[] = [];
  try {
    for await (const event of iterable) events.push(event);
    return { events } as { events: T[]; error?: unknown };
  } catch (error) {
    return { events, error };
  }
}

function message(
  id: string,
  role: 'user' | 'assistant',
  parentMessageId: string | null,
  parts: ChatMessageRecord['parts'],
): ChatMessageRecord {
  return {
    id,
    chat_id: 'chat-1',
    user_id: 'user-1',
    client_message_id: null,
    parent_message_id: parentMessageId,
    role,
    parts,
    metadata: {},
    created_at: '2026-08-08T00:00:00.000Z',
  };
}

function runningRun(userMessageId: string): ChatRunRecord {
  return {
    id: runId,
    chat_id: 'chat-1',
    user_id: 'user-1',
    user_message_id: userMessageId,
    assistant_message_id: null,
    status: 'running',
    error_message: null,
    metadata: {},
    started_at: '2026-08-08T00:00:00.000Z',
    completed_at: null,
    updated_at: '2026-08-08T00:00:00.000Z',
  };
}

describe('ChatService', () => {
  it('rejects non-Supabase principals on new chat creation', () => {
    const service = new ChatService({} as never, {} as never, {} as never);
    expect(() => service.create(request, { ...principal, source: 'local' }, {})).toThrow(
      UnauthorizedException,
    );
  });

  it('streams model output from bounded recent history and emits done only after durable run completion', async () => {
    const previousUser = message(
      'prev-user',
      'user',
      null,
      [{ type: 'text', text: 'previous question' }],
    );
    const previousAssistant = message(
      'prev-assistant',
      'assistant',
      'prev-user',
      [
        { type: 'reasoning', text: 'hidden' },
        { type: 'text', text: 'previous answer' },
      ],
    );
    const createMessage = jest.fn(async (_request: unknown, input: any) =>
      input.role === 'user'
        ? message('msg-user', 'user', input.parentMessageId ?? null, input.parts)
        : {
            ...message('msg-assistant', 'assistant', input.parentMessageId ?? null, input.parts),
            metadata: input.metadata,
          },
    );
    const update = jest.fn().mockResolvedValue({});
    const updateRun = jest.fn().mockResolvedValue({});
    const listRecentMessages = jest
      .fn()
      .mockResolvedValue([previousUser, previousAssistant]);
    const repository = {
      get: jest.fn().mockResolvedValue({
        id: 'chat-1',
        title: null,
        page_path: '/docs/a',
        module_key: 'docs',
      }),
      listRecentMessages,
      findMessageByClientId: jest.fn().mockResolvedValue(null),
      findMessageByReference: jest.fn().mockResolvedValue(null),
      createMessage,
      createRun: jest.fn().mockResolvedValue({
        run: runningRun('msg-user'),
        created: true,
      }),
      updateRun,
      touch: jest.fn().mockResolvedValue(undefined),
      update,
    };

    let receivedChatDto: unknown;
    async function* modelStream() {
      yield { type: 'meta', provider: 'openai', model: 'gpt-test' };
      yield { type: 'thinking', content: 'reason ' };
      yield { type: 'delta', content: 'hello ' };
      yield { type: 'delta', content: 'world' };
      yield { type: 'sources', sources: [{ title: 'Source', url: 'https://example.com' }] };
      yield { type: 'usage', promptTokens: 10, completionTokens: 4, totalTokens: 14 };
      yield { type: 'done' };
    }
    const ai = {
      enforceRateLimit: jest.fn().mockResolvedValue(principal),
      stream: jest.fn((dto: unknown) => {
        receivedChatDto = dto;
        return modelStream();
      }),
    };
    const logs = { logFromRequest: jest.fn().mockResolvedValue(undefined) };
    const service = new ChatService(repository as never, ai as never, logs as never);

    const events = await collect(
      service.streamMessage(
        'chat-1',
        { content: 'new question', enableThinking: true, enableWebSearch: true },
        request,
        principal,
      ),
    );

    expect(listRecentMessages).toHaveBeenCalledWith(request, 'chat-1', 500);
    expect(events.map((event: any) => event.type)).toEqual([
      'user-persisted',
      'meta',
      'thinking',
      'delta',
      'delta',
      'sources',
      'usage',
      'persisted',
      'done',
    ]);
    expect(createMessage).toHaveBeenNthCalledWith(1, request, {
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: 'new question' }],
      clientMessageId: undefined,
      parentMessageId: 'prev-assistant',
    });
    expect(createMessage).toHaveBeenNthCalledWith(
      2,
      request,
      expect.objectContaining({
        chatId: 'chat-1',
        userId: 'user-1',
        role: 'assistant',
        parentMessageId: 'msg-user',
        parts: [
          { type: 'reasoning', text: 'reason ' },
          { type: 'text', text: 'hello world' },
          { type: 'source', source: { title: 'Source', url: 'https://example.com' } },
        ],
        metadata: {
          provider: 'openai',
          model: 'gpt-test',
          usage: { promptTokens: 10, completionTokens: 4, totalTokens: 14 },
          runId,
        },
      }),
    );
    expect(updateRun).toHaveBeenCalledWith(
      request,
      runId,
      expect.objectContaining({ status: 'complete', assistantMessageId: 'msg-assistant' }),
    );
    expect(update).toHaveBeenCalledWith(request, 'chat-1', { title: 'new question' });
    expect(logs.logFromRequest).toHaveBeenCalledTimes(1);
    expect(receivedChatDto).toMatchObject({
      messages: [
        { role: 'user', content: 'previous question' },
        { role: 'assistant', content: 'previous answer' },
        { role: 'user', content: 'new question' },
      ],
      context: { pagePath: '/docs/a', moduleKey: 'docs' },
    });
  });

  it('treats empty provider output as an error run and never emits success', async () => {
    const createMessage = jest.fn().mockResolvedValue(
      message('msg-user', 'user', null, [{ type: 'text', text: 'hello' }]),
    );
    const updateRun = jest.fn().mockResolvedValue({});
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
      createMessage,
      createRun: jest.fn().mockResolvedValue({
        run: runningRun('msg-user'),
        created: true,
      }),
      updateRun,
      touch: jest.fn().mockResolvedValue(undefined),
      update: jest.fn(),
    };
    async function* modelStream() {
      yield { type: 'meta', provider: 'mock', model: 'mock' };
      yield { type: 'done' };
    }
    const service = new ChatService(
      repository as never,
      { enforceRateLimit: jest.fn(), stream: jest.fn(() => modelStream()) } as never,
      { logFromRequest: jest.fn() } as never,
    );

    const result = await collectResult(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );
    expect(result.events.map((event: any) => event.type)).toEqual([
      'user-persisted',
      'meta',
    ]);
    expect(result.error).toMatchObject({
      code: 'CHAT_EMPTY_RESPONSE',
      message: 'Model returned no usable content.',
    });
    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(updateRun).toHaveBeenLastCalledWith(
      request,
      runId,
      expect.objectContaining({
        status: 'error',
        errorMessage: 'Model returned no usable content.',
      }),
    );
    expect(repository.update).not.toHaveBeenCalled();
  });
});
