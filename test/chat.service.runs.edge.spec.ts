import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AuthPrincipal } from '../src/modules/auth/roles';
import { ChatService } from '../src/modules/chat/chat.service';
import type {
  ChatMessageRecord,
  ChatRunRecord,
} from '../src/modules/chat/chat.types';

const principal: AuthPrincipal = {
  userId: 'user-1',
  role: 'viewer',
  tier: 'user',
  source: 'supabase',
};
const request = { header: () => 'Bearer token' } as never;
const runId = '11111111-1111-4111-8111-111111111111';

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

function run(overrides: Partial<ChatRunRecord> = {}): ChatRunRecord {
  return {
    id: overrides.id ?? runId,
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

async function collect<T>(iterable: AsyncIterable<T>) {
  const events: T[] = [];
  try {
    for await (const event of iterable) events.push(event);
    return { events } as { events: T[]; error?: unknown };
  } catch (error) {
    return { events, error };
  }
}

function repository(overrides: Record<string, unknown> = {}) {
  const user = message({
    id: 'user-message',
    role: 'user',
    client_message_id: 'ui-user-1',
    parts: [{ type: 'text', text: 'hello' }],
  });
  return {
    get: jest.fn().mockResolvedValue({
      id: 'chat-1',
      title: 'Existing',
      page_path: null,
      module_key: null,
    }),
    listRecentMessages: jest.fn().mockResolvedValue([]),
    findMessageByClientId: jest.fn().mockResolvedValue(null),
    findMessageByReference: jest.fn().mockResolvedValue(null),
    createMessage: jest.fn().mockResolvedValue(user),
    createRun: jest.fn().mockResolvedValue({
      run: run({ user_message_id: user.id }),
      created: true,
    }),
    updateRun: jest.fn().mockResolvedValue({}),
    touch: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function service(
  repo: Record<string, unknown>,
  provider: () => AsyncIterable<any>,
) {
  return new ChatService(
    repo as never,
    {
      enforceRateLimit: jest.fn().mockResolvedValue(undefined),
      stream: jest.fn(() => provider()),
    } as never,
    { logFromRequest: jest.fn().mockResolvedValue(undefined) } as never,
  );
}

describe('ChatService durable run edge contracts', () => {
  it('marks run cancelled when provider ends cleanly after signal becomes aborted', async () => {
    const repo = repository();
    const abort = new AbortController();
    async function* provider() {
      yield { type: 'meta', provider: 'test', model: 'test' };
      abort.abort();
    }

    const result = await collect(
      service(repo, provider).streamMessage(
        'chat-1',
        { content: 'hello' },
        request,
        principal,
        abort.signal,
      ),
    );

    expect(result.error).toBeUndefined();
    expect(repo.updateRun).toHaveBeenCalledWith(
      request,
      runId,
      expect.objectContaining({ status: 'cancelled' }),
    );
  });

  it('rejects explicit parent reference that is not visible in chat', async () => {
    const repo = repository({
      findMessageByReference: jest.fn().mockResolvedValue(null),
    });
    const result = await collect(
      service(repo, async function* () {
        yield { type: 'delta', content: 'answer' };
        yield { type: 'done' };
      }).streamMessage(
        'chat-1',
        { content: 'hello', parentMessageId: 'missing-parent' },
        request,
        principal,
      ),
    );

    expect(result.error).toBeInstanceOf(BadRequestException);
    expect(repo.createMessage).not.toHaveBeenCalled();
    expect(repo.createRun).not.toHaveBeenCalled();
  });

  it('rejects reuse of client message id with a different explicit parent', async () => {
    const stored = message({
      id: 'user-message',
      role: 'user',
      client_message_id: 'ui-user-1',
      parent_message_id: 'old-parent',
      parts: [{ type: 'text', text: 'hello' }],
    });
    const newParent = message({ id: 'new-parent', role: 'assistant' });
    const repo = repository({
      listRecentMessages: jest.fn().mockResolvedValue([stored]),
      findMessageByClientId: jest.fn().mockResolvedValue(stored),
      findMessageByReference: jest.fn().mockResolvedValue(newParent),
    });

    const result = await collect(
      service(repo, async function* () {
        yield { type: 'delta', content: 'answer' };
        yield { type: 'done' };
      }).streamMessage(
        'chat-1',
        {
          content: 'hello',
          clientMessageId: 'ui-user-1',
          parentMessageId: 'new-parent-client-id',
        },
        request,
        principal,
      ),
    );

    expect(result.error).toBeInstanceOf(ConflictException);
    expect(repo.createRun).not.toHaveBeenCalled();
  });

  it('rejects reuse of runId if run belongs to another user message', async () => {
    const repo = repository({
      createRun: jest.fn().mockResolvedValue({
        run: run({ user_message_id: 'different-message' }),
        created: false,
      }),
    });

    const result = await collect(
      service(repo, async function* () {
        yield { type: 'delta', content: 'answer' };
        yield { type: 'done' };
      }).streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(result.error).toBeInstanceOf(ConflictException);
  });

  it.each([
    ['cancelled', null],
    ['error', 'provider failed'],
  ] as const)(
    'rejects replay of terminal %s run and does not call provider',
    async (status, errorMessage) => {
      const stored = message({
        id: 'user-message',
        role: 'user',
        client_message_id: 'ui-user-1',
        parts: [{ type: 'text', text: 'hello' }],
      });
      const repo = repository({
        listRecentMessages: jest.fn().mockResolvedValue([stored]),
        findMessageByClientId: jest.fn().mockResolvedValue(stored),
        createRun: jest.fn().mockResolvedValue({
          run: run({
            status,
            user_message_id: stored.id,
            error_message: errorMessage,
          }),
          created: false,
        }),
      });
      const ai = {
        enforceRateLimit: jest.fn().mockResolvedValue(undefined),
        stream: jest.fn(),
      };
      const chat = new ChatService(
        repo as never,
        ai as never,
        { logFromRequest: jest.fn() } as never,
      );

      const result = await collect(
        chat.streamMessage(
          'chat-1',
          { content: 'hello', clientMessageId: 'ui-user-1', runId },
          request,
          principal,
        ),
      );

      expect(result.error).toBeInstanceOf(ConflictException);
      expect(ai.stream).not.toHaveBeenCalled();
    },
  );

  it('replays persisted sources and client assistant id for completed run', async () => {
    const storedUser = message({
      id: 'user-message',
      role: 'user',
      client_message_id: 'ui-user-1',
      parts: [{ type: 'text', text: 'hello' }],
    });
    const storedAssistant = message({
      id: 'assistant-message',
      role: 'assistant',
      client_message_id: 'ui-assistant-1',
      parent_message_id: storedUser.id,
      parts: [
        { type: 'source', source: { title: 'Doc', url: 'https://example.com' } },
      ],
    });
    const repo = repository({
      listRecentMessages: jest.fn().mockResolvedValue([storedUser, storedAssistant]),
      findMessageByClientId: jest.fn().mockResolvedValue(storedUser),
      findMessageByReference: jest.fn().mockResolvedValue(storedAssistant),
      createRun: jest.fn().mockResolvedValue({
        run: run({
          status: 'complete',
          user_message_id: storedUser.id,
          assistant_message_id: storedAssistant.id,
        }),
        created: false,
      }),
    });
    const result = await collect(
      service(repo, async function* () {
        throw new Error('provider should not run');
      }).streamMessage(
        'chat-1',
        { content: 'hello', clientMessageId: 'ui-user-1', runId },
        request,
        principal,
      ),
    );

    expect(result.error).toBeUndefined();
    expect(result.events.map((event: any) => event.type)).toEqual([
      'user-persisted',
      'sources',
      'persisted',
      'done',
    ]);
    expect(result.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'persisted',
          clientMessageId: 'ui-assistant-1',
          replayed: true,
        }),
      ]),
    );
  });

  it('preserves provider failure if persisting error status also fails', async () => {
    const repo = repository({
      updateRun: jest.fn().mockRejectedValue(new Error('status database down')),
    });
    const result = await collect(
      service(repo, async function* () {
        throw new Error('provider original error');
      }).streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(result.error).toEqual(new Error('provider original error'));
  });

  it('uses stable generic run error for non-Error provider failures', async () => {
    const repo = repository();
    const result = await collect(
      service(repo, async function* () {
        throw 'provider-string-error';
      }).streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(result.error).toBe('provider-string-error');
    expect(repo.updateRun).toHaveBeenCalledWith(
      request,
      runId,
      expect.objectContaining({
        status: 'error',
        errorMessage: 'Chat run failed.',
      }),
    );
  });
});
