import { EventEmitter } from 'node:events';
import { AuthPrincipal } from '../src/modules/auth/roles';
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

describe('ChatController SSE contract', () => {
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

  it('frames service failures as an SSE error when the client is still connected', async () => {
    async function* stream() {
      yield { type: 'meta', provider: 'test', model: 'test' };
      throw new Error('provider failed');
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
    expect(response.chunks.join('')).toContain('provider failed');
    expect(response.ended).toBe(true);
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
