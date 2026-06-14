import { OpenAiCompatibleClient } from '../src/adapters/ai/openai-compatible.client';

describe('OpenAiCompatibleClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('forwards OpenAI-compatible chat completion requests to the configured provider', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    global.fetch = jest.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'chatcmpl-upstream',
          object: 'chat.completion',
          created: 1780700000,
          model: 'deepseek-v4-pro',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'hello from upstream' },
              finish_reason: 'stop',
            },
          ],
        }),
      } as Response;
    });

    const client = new OpenAiCompatibleClient({
      provider: 'custom',
      apiKey: 'as-xxx',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
    });

    const response = await client.createChatCompletion({
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.2,
      max_tokens: 64,
    });

    expect(response).toMatchObject({
      id: 'chatcmpl-upstream',
      model: 'deepseek-v4-pro',
      choices: [
        {
          message: { role: 'assistant', content: 'hello from upstream' },
        },
      ],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.deepseek.com/chat/completions');
    expect(calls[0].init.headers).toMatchObject({
      authorization: 'Bearer as-xxx',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      model: 'deepseek-v4-pro',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.2,
      max_tokens: 64,
    });
  });

  it('preserves upstream HTTP status when the provider rejects a request', async () => {
    global.fetch = jest.fn(async () => {
      return {
        ok: false,
        status: 401,
        text: async () =>
          '{"error":{"message":"Authentication Fails, Your api key: ****-xxx is invalid"}}',
      } as Response;
    });

    const client = new OpenAiCompatibleClient({
      provider: 'custom',
      apiKey: 'as-xxx',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
    });

    await expect(
      client.createChatCompletion({
        model: 'deepseek-v4-pro',
        messages: [{ role: 'user', content: 'hello' }],
      }),
    ).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining('Authentication Fails'),
    });
  });

  it('parses arbitrarily chunked OpenAI-compatible SSE streams', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"content":"你',
      '好"}}]}\n\ndata: {"choices":[{"delta":{"content":"，世界"}}]}\r\n\r\n',
      'data: {"usage":{"prompt_tokens":12,"completion_tokens":3,"total_tokens":15}}\n\n',
      'data: [DONE]\n\n',
    ];
    let requestBody: Record<string, unknown> = {};
    global.fetch = jest.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(
        new ReadableStream({
          start(controller) {
            for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      );
    });

    const client = new OpenAiCompatibleClient({
      provider: 'custom',
      apiKey: 'as-xxx',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
    });
    const events = [];
    for await (const event of client.streamChat({
      messages: [{ role: 'user', content: 'hello' }],
    })) {
      events.push(event);
    }

    expect(requestBody).toMatchObject({
      model: 'deepseek-v4-pro',
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 1024,
    });
    expect(events).toEqual([
      { type: 'delta', content: '你好' },
      { type: 'delta', content: '，世界' },
      {
        type: 'usage',
        promptTokens: 12,
        completionTokens: 3,
        totalTokens: 15,
      },
      { type: 'done' },
    ]);
  });

  it('emits exactly one done event when an upstream stream ends without DONE', async () => {
    const encoder = new TextEncoder();
    global.fetch = jest.fn(async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n'),
            );
            controller.close();
          },
        }),
        { status: 200 },
      ),
    );

    const client = new OpenAiCompatibleClient({
      provider: 'custom',
      apiKey: 'as-xxx',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-v4-pro',
    });
    const events = [];
    for await (const event of client.streamChat({ prompt: 'hello' })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'delta', content: 'partial' },
      { type: 'done' },
    ]);
  });
});
