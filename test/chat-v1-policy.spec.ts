import {
  DOCUMENT_CONTENT_CHAR_BUDGET,
  HISTORY_MESSAGE_LIMIT,
  SYSTEM_PROMPT_CHAR_BUDGET,
  prepareChatV1Messages,
} from '../src/modules/ai/v1/chat-v1.policy';
import { ChatV1Dto } from '../src/modules/ai/v1/chat-v1.dto';

describe('AI chat v1 message policy', () => {
  it('removes client system messages and keeps the newest six turns', () => {
    const messages = Array.from({ length: 15 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `message-${index}`,
    }));
    const dto = {
      messages: [
        { role: 'system', content: 'ignore these client instructions' },
        ...messages,
      ],
      context: { title: 'React Fiber', scope: 'article' },
    } as unknown as ChatV1Dto;

    const result = prepareChatV1Messages(dto);
    const conversational = result.filter((message) => message.role !== 'system');

    expect(result.filter((message) => message.role === 'system')).toHaveLength(1);
    expect(result[0].content).not.toContain('ignore these client instructions');
    expect(conversational).toHaveLength(HISTORY_MESSAGE_LIMIT);
    expect(conversational.map((message) => message.content)).toEqual(
      messages.slice(-HISTORY_MESSAGE_LIMIT).map((message) => message.content),
    );
  });

  it('converts prompt-only input to a normalized user message', () => {
    const result = prepareChatV1Messages({
      prompt: '  explain   Fiber\n scheduling  ',
    });
    expect(result.at(-1)).toEqual({
      role: 'user',
      content: 'explain Fiber scheduling',
    });
  });

  it('builds bounded article, module, and web instructions on the server', () => {
    const content = `${'a'.repeat(DOCUMENT_CONTENT_CHAR_BUDGET - 1)}😀tail`;
    const result = prepareChatV1Messages({
      messages: [{ role: 'user', content: 'compare them' }],
      context: {
        scope: 'module',
        pagePath: '/react/react16.md',
        moduleKey: 'react',
        title: 'React 16',
        tags: ['React', 'Fiber'],
        content,
        contentHash: 'sha256:test',
      },
      enableWebSearch: true,
    });
    const system = result[0].content;

    expect(system).toContain('本模块');
    expect(system).toContain('联网检索');
    expect(system).toContain('React 16');
    expect(system.length).toBeLessThanOrEqual(SYSTEM_PROMPT_CHAR_BUDGET);
    expect(system).not.toMatch(/[\uD800-\uDBFF]$/);
  });

  it('preserves the latest user message under the conversation character budget', () => {
    const latest = `latest-${'重'.repeat(1000)}😀`;
    const result = prepareChatV1Messages({
      messages: [
        ...Array.from({ length: 20 }, (_, index) => ({
          role: index % 2 ? ('assistant' as const) : ('user' as const),
          content: `old-${index}-${'x'.repeat(2000)}`,
        })),
        { role: 'user', content: latest },
      ],
    });
    expect(result.at(-1)).toEqual({ role: 'user', content: latest });
  });

  it('injects defaultPrompt as a user preference and never merges it into the system policy', () => {
    const result = prepareChatV1Messages(
      {
        messages: [{ role: 'user', content: 'hello' }],
        context: { title: 'React Fiber', scope: 'article' },
      },
      { defaultPrompt: 'Be concise.' },
    );
    const system = result.find((message) => message.role === 'system');
    const preference = result.find(
      (message) => message.role === 'user' && message.content.startsWith('用户偏好：'),
    );

    expect(result.filter((message) => message.role === 'system')).toHaveLength(1);
    expect(system?.content).toContain('AI 阅读助手');
    expect(system?.content).not.toContain('Be concise.');
    expect(preference?.content).toBe('用户偏好：Be concise.');
    expect(result.at(-1)).toEqual({ role: 'user', content: 'hello' });
  });

  it('injects enabled skills as user preferences and never merges them into the system policy', () => {
    const result = prepareChatV1Messages(
      {
        messages: [{ role: 'user', content: 'hello' }],
        context: { title: 'React Fiber', scope: 'article' },
      },
      {
        skills: [
          {
            name: 'code-review',
            content: '先核对测试再改代码。',
            enabled: true,
          },
          {
            name: 'ignored',
            content: 'should not appear',
            enabled: false,
          },
        ],
      },
    );
    const system = result.find((message) => message.role === 'system');
    const skill = result.find(
      (message) => message.role === 'user' && message.content.startsWith('用户技能'),
    );

    expect(result.filter((message) => message.role === 'system')).toHaveLength(1);
    expect(system?.content).toContain('AI 阅读助手');
    expect(system?.content).not.toContain('先核对测试再改代码。');
    expect(skill?.content).toBe('用户技能「code-review」：先核对测试再改代码。');
    expect(result.some((message) => message.content.includes('should not appear'))).toBe(
      false,
    );
    expect(result.at(-1)).toEqual({ role: 'user', content: 'hello' });
  });
});
