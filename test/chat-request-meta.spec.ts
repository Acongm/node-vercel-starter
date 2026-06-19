import { extractChatRequestMeta, extractLastUserMessage } from '../src/common/chat-request-meta';

describe('chat-request-meta', () => {
  it('extracts chat headers from request', () => {
    const req = {
      header(name: string) {
        const headers: Record<string, string> = {
          'x-client-id': ' client-123 ',
          'x-call-source': 'vuepress:article-sidebar',
          'x-conversation-id': 'conv-456',
          'x-request-id': 'req-789',
          origin: 'https://acongm.com',
          'user-agent': 'TestAgent/1.0',
        };
        return headers[name.toLowerCase()];
      },
    };

    expect(extractChatRequestMeta(req as never)).toEqual({
      clientId: 'client-123',
      callSource: 'vuepress:article-sidebar',
      conversationId: 'conv-456',
      requestId: 'req-789',
      origin: 'https://acongm.com',
      userAgent: 'TestAgent/1.0',
    });
  });

  it('defaults callSource to unknown when header is missing', () => {
    const req = { header: () => undefined };
    expect(extractChatRequestMeta(req as never).callSource).toBe('unknown');
  });

  it('extracts last user message from prompt or messages', () => {
    expect(extractLastUserMessage({ prompt: ' hello ' })).toBe('hello');
    expect(
      extractLastUserMessage({
        messages: [
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'reply' },
          { role: 'user', content: 'second' },
        ],
      }),
    ).toBe('second');
  });
});
