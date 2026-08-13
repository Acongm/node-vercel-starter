import { EventEmitter } from 'node:events';
import { AuthPrincipal } from '../src/modules/auth/roles';
import { ChatContractError } from '../src/modules/chat/chat.errors';
import { ChatController } from '../src/modules/chat/chat.controller';

const principal: AuthPrincipal = {
  userId: 'user-1',
  email: 'u@example.com',
  name: 'User',
  role: 'viewer',
  tier: 'user',
  source: 'supabase',
};

class FakeRequest extends EventEmitter {
  auth = principal;

  header(name: string) {
    return name.toLowerCase() === 'authorization' ? 'Bearer token' : undefined;
  }
}

class FakeResponse {
  statusCode = 200;
  headers: Record<string, string> = {};
  chunks: string[] = [];
  ended = false;
  flushed = false;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  set(headers: Record<string, string>) {
    this.headers = { ...this.headers, ...headers };
    return this;
  }

  flushHeaders() {
    this.flushed = true;
  }

  write(chunk: string) {
    this.chunks.push(chunk);
    return true;
  }

  end() {
    this.ended = true;
  }
}

function eventTypes(chunks: string[]): string[] {
  return chunks
    .filter((chunk) => chunk.startsWith('event: '))
    .map((chunk) => chunk.slice('event: '.length).trim());
}

function joinedData(chunks: string[]) {
  return chunks.join('');
}

describe('ChatController contract', () => {
  it('delegates paginated REST routes without substituting client-owned identity', async () => {
    const listResult = { chats: [{ id: 'chat-1' }], nextCursor: 'next-chat' };
    const messageResult = {
      messages: [{ id: 'message-1' }],
      nextCursor: 'next-message',
    };
    const list = jest.fn().mockResolvedValue(listResult);
    const create = jest.fn().mockResolvedValue({ id: 'chat-2' });
    const get = jest
      .fn()
      .mockResolvedValue({ chat: { id: 'chat-1' }, messages: [], nextCursor: null });
    const update = jest
      .fn()
      .mockResolvedValue({ id: 'chat-1', title: 'Renamed' });
    const remove = jest.fn().mockResolvedValue(undefined);
    const listMessages = jest.fn().mockResolvedValue(messageResult);
    const controller = new ChatController({
      list,
      create,
      get,
      update,
      delete: remove,
      listMessages,
    } as never);
    const request = new FakeRequest();
    const chatQuery = { limit: 20, after: 'chat-cursor' };
    const messageQuery = { limit: 40, after: 'message-cursor' };

    await expect(controller.list(request as never, chatQuery)).resolves.toBe(
      listResult,
    );
    await expect(
      controller.create(request as never, { title: 'New chat' }),
    ).resolves.toEqual({ id: 'chat-2' });
    await expect(controller.get(request as never, 'chat-1', {})).resolves.toEqual({
      chat: { id: 'chat-1' },
      messages: [],
      nextCursor: null,
    });
    await expect(
      controller.update(request as never, 'chat-1', { title: 'Renamed' }),
    ).resolves.toEqual({ id: 'chat-1', title: 'Renamed' });
    await controller.remove(request as never, 'chat-1');
    await expect(
      controller.messages(request as never, 'chat-1', messageQuery),
    ).resolves.toBe(messageResult);

    expect(list).toHaveBeenCalledWith(request, chatQuery);
    expect(create).toHaveBeenCalledWith(request, principal, {
      title: 'New chat',
    });
    expect(get).toHaveBeenCalledWith(request, 'chat-1', {});
    expect(update).toHaveBeenCalledWith(request, 'chat-1', {
      title: 'Renamed',
    });
    expect(remove).toHaveBeenCalledWith(request, 'chat-1');
    expect(listMessages).toHaveBeenCalledWith(request, 'chat-1', messageQuery);
  });

  it('sets SSE headers and preserves service event order', async () => {
    async function* stream() {
      yield { type: 'user-persisted', messageId: 'u1', chatId: 'chat-1' };
      yield { type: 'delta', content: 'hello' };
      yield { type: 'persisted', messageId: 'a1', chatId: 'chat-1' };
      yield { type: 'done' };
    }
    const service = { streamMessage: jest.fn(() => stream()) };
    const controller = new ChatController(service as never);
    const request = new FakeRequest();
    const response = new FakeResponse();

    await controller.streamMessage(
      request as never,
      'chat-1',
      { content: 'question' },
      response as never,
    );

    expect(response.statusCode).toBe(201);
    expect(response.headers).toMatchObject({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    expect(response.flushed).toBe(true);
    expect(eventTypes(response.chunks)).toEqual([
      'user-persisted',
      'delta',
      'persisted',
      'done',
    ]);
    expect(response.ended).toBe(true);
    expect(request.listenerCount('close')).toBe(0);
  });

  it('falls back to the generic message event type for untyped payloads', async () => {
    async function* stream() {
      yield { content: 'untyped payload' };
    }
    const controller = new ChatController({
      streamMessage: jest.fn(() => stream()),
    } as never);
    const request = new FakeRequest();
    const response = new FakeResponse();

    await controller.streamMessage(
      request as never,
      'chat-1',
      { content: 'question' },
      response as never,
    );

    expect(eventTypes(response.chunks)).toEqual(['message']);
    expect(joinedData(response.chunks)).toContain('untyped payload');
  });

  it('sanitizes unknown provider/database failures instead of leaking internal details', async () => {
    async function* stream() {
      yield { type: 'meta', provider: 'test', model: 'test' };
      throw new Error('postgres password=secret provider stack');
    }
    const controller = new ChatController({
      streamMessage: jest.fn(() => stream()),
    } as never);
    const request = new FakeRequest();
    const response = new FakeResponse();

    await controller.streamMessage(
      request as never,
      'chat-1',
      { content: 'question' },
      response as never,
    );

    expect(eventTypes(response.chunks)).toEqual(['meta', 'error']);
    expect(joinedData(response.chunks)).toContain('CHAT_STREAM_FAILED');
    expect(joinedData(response.chunks)).toContain('Chat stream failed.');
    expect(joinedData(response.chunks)).not.toContain('password=secret');
    expect(response.ended).toBe(true);
  });

  it('preserves explicit safe chat contract error code/message', async () => {
    async function* stream() {
      throw new ChatContractError(
        'CHAT_EMPTY_RESPONSE',
        'Model returned no usable content.',
      );
    }
    const controller = new ChatController({
      streamMessage: jest.fn(() => stream()),
    } as never);
    const request = new FakeRequest();
    const response = new FakeResponse();

    await controller.streamMessage(
      request as never,
      'chat-1',
      { content: 'question' },
      response as never,
    );

    expect(eventTypes(response.chunks)).toEqual(['error']);
    expect(joinedData(response.chunks)).toContain('CHAT_EMPTY_RESPONSE');
    expect(joinedData(response.chunks)).toContain('Model returned no usable content.');
  });

  it('uses a stable generic error frame for non-Error failures', async () => {
    async function* stream() {
      throw 'provider-string-failure';
    }
    const controller = new ChatController({
      streamMessage: jest.fn(() => stream()),
    } as never);
    const request = new FakeRequest();
    const response = new FakeResponse();

    await controller.streamMessage(
      request as never,
      'chat-1',
      { content: 'question' },
      response as never,
    );

    expect(eventTypes(response.chunks)).toEqual(['error']);
    expect(joinedData(response.chunks)).toContain('CHAT_STREAM_FAILED');
    expect(joinedData(response.chunks)).not.toContain('provider-string-failure');
  });

  it('aborts the provider and suppresses a synthetic error event after the client closes', async () => {
    const request = new FakeRequest();
    let capturedSignal: AbortSignal | undefined;

    async function* stream() {
      yield { type: 'meta', provider: 'test', model: 'test' };
      request.emit('close');
      throw new Error('connection closed');
    }

    const controller = new ChatController({
      streamMessage: jest.fn(
        (
          _id: string,
          _dto: unknown,
          _request: unknown,
          _principal: unknown,
          signal: AbortSignal,
        ) => {
          capturedSignal = signal;
          return stream();
        },
      ),
    } as never);
    const response = new FakeResponse();

    await controller.streamMessage(
      request as never,
      'chat-1',
      { content: 'question' },
      response as never,
    );

    expect(capturedSignal?.aborted).toBe(true);
    expect(eventTypes(response.chunks)).toEqual(['meta']);
    expect(response.ended).toBe(true);
    expect(request.listenerCount('close')).toBe(0);
  });
});
