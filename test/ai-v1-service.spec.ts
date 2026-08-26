import { AiClient, AiStreamEvent } from '../src/adapters/ai/ai-client.interface';
import { AppConfig } from '../src/config/app-config';
import { DEFAULT_SITE_CONFIG } from '../src/config/site-config';
import { ChatRateLimitService } from '../src/modules/ai/chat-rate-limit.service';
import { AiV1Service } from '../src/modules/ai/v1/ai-v1.service';
import { JwtAuthService } from '../src/modules/auth/jwt-auth.service';
import { createAnonymousPrincipal } from '../src/modules/auth/roles';
import { ChatLogWriterService } from '../src/modules/chat-logs/chat-log-writer.service';

function createMockRequest() {
  return { header: () => undefined } as never;
}

describe('AiV1Service', () => {
  const originalFetch = global.fetch;
  const chatLogWriter = {
    logFromRequest: jest.fn(),
  } as unknown as ChatLogWriterService;
  const rateLimit = new ChatRateLimitService();
  const jwtAuth = {
    resolvePrincipal: jest.fn(async () => createAnonymousPrincipal()),
  } as unknown as JwtAuthService;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
    rateLimit.reset();
  });

  it('injects web search sources only when explicitly enabled', async () => {
    let capturedMessages: Array<{ role: string; content: string }> = [];
    const client: AiClient = {
      chat: async (input) => {
        capturedMessages = input.messages || [];
        return { provider: 'custom', model: 'model', message: 'answer' };
      },
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        yield { type: 'done' };
      },
      generateSummary: async () => ({
        summary: '',
        keyPoints: [],
        keywords: [],
        techStack: [],
        difficulty: '',
        contentType: '',
      }),
      createChatCompletion: async () => ({}),
    };
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            answer: 'Shenzhen is warm today.',
            results: [
              {
                title: 'Shenzhen weather',
                url: 'https://weather.example/shenzhen',
                content: 'High 32C, mostly sunny.',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    const config = {
      ai: {
        provider: 'custom',
        model: 'model',
        baseUrl: 'https://example.test',
        webSearchApiKey: 'tavily-key',
      },
    } as AppConfig;
    const service = new AiV1Service(
      client,
      config,
      DEFAULT_SITE_CONFIG,
      chatLogWriter,
      rateLimit,
      jwtAuth,
    );

    const result = await service.chat(
      { prompt: 'React 19 有什么更新？', enableWebSearch: true },
      createMockRequest(),
    );

    expect(capturedMessages[0].content).toContain('Shenzhen is warm today.');
    expect(capturedMessages[0].content).toContain('Shenzhen weather');
    expect(result.sources).toEqual([
      {
        title: 'Shenzhen weather',
        url: 'https://weather.example/shenzhen',
        snippet: 'High 32C, mostly sunny.',
      },
    ]);
  });

  it('enables web search by default when the client omits the flag', async () => {
    let capturedMessages: Array<{ role: string; content: string }> = [];
    const client: AiClient = {
      chat: async (input) => {
        capturedMessages = input.messages || [];
        return { provider: 'custom', model: 'model', message: 'answer' };
      },
      async *streamChat(): AsyncIterable<AiStreamEvent> {
        yield { type: 'done' };
      },
      generateSummary: async () => ({
        summary: '',
        keyPoints: [],
        keywords: [],
        techStack: [],
        difficulty: '',
        contentType: '',
      }),
      createChatCompletion: async () => ({}),
    };
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            answer: 'Shenzhen is warm today.',
            results: [
              {
                title: 'Shenzhen weather',
                url: 'https://weather.example/shenzhen',
                content: 'High 32C, mostly sunny.',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    const service = new AiV1Service(
      client,
      {
        ai: {
          provider: 'custom',
          model: 'model',
          baseUrl: 'https://example.test',
          webSearchApiKey: 'tavily-key',
        },
      } as AppConfig,
      DEFAULT_SITE_CONFIG,
      chatLogWriter,
      rateLimit,
      jwtAuth,
    );

    await service.chat({ prompt: '今天深圳什么天气' }, createMockRequest());

    expect(global.fetch).toHaveBeenCalled();
    expect(capturedMessages[0].content).toContain('【联网检索结果】');
    expect(capturedMessages[0].content).toContain('Shenzhen weather');
  });

  it('does not call Tavily when the AI provider is mock', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('Tavily must not be called in mock mode');
    });
    const runtimeConfig = {
      getWebSearchApiKey: jest.fn(async () => {
        await new Promise(() => undefined);
        return 'tavily-key';
      }),
      getAiConfig: jest.fn(async () => {
        await new Promise(() => undefined);
        return { provider: 'mock', model: 'mock-local' };
      }),
    };
    const service = new AiV1Service(
      {
        chat: async () => ({ provider: 'mock', model: 'mock-local', message: 'ok' }),
        async *streamChat() {
          yield { type: 'delta', content: 'ok' };
          yield { type: 'done' };
        },
        generateSummary: async () => ({
          summary: '',
          keyPoints: [],
          keywords: [],
          techStack: [],
          difficulty: '',
          contentType: '',
        }),
        createChatCompletion: async () => ({}),
      },
      { ai: { provider: 'mock', model: 'mock-local' } } as AppConfig,
      DEFAULT_SITE_CONFIG,
      chatLogWriter,
      rateLimit,
      jwtAuth,
      runtimeConfig as never,
    );

    const events: Array<{ type: string }> = [];
    for await (const event of service.stream({ prompt: 'hello quality gate' })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === 'delta')).toBe(true);
    expect(events.some((event) => event.type === 'done')).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(runtimeConfig.getWebSearchApiKey).not.toHaveBeenCalled();
    expect(runtimeConfig.getAiConfig).not.toHaveBeenCalled();
  });

  it('does not re-resolve identity when a verified principal is already provided', async () => {
    const service = new AiV1Service(
      {
        chat: async () => ({ provider: 'mock', model: 'mock', message: 'ok' }),
        async *streamChat() {
          yield { type: 'done' };
        },
        generateSummary: async () => ({
          summary: '',
          keyPoints: [],
          keywords: [],
          techStack: [],
          difficulty: '',
          contentType: '',
        }),
        createChatCompletion: async () => ({}),
      },
      { ai: { provider: 'mock', model: 'mock' } } as AppConfig,
      DEFAULT_SITE_CONFIG,
      chatLogWriter,
      rateLimit,
      jwtAuth,
    );
    const verified = {
      userId: 'user-1',
      role: 'viewer' as const,
      tier: 'user' as const,
      source: 'supabase' as const,
    };

    await expect(
      service.enforceRateLimit(createMockRequest(), verified),
    ).resolves.toEqual(verified);
    expect(jwtAuth.resolvePrincipal).not.toHaveBeenCalled();
  });

  it('legacy callers without a principal still resolve identity from the request', async () => {
    const service = new AiV1Service(
      {
        chat: async () => ({ provider: 'mock', model: 'mock', message: 'ok' }),
        async *streamChat() {
          yield { type: 'done' };
        },
        generateSummary: async () => ({
          summary: '',
          keyPoints: [],
          keywords: [],
          techStack: [],
          difficulty: '',
          contentType: '',
        }),
        createChatCompletion: async () => ({}),
      },
      { ai: { provider: 'mock', model: 'mock' } } as AppConfig,
      DEFAULT_SITE_CONFIG,
      chatLogWriter,
      rateLimit,
      jwtAuth,
    );

    await service.enforceRateLimit(createMockRequest());
    expect(jwtAuth.resolvePrincipal).toHaveBeenCalledTimes(1);
  });
});
