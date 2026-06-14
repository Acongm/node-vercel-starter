import { ChatMessage } from '../../../adapters/ai/ai-client.interface';
import { ChatV1Dto } from './chat-v1.dto';

export const HISTORY_MESSAGE_LIMIT = 12;
export const HISTORY_CHAR_BUDGET = 24000;
export const DOCUMENT_CONTENT_CHAR_BUDGET = 8000;
export const SYSTEM_PROMPT_CHAR_BUDGET = 10000;

function normalize(value: string | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function safeSlice(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  let end = maxLength;
  const code = value.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return value.slice(0, end);
}

function buildSystemPrompt(dto: ChatV1Dto): string {
  const context = dto.context;
  const scope = context?.scope === 'module' ? '本模块' : '当前文章';
  const lines = [
    '你是技术知识库的 AI 阅读助手。回答准确、简洁，并明确区分文档内容与外部信息。',
    `回答范围：${scope}。`,
    dto.enableWebSearch
      ? '用户要求联网检索；结合检索来源回答并给出引用。'
      : '除非上下文明确提供，否则不要声称已联网检索。',
    context?.title ? `标题：${normalize(context.title)}` : '',
    context?.pagePath ? `路径：${normalize(context.pagePath)}` : '',
    context?.moduleKey ? `模块：${normalize(context.moduleKey)}` : '',
    context?.tags?.length
      ? `标签：${context.tags.map((tag) => normalize(tag)).filter(Boolean).join('、')}`
      : '',
    context?.contentHash ? `内容标识：${normalize(context.contentHash)}` : '',
  ].filter(Boolean);

  const content = safeSlice(
    normalize(context?.content),
    DOCUMENT_CONTENT_CHAR_BUDGET,
  );
  if (content) lines.push(`参考内容：\n${content}`);
  return safeSlice(lines.join('\n'), SYSTEM_PROMPT_CHAR_BUDGET);
}

function prepareConversation(dto: ChatV1Dto): ChatMessage[] {
  const supplied = Array.isArray(dto.messages)
    ? dto.messages
        .filter(
          (message) =>
            message &&
            (message.role === 'user' || message.role === 'assistant'),
        )
        .map((message) => ({
          role: message.role,
          content: normalize(message.content),
        }))
        .filter((message) => message.content)
    : [];

  if (supplied.length === 0) {
    const prompt = normalize(dto.prompt);
    return prompt ? [{ role: 'user', content: prompt }] : [];
  }

  const newest = supplied.slice(-HISTORY_MESSAGE_LIMIT);
  const bounded: ChatMessage[] = [];
  let remaining = HISTORY_CHAR_BUDGET;

  for (let index = newest.length - 1; index >= 0; index -= 1) {
    const message = newest[index];
    if (index === newest.length - 1) {
      bounded.unshift(message);
      remaining -= message.content.length;
      continue;
    }
    if (remaining <= 0) continue;
    const content = safeSlice(message.content, remaining);
    if (content) {
      bounded.unshift({ ...message, content });
      remaining -= content.length;
    }
  }
  return bounded;
}

export function prepareChatV1Messages(dto: ChatV1Dto): ChatMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt(dto) },
    ...prepareConversation(dto),
  ];
}
