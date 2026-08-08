import { UnauthorizedException } from '@nestjs/common';
import { AuthPrincipal } from '../src/modules/auth/roles';
import { ChatService } from '../src/modules/chat/chat.service';

const principal: AuthPrincipal = {
  userId: 'user-1',
  email: 'u@example.com',
  name: 'User',
  role: 'viewer',
  tier: 'user',
  source: 'supabase',
};

const request = { header: () => 'Bearer token' } as never;

async function collectResult<T>(iterable: AsyncIterable<T>): Promise<{
  events: T[];
  error?: unknown;
}> {
  const events: T[] = [];
  try {
    for await (const event of iterable) events.push(event);
    return { events };
  } catch (error) {
    return { events, error };
  }
}

function baseRepository(overrides: Record<string, unknown> = {}) {
  return {
    get: jest.fn().mockResolvedValue({
      id: 'chat-1',
      title: 'Existing chat',
      page_path: null,
      module_key: null,
    }),
    listMessages: jest.fn().mockResolvedValue([]),
    createMessage: jest.fn().mockResolvedValue({ id: 'message-1' }),
    touch: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

describe('ChatService UI contract', () => {
  it('fails rate limiting before reading or writing chat state', async () => {
    const repository = baseRepository();
    const ai = {
      enforceRateLimit: jest.fn().mockRejectedValue(new Error('rate limited')),
      stream: jest.fn(),
    };
    const service = new ChatService(
      repository as never,
      ai as never,
      { logFromRequest: jest.fn() } as never,
    );

    const result = await collectResult(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(result.error).toEqual(new Error('rate limited'));
    expect(repository.get).not.toHaveBeenCalled();
    expect(repository.createMessage).not.toHaveBeenCalled();
    expect(ai.stream).not.toHaveBeenCalled();
  });

  it('fails missing/inaccessible chat before persisting the user message', async () => {
    const repository = baseRepository({
      get: jest.fn().mockRejectedValue(new Error('Chat not found.')),
    });
    const service = new ChatService(
      repository as never,
      {
        enforceRateLimit: jest.fn().mockResolvedValue(undefined),
        stream: jest.fn(),
      } as never,
      { logFromRequest: jest.fn() } as never,
    );

    const result = await collectResult(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(result.error).toEqual(new Error('Chat not found.'));
    expect(repository.createMessage).not.toHaveBeenCalled();
  });

  it('keeps a persisted user turn but never fabricates an assistant row after provider failure', async () => {
    const createMessage = jest.fn().mockResolvedValue({ id: 'user-message' });
    const repository = baseRepository({ createMessage });
    async function* providerStream() {
      yield { type: 'meta', provider: 'test', model: 'test-model' };
      throw new Error('provider unavailable');
    }
    const logs = { logFromRequest: jest.fn() };
    const service = new ChatService(
      repository as never,
      {
        enforceRateLimit: jest.fn().mockResolvedValue(undefined),
        stream: jest.fn(() => providerStream()),
      } as never,
      logs as never,
    );

    const result = await collectResult(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(result.events.map((event: any) => event.type)).toEqual([
      'user-persisted',
      'meta',
    ]);
    expect(result.error).toEqual(new Error('provider unavailable'));
    expect(createMessage).toHaveBeenCalledTimes(1);
    expect(logs.logFromRequest).not.toHaveBeenCalled();
  });

  it('does not emit persisted or done if assistant persistence fails', async () => {
    const createMessage = jest
      .fn()
      .mockResolvedValueOnce({ id: 'user-message' })
      .mockRejectedValueOnce(new Error('assistant write failed'));
    const repository = baseRepository({ createMessage });
    async function* providerStream() {
      yield { type: 'delta', content: 'answer' };
      yield { type: 'done' };
    }
    const service = new ChatService(
      repository as never,
      {
        enforceRateLimit: jest.fn().mockResolvedValue(undefined),
        stream: jest.fn(() => providerStream()),
      } as never,
      { logFromRequest: jest.fn() } as never,
    );

    const result = await collectResult(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(result.events.map((event: any) => event.type)).toEqual([
      'user-persisted',
      'delta',
    ]);
    expect(result.error).toEqual(new Error('assistant write failed'));
  });

  it('treats telemetry as best-effort after the assistant message is durably persisted', async () => {
    const createMessage = jest
      .fn()
      .mockResolvedValueOnce({ id: 'user-message' })
      .mockResolvedValueOnce({ id: 'assistant-message' });
    const repository = baseRepository({ createMessage });
    async function* providerStream() {
      yield { type: 'delta', content: 'answer' };
      yield { type: 'done' };
    }
    const service = new ChatService(
      repository as never,
      {
        enforceRateLimit: jest.fn().mockResolvedValue(undefined),
        stream: jest.fn(() => providerStream()),
      } as never,
      {
        logFromRequest: jest.fn().mockRejectedValue(new Error('telemetry down')),
      } as never,
    );

    const result = await collectResult(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(result.error).toBeUndefined();
    expect(result.events.map((event: any) => event.type)).toEqual([
      'user-persisted',
      'delta',
      'persisted',
      'done',
    ]);
  });

  it('passes the caller AbortSignal to the model provider', async () => {
    const repository = baseRepository();
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    async function* providerStream() {
      yield { type: 'done' };
    }
    const service = new ChatService(
      repository as never,
      {
        enforceRateLimit: jest.fn().mockResolvedValue(undefined),
        stream: jest.fn((_dto: unknown, options: { signal?: AbortSignal }) => {
          receivedSignal = options.signal;
          return providerStream();
        }),
      } as never,
      { logFromRequest: jest.fn() } as never,
    );

    await collectResult(
      service.streamMessage(
        'chat-1',
        { content: 'hello' },
        request,
        principal,
        controller.signal,
      ),
    );

    expect(receivedSignal).toBe(controller.signal);
  });

  it('limits model context to the latest 99 persisted user/assistant messages plus the current user turn', async () => {
    const priorMessages = Array.from({ length: 120 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      parts: [{ type: 'text', text: `prior-${index}` }],
    }));
    const repository = baseRepository({
      listMessages: jest.fn().mockResolvedValue(priorMessages),
    });
    let receivedDto: any;
    async function* providerStream() {
      yield { type: 'done' };
    }
    const service = new ChatService(
      repository as never,
      {
        enforceRateLimit: jest.fn().mockResolvedValue(undefined),
        stream: jest.fn((dto: unknown) => {
          receivedDto = dto;
          return providerStream();
        }),
      } as never,
      { logFromRequest: jest.fn() } as never,
    );

    await collectResult(
      service.streamMessage('chat-1', { content: 'current' }, request, principal),
    );

    expect(receivedDto.messages).toHaveLength(100);
    expect(receivedDto.messages[0]).toEqual({
      role: 'assistant',
      content: 'prior-21',
    });
    expect(receivedDto.messages.at(-1)).toEqual({
      role: 'user',
      content: 'current',
    });
  });

  it('rejects legacy principals for streaming, not only chat creation', async () => {
    const repository = baseRepository();
    const service = new ChatService(
      repository as never,
      {} as never,
      {} as never,
    );

    const result = await collectResult(
      service.streamMessage(
        'chat-1',
        { content: 'hello' },
        request,
        { ...principal, source: 'local' },
      ),
    );

    expect(result.error).toBeInstanceOf(UnauthorizedException);
    expect(repository.get).not.toHaveBeenCalled();
  });
});
