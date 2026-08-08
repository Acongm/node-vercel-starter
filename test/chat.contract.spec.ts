import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthPrincipal } from '../src/modules/auth/roles';
import { ChatService } from '../src/modules/chat/chat.service';
import type {
  ChatMessageRecord,
  ChatRunRecord,
} from '../src/modules/chat/chat.types';

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

function message(
  overrides: Partial<ChatMessageRecord> & Pick<ChatMessageRecord, 'id' | 'role'>,
): ChatMessageRecord {
  return {
    id: overrides.id,
    chat_id: overrides.chat_id ?? 'chat-1',
    user_id: overrides.user_id ?? 'user-1',
    client_message_id: overrides.client_message_id ?? null,
    parent_message_id: overrides.parent_message_id ?? null,
    role: overrides.role,
    parts:
      overrides.parts ??
      [{ type: 'text', text: overrides.role === 'user' ? 'hello' : 'answer' }],
    metadata: overrides.metadata ?? {},
    created_at: overrides.created_at ?? '2026-08-08T00:00:00.000Z',
  };
}

function run(
  overrides: Partial<ChatRunRecord> = {},
): ChatRunRecord {
  return {
    id: overrides.id ?? '11111111-1111-4111-8111-111111111111',
    chat_id: overrides.chat_id ?? 'chat-1',
    user_id: overrides.user_id ?? 'user-1',
    user_message_id: overrides.user_message_id ?? 'user-message',
    assistant_message_id: overrides.assistant_message_id ?? null,
    status: overrides.status ?? 'running',
    error_message: overrides.error_message ?? null,
    metadata: overrides.metadata ?? {},
    started_at: overrides.started_at ?? '2026-08-08T00:00:00.000Z',
    completed_at: overrides.completed_at ?? null,
    updated_at: overrides.updated_at ?? '2026-08-08T00:00:00.000Z',
  };
}

function baseRepository(overrides: Record<string, unknown> = {}) {
  let assistantCounter = 0;
  const createMessage = jest.fn(async (_request: unknown, input: any) => {
    const id =
      input.role === 'user'
        ? 'user-message'
        : `assistant-message-${++assistantCounter}`;
    return message({
      id,
      role: input.role,
      parts: input.parts,
      metadata: input.metadata,
      client_message_id: input.clientMessageId ?? null,
      parent_message_id: input.parentMessageId ?? null,
    });
  });

  const createRun = jest.fn(async (_request: unknown, input: any) => ({
    run: run({
      id: input.id,
      chat_id: input.chatId,
      user_id: input.userId,
      user_message_id: input.userMessageId,
      metadata: input.metadata,
    }),
    created: true,
  }));

  return {
    get: jest.fn().mockResolvedValue({
      id: 'chat-1',
      title: 'Existing chat',
      page_path: null,
      module_key: null,
    }),
    listMessages: jest.fn().mockResolvedValue([]),
    findMessageByClientId: jest.fn().mockResolvedValue(null),
    findMessageByReference: jest.fn().mockResolvedValue(null),
    createMessage,
    createRun,
    updateRun: jest.fn(async (_request: unknown, id: string, patch: any) =>
      run({
        id,
        status: patch.status,
        assistant_message_id: patch.assistantMessageId ?? null,
        error_message: patch.errorMessage ?? null,
        metadata: patch.metadata ?? {},
        completed_at: patch.completedAt ?? null,
      }),
    ),
    touch: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function serviceWith(repository: Record<string, unknown>, stream: () => AsyncIterable<any>) {
  return new ChatService(
    repository as never,
    {
      enforceRateLimit: jest.fn().mockResolvedValue(undefined),
      stream: jest.fn(() => stream()),
    } as never,
    { logFromRequest: jest.fn() } as never,
  );
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
    expect(repository.createRun).not.toHaveBeenCalled();
    expect(ai.stream).not.toHaveBeenCalled();
  });

  it('fails missing/inaccessible chat before persisting the user message or run', async () => {
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
    expect(repository.createRun).not.toHaveBeenCalled();
  });

  it('persists provider failure as an error run without fabricating an assistant row', async () => {
    const repository = baseRepository();
    async function* providerStream() {
      yield { type: 'meta', provider: 'test', model: 'test-model' };
      throw new Error('provider unavailable');
    }
    const service = serviceWith(repository, providerStream);

    const result = await collectResult(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(result.events.map((event: any) => event.type)).toEqual([
      'user-persisted',
      'meta',
    ]);
    expect(result.error).toEqual(new Error('provider unavailable'));
    expect(repository.createMessage).toHaveBeenCalledTimes(1);
    expect(repository.updateRun).toHaveBeenCalledWith(
      request,
      expect.any(String),
      expect.objectContaining({
        status: 'error',
        errorMessage: 'provider unavailable',
      }),
    );
  });

  it('does not emit persisted or done if assistant persistence fails and marks the run error', async () => {
    const createMessage = jest
      .fn()
      .mockResolvedValueOnce(
        message({ id: 'user-message', role: 'user', parts: [{ type: 'text', text: 'hello' }] }),
      )
      .mockRejectedValueOnce(new Error('assistant write failed'));
    const repository = baseRepository({ createMessage });
    async function* providerStream() {
      yield { type: 'delta', content: 'answer' };
      yield { type: 'done' };
    }
    const service = serviceWith(repository, providerStream);

    const result = await collectResult(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(result.events.map((event: any) => event.type)).toEqual([
      'user-persisted',
      'delta',
    ]);
    expect(result.error).toEqual(new Error('assistant write failed'));
    expect(repository.updateRun).toHaveBeenLastCalledWith(
      request,
      expect.any(String),
      expect.objectContaining({ status: 'error' }),
    );
  });

  it('treats telemetry as best-effort after assistant and run completion are durable', async () => {
    const repository = baseRepository();
    async function* providerStream() {
      yield { type: 'delta', content: 'answer' };
      yield { type: 'done' };
    }
    const logs = {
      logFromRequest: jest.fn().mockRejectedValue(new Error('telemetry down')),
    };
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

    expect(result.error).toBeUndefined();
    expect(result.events.map((event: any) => event.type)).toEqual([
      'user-persisted',
      'delta',
      'persisted',
      'done',
    ]);
    expect(repository.updateRun).toHaveBeenCalledWith(
      request,
      expect.any(String),
      expect.objectContaining({
        status: 'complete',
        assistantMessageId: 'assistant-message-1',
      }),
    );
    expect(logs.logFromRequest).toHaveBeenCalledTimes(1);
  });

  it('persists cancellation when AbortSignal interrupts a provider run', async () => {
    const repository = baseRepository();
    const controller = new AbortController();
    async function* providerStream() {
      yield { type: 'meta', provider: 'test', model: 'model' };
      controller.abort();
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }
    const service = serviceWith(repository, providerStream);

    const result = await collectResult(
      service.streamMessage(
        'chat-1',
        { content: 'hello' },
        request,
        principal,
        controller.signal,
      ),
    );

    expect(result.error).toBeUndefined();
    expect(result.events.map((event: any) => event.type)).toEqual([
      'user-persisted',
      'meta',
    ]);
    expect(repository.updateRun).toHaveBeenCalledWith(
      request,
      expect.any(String),
      expect.objectContaining({ status: 'cancelled' }),
    );
  });

  it('treats a provider stream ending without done as an error run', async () => {
    const repository = baseRepository();
    async function* providerStream() {
      yield { type: 'delta', content: 'partial' };
    }
    const service = serviceWith(repository, providerStream);

    const result = await collectResult(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(result.error).toEqual(new Error('Model stream ended without a done event.'));
    expect(repository.updateRun).toHaveBeenLastCalledWith(
      request,
      expect.any(String),
      expect.objectContaining({ status: 'error' }),
    );
  });

  it('reuses a stable clientMessageId on retry instead of appending a duplicate user message', async () => {
    const existingUser = message({
      id: 'user-message',
      role: 'user',
      client_message_id: 'ui-user-1',
      parts: [{ type: 'text', text: 'hello' }],
    });
    const repository = baseRepository({
      listMessages: jest.fn().mockResolvedValue([existingUser]),
      findMessageByClientId: jest.fn().mockResolvedValue(existingUser),
    });
    async function* providerStream() {
      yield { type: 'done' };
    }
    const service = serviceWith(repository, providerStream);

    const result = await collectResult(
      service.streamMessage(
        'chat-1',
        { content: 'hello', clientMessageId: 'ui-user-1' },
        request,
        principal,
      ),
    );

    expect(result.error).toBeUndefined();
    expect((result.events[0] as any).reused).toBe(true);
    expect(repository.createMessage).not.toHaveBeenCalledWith(
      request,
      expect.objectContaining({ role: 'user' }),
    );
  });

  it('reload/regenerate reuses the user turn and excludes the previous assistant branch from model context', async () => {
    const rootUser = message({
      id: 'user-message',
      role: 'user',
      client_message_id: 'ui-user-1',
      parts: [{ type: 'text', text: 'question' }],
    });
    const oldAssistant = message({
      id: 'old-assistant',
      role: 'assistant',
      client_message_id: 'ui-assistant-old',
      parent_message_id: rootUser.id,
      parts: [{ type: 'text', text: 'old answer' }],
    });
    const repository = baseRepository({
      listMessages: jest.fn().mockResolvedValue([rootUser, oldAssistant]),
      findMessageByClientId: jest.fn().mockResolvedValue(rootUser),
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
      service.streamMessage(
        'chat-1',
        {
          content: 'question',
          clientMessageId: 'ui-user-1',
          runId: '22222222-2222-4222-8222-222222222222',
          assistantMessageId: 'ui-assistant-new',
        },
        request,
        principal,
      ),
    );

    expect(receivedDto.messages).toEqual([{ role: 'user', content: 'question' }]);
    expect(receivedDto.messages).not.toContainEqual({
      role: 'assistant',
      content: 'old answer',
    });
  });

  it('replays a completed run without invoking the provider or creating another assistant completion', async () => {
    const existingUser = message({
      id: 'user-message',
      role: 'user',
      client_message_id: 'ui-user-1',
      parts: [{ type: 'text', text: 'hello' }],
    });
    const existingAssistant = message({
      id: 'assistant-message',
      role: 'assistant',
      client_message_id: 'ui-assistant-1',
      parent_message_id: existingUser.id,
      parts: [
        { type: 'reasoning', text: 'think' },
        { type: 'text', text: 'answer' },
      ],
    });
    const existingRun = run({
      status: 'complete',
      user_message_id: existingUser.id,
      assistant_message_id: existingAssistant.id,
      completed_at: '2026-08-08T00:01:00.000Z',
    });
    const repository = baseRepository({
      listMessages: jest.fn().mockResolvedValue([existingUser, existingAssistant]),
      findMessageByClientId: jest.fn().mockResolvedValue(existingUser),
      findMessageByReference: jest.fn().mockResolvedValue(existingAssistant),
      createRun: jest.fn().mockResolvedValue({ run: existingRun, created: false }),
    });
    const ai = {
      enforceRateLimit: jest.fn().mockResolvedValue(undefined),
      stream: jest.fn(),
    };
    const service = new ChatService(
      repository as never,
      ai as never,
      { logFromRequest: jest.fn() } as never,
    );

    const result = await collectResult(
      service.streamMessage(
        'chat-1',
        {
          content: 'hello',
          clientMessageId: 'ui-user-1',
          runId: existingRun.id,
        },
        request,
        principal,
      ),
    );

    expect(result.error).toBeUndefined();
    expect(result.events.map((event: any) => event.type)).toEqual([
      'user-persisted',
      'thinking',
      'delta',
      'persisted',
      'done',
    ]);
    expect((result.events.at(-1) as any).replayed).toBe(true);
    expect(ai.stream).not.toHaveBeenCalled();
    expect(repository.createMessage).not.toHaveBeenCalled();
  });

  it('rejects concurrent duplicate delivery for a runId that is still running', async () => {
    const existingUser = message({
      id: 'user-message',
      role: 'user',
      client_message_id: 'ui-user-1',
      parts: [{ type: 'text', text: 'hello' }],
    });
    const existingRun = run({ status: 'running', user_message_id: existingUser.id });
    const repository = baseRepository({
      listMessages: jest.fn().mockResolvedValue([existingUser]),
      findMessageByClientId: jest.fn().mockResolvedValue(existingUser),
      createRun: jest.fn().mockResolvedValue({ run: existingRun, created: false }),
    });
    const ai = {
      enforceRateLimit: jest.fn().mockResolvedValue(undefined),
      stream: jest.fn(),
    };
    const service = new ChatService(
      repository as never,
      ai as never,
      { logFromRequest: jest.fn() } as never,
    );

    const result = await collectResult(
      service.streamMessage(
        'chat-1',
        {
          content: 'hello',
          clientMessageId: 'ui-user-1',
          runId: existingRun.id,
        },
        request,
        principal,
      ),
    );

    expect(result.error).toBeInstanceOf(ConflictException);
    expect(ai.stream).not.toHaveBeenCalled();
  });

  it('rejects reuse of clientMessageId with different content', async () => {
    const existingUser = message({
      id: 'user-message',
      role: 'user',
      client_message_id: 'ui-user-1',
      parts: [{ type: 'text', text: 'original' }],
    });
    const repository = baseRepository({
      findMessageByClientId: jest.fn().mockResolvedValue(existingUser),
    });
    const service = serviceWith(repository, async function* () {
      yield { type: 'done' };
    });

    const result = await collectResult(
      service.streamMessage(
        'chat-1',
        { content: 'changed', clientMessageId: 'ui-user-1' },
        request,
        principal,
      ),
    );

    expect(result.error).toBeInstanceOf(ConflictException);
    expect(repository.createRun).not.toHaveBeenCalled();
  });

  it('persists edited user turns as a new branch child of the selected historical parent', async () => {
    const parent = message({ id: 'assistant-parent', role: 'assistant' });
    const repository = baseRepository({
      listMessages: jest.fn().mockResolvedValue([parent]),
      findMessageByReference: jest.fn().mockResolvedValue(parent),
    });
    const service = serviceWith(repository, async function* () {
      yield { type: 'done' };
    });

    await collectResult(
      service.streamMessage(
        'chat-1',
        {
          content: 'edited question',
          clientMessageId: 'ui-edited-user',
          parentMessageId: 'ui-parent-reference',
        },
        request,
        principal,
      ),
    );

    expect(repository.createMessage).toHaveBeenCalledWith(
      request,
      expect.objectContaining({
        role: 'user',
        clientMessageId: 'ui-edited-user',
        parentMessageId: parent.id,
      }),
    );
  });

  it('limits model context to the latest 100 messages on the selected branch including the current user', async () => {
    const priorMessages = Array.from({ length: 120 }, (_, index) =>
      message({
        id: `message-${index}`,
        role: index % 2 === 0 ? 'user' : 'assistant',
        parent_message_id: index === 0 ? null : `message-${index - 1}`,
        parts: [{ type: 'text', text: `prior-${index}` }],
        created_at: `2026-08-08T00:${String(index).padStart(2, '0')}:00.000Z`,
      }),
    );
    const current = message({
      id: 'user-message',
      role: 'user',
      parent_message_id: 'message-119',
      parts: [{ type: 'text', text: 'current' }],
    });
    const repository = baseRepository({
      listMessages: jest.fn().mockResolvedValue(priorMessages),
      createMessage: jest.fn().mockResolvedValue(current),
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
    const service = new ChatService(repository as never, {} as never, {} as never);

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
