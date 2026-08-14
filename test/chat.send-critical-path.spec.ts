import { ChatService } from '../src/modules/chat/chat.service';
import { appLogger } from '../src/common/app-logger';
import { AuthPrincipal } from '../src/modules/auth/roles';
import type { ChatMessageRecord, ChatRunRecord } from '../src/modules/chat/chat.types';

const principal: AuthPrincipal = {
  userId: 'user-1',
  role: 'viewer',
  tier: 'user',
  source: 'supabase',
};
const request = {
  header: () => 'Bearer token',
  requestId: 'req-send-1',
} as never;
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

async function waitUntil(predicate: () => boolean, timeoutMs = 1000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error('Timed out waiting for send-path condition');
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
}

async function collect<T>(iterable: AsyncIterable<T>) {
  const events: T[] = [];
  for await (const event of iterable) events.push(event);
  return events;
}

function repository() {
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
    createMessage: jest
      .fn()
      .mockResolvedValueOnce(message('user-message', 'user', null, 'hello'))
      .mockResolvedValueOnce(
        message('assistant-message', 'assistant', 'user-message', 'answer'),
      ),
    createRun: jest.fn().mockResolvedValue({ run: runningRun(), created: true }),
    updateRun: jest.fn().mockResolvedValue({}),
    touch: jest.fn().mockResolvedValue(undefined),
    update: jest.fn(),
  };
}

describe('Chat v2 send critical path (#59)', () => {
  beforeEach(() => {
    jest.spyOn(appLogger, 'info').mockImplementation(() => undefined);
    jest.spyOn(appLogger, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reuses the guard-verified principal instead of resolving identity again', async () => {
    const enforceRateLimit = jest.fn().mockResolvedValue(principal);
    const service = new ChatService(
      repository() as never,
      {
        enforceRateLimit,
        stream: jest.fn(async function* () {
          yield { type: 'delta', content: 'answer' };
          yield { type: 'done' };
        }),
      } as never,
      { logFromRequest: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await collect(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(enforceRateLimit).toHaveBeenCalledTimes(1);
    expect(enforceRateLimit).toHaveBeenCalledWith(request, principal);
  });

  it('emits chat.first_token when the first model token arrives, without waiting on title work', async () => {
    const info = jest.spyOn(appLogger, 'info').mockImplementation(() => undefined);
    let releaseTitle: () => void = () => undefined;
    const titleGate = new Promise<void>((resolve) => {
      releaseTitle = resolve;
    });
    const repo = repository();
    repo.get = jest.fn().mockResolvedValue({
      id: 'chat-1',
      title: null,
      page_path: null,
      module_key: null,
    });
    repo.update = jest.fn(async () => {
      await titleGate;
      return {};
    });
    const service = new ChatService(
      repo as never,
      {
        enforceRateLimit: jest.fn().mockResolvedValue(principal),
        stream: jest.fn(async function* () {
          yield { type: 'delta', content: 'answer' };
          yield { type: 'done' };
        }),
      } as never,
      { logFromRequest: jest.fn().mockResolvedValue(undefined) } as never,
    );

    const events: Array<{ type: string }> = [];
    const consume = (async () => {
      for await (const event of service.streamMessage(
        'chat-1',
        { content: 'hello' },
        request,
        principal,
      )) {
        events.push(event);
      }
    })();

    await waitUntil(() => events.some((event) => event.type === 'delta'));

    expect(events.map((event) => event.type)).toContain('delta');
    expect(
      info.mock.calls.some(([fields]) => fields.event === 'chat.first_token'),
    ).toBe(true);
    expect(events.map((event) => event.type)).not.toContain('done');

    releaseTitle();
    await consume;

    expect(events.map((event) => event.type)).toEqual([
      'user-persisted',
      'delta',
      'persisted',
      'done',
    ]);
  });

  it('loads a bounded model-context window, not the full persisted transcript', async () => {
    const repo = repository();
    const service = new ChatService(
      repo as never,
      {
        enforceRateLimit: jest.fn().mockResolvedValue(principal),
        stream: jest.fn(async function* () {
          yield { type: 'delta', content: 'answer' };
          yield { type: 'done' };
        }),
      } as never,
      { logFromRequest: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await collect(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(repo.listRecentMessages).toHaveBeenCalledWith(
      request,
      'chat-1',
      expect.any(Number),
    );
    const limit = repo.listRecentMessages.mock.calls[0][2] as number;
    expect(limit).toBeGreaterThan(0);
    expect(limit).toBeLessThanOrEqual(500);
  });

  it('injects cached effective settings once and does not fetch settings again during the stream', async () => {
    const getSettings = jest.fn().mockResolvedValue({
      schemaVersion: 1,
      effective: {
        language: 'zh-CN',
        theme: 'system',
        chat: { defaultModel: 'gpt-4.1-mini', defaultPrompt: 'Be concise.' },
      },
    });
    const stream = jest.fn(async function* () {
      yield { type: 'delta', content: 'answer' };
      yield { type: 'done' };
    });
    const service = new ChatService(
      repository() as never,
      {
        enforceRateLimit: jest.fn().mockResolvedValue(principal),
        stream,
      } as never,
      { logFromRequest: jest.fn().mockResolvedValue(undefined) } as never,
      { getSettings } as never,
    );

    await collect(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(getSettings).toHaveBeenCalledTimes(1);
    expect(getSettings).toHaveBeenCalledWith(request, principal);
    expect(stream).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        settings: {
          defaultModel: 'gpt-4.1-mini',
          defaultPrompt: 'Be concise.',
        },
      }),
    );
  });

  it('continues the send with platform defaults when settings lookup fails', async () => {
    const stream = jest.fn(async function* () {
      yield { type: 'delta', content: 'answer' };
      yield { type: 'done' };
    });
    const service = new ChatService(
      repository() as never,
      {
        enforceRateLimit: jest.fn().mockResolvedValue(principal),
        stream,
      } as never,
      { logFromRequest: jest.fn().mockResolvedValue(undefined) } as never,
      { getSettings: jest.fn().mockRejectedValue(new Error('settings down')) } as never,
    );

    const events = await collect(
      service.streamMessage('chat-1', { content: 'hello' }, request, principal),
    );

    expect(events.map((event) => event.type)).toEqual([
      'user-persisted',
      'delta',
      'persisted',
      'done',
    ]);
    expect(stream).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({
        settings: expect.anything(),
      }),
    );
  });
});
