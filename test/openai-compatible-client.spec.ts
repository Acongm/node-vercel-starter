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
});
