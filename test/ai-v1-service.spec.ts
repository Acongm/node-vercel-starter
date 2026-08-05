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
            results: [{ title: 'React docs', url: 'https://react.dev' }],
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

    expect(capturedMessages[0].content).toContain(
      'React docs - https://react.dev',
    );
    expect(result.sources).toEqual([
      { title: 'React docs', url: 'https://react.dev' },
    ]);
  });
});
