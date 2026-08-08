import { UnauthorizedException } from '@nestjs/common';
import { ChatService } from '../src/modules/chat/chat.service';
import { AuthPrincipal } from '../src/modules/auth/roles';

const principal: AuthPrincipal = {
  userId: 'user-1',
  email: 'u@example.com',
  name: 'User',
  role: 'viewer',
  tier: 'user',
  source: 'supabase',
};
const request = { header: () => 'Bearer token' } as never;

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const item of iterable) result.push(item);
  return result;
}

describe('ChatService', () => {
  it('rejects non-Supabase principals on new chat creation', () => {
    const service = new ChatService({} as never, {} as never, {} as never);
    expect(() => service.create(request, { ...principal, source: 'local' }, {})).toThrow(UnauthorizedException);
  });

  it('streams model output, persists both messages, then emits persisted before done', async () => {
    const createMessage = jest
      .fn()
      .mockResolvedValueOnce({ id: 'msg-user' })
      .mockResolvedValueOnce({ id: 'msg-assistant' });
    const update = jest.fn().mockResolvedValue({});
    const repository = {
      get: jest.fn().mockResolvedValue({
        id: 'chat-1',
        title: null,
        page_path: '/docs/a',
        module_key: 'docs',
      }),
      listMessages: jest.fn().mockResolvedValue([
        { role: 'user', parts: [{ type: 'text', text: 'previous question' }] },
        { role: 'assistant', parts: [{ type: 'reasoning', text: 'hidden' }, { type: 'text', text: 'previous answer' }] },
      ]),
      createMessage,
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
    });
    expect(createMessage).toHaveBeenNthCalledWith(
      2,
      request,
      expect.objectContaining({
        chatId: 'chat-1',
        userId: 'user-1',
        role: 'assistant',
        parts: [
          { type: 'reasoning', text: 'reason ' },
          { type: 'text', text: 'hello world' },
          { type: 'source', source: { title: 'Source', url: 'https://example.com' } },
        ],
        metadata: {
          provider: 'openai',
          model: 'gpt-test',
          usage: { promptTokens: 10, completionTokens: 4, totalTokens: 14 },
        },
      }),
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

  it('does not create an empty assistant message when the provider emits no content', async () => {
    const createMessage = jest.fn().mockResolvedValue({ id: 'msg-user' });
    const repository = {
      get: jest.fn().mockResolvedValue({ id: 'chat-1', title: 'Existing', page_path: null, module_key: null }),
      listMessages: jest.fn().mockResolvedValue([]),
      createMessage,
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

    const events = await collect(service.streamMessage('chat-1', { content: 'hello' }, request, principal));
    expect(events.map((event: any) => event.type)).toEqual(['user-persisted', 'meta', 'done']);
    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
