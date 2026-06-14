import { AiClient, AiStreamEvent } from '../src/adapters/ai/ai-client.interface';
import { AppConfig } from '../src/config/app-config';
import { AiV1Service } from '../src/modules/ai/v1/ai-v1.service';

describe('AiV1Service', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
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
        summary: '', keyPoints: [], keywords: [], techStack: [], difficulty: '', contentType: '',
      }),
      createChatCompletion: async () => ({}),
    };
    global.fetch = jest.fn(async () =>
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
    const service = new AiV1Service(client, config);

    const result = await service.chat({ prompt: 'React 19 有什么更新？', enableWebSearch: true });

    expect(capturedMessages[0].content).toContain('React docs - https://react.dev');
    expect(result.sources).toEqual([{ title: 'React docs', url: 'https://react.dev' }]);
  });
});
