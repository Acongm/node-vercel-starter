import { ChatMessage } from '../../../adapters/ai/ai-client.interface';
import { ChatV1Dto } from './chat-v1.dto';

export const HISTORY_MESSAGE_LIMIT = 12;
export const HISTORY_CHAR_BUDGET = 24000;
export const LONG_HISTORY_MESSAGE_LIMIT = 40;
export const LONG_HISTORY_CHAR_BUDGET = 80000;
export const DOCUMENT_CONTENT_CHAR_BUDGET = 8000;
export const SYSTEM_PROMPT_CHAR_BUDGET = 10000;
export const USER_PREFERENCE_PREFIX = '用户偏好：';
export const USER_SKILL_PREFIX = '用户技能';

export type ChatSettingsInjection = {
  defaultModel?: string;
  defaultPrompt?: string;
  skills?: Array<{
    name: string;
    content: string;
    enabled?: boolean;
  }>;
};

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

  if (dto.enableWebSearch) {
    const lines = [
      '你是 Acongm 智能助手。系统已启用联网检索，会在下方注入【联网检索结果】。',
      '你必须优先依据【联网检索结果】中的摘要与网页片段回答，并给出引用来源。',
      '禁止声称「无法联网」「只能阅读文档」或拒绝回答——联网能力已启用。',
      '若检索结果不足以回答，可结合常识补充，并说明实时数据可能不完全准确。',
      context?.title ? `对话主题：${normalize(context.title)}` : '',
      context?.moduleKey ? `模块：${normalize(context.moduleKey)}` : '',
    ].filter(Boolean);

    const content = safeSlice(
      normalize(context?.content),
      DOCUMENT_CONTENT_CHAR_BUDGET,
    );
    if (content) {
      lines.push(`附加参考文档（次要）：\n${content}`);
    }

    return safeSlice(lines.join('\n'), SYSTEM_PROMPT_CHAR_BUDGET);
  }

  const scope = context?.scope === 'module' ? '本模块' : '当前文章';
  const lines = [
    '你是技术知识库的 AI 阅读助手。回答准确、简洁，并明确区分文档内容与外部信息。',
    `回答范围：${scope}。`,
    '除非上下文明确提供，否则不要声称已联网检索。',
    dto.enableThinking
      ? '可以先进行内部推理，再给出最终回答；对外回答保持简洁。'
      : '',
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

  const messageLimit =
    dto.historyMode === 'long'
      ? LONG_HISTORY_MESSAGE_LIMIT
      : HISTORY_MESSAGE_LIMIT;
  const charBudget =
    dto.historyMode === 'long'
      ? LONG_HISTORY_CHAR_BUDGET
      : HISTORY_CHAR_BUDGET;

  const newest = supplied.slice(-messageLimit);
  const bounded: ChatMessage[] = [];
  let remaining = charBudget;

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

export function prepareChatV1Messages(
  dto: ChatV1Dto,
  settings: ChatSettingsInjection = {},
): ChatMessage[] {
  return [
    { role: 'system', content: buildSystemPrompt(dto) },
    ...buildPreferenceMessages(settings),
    ...prepareConversation(dto),
  ];
}

function buildPreferenceMessages(
  settings: ChatSettingsInjection,
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const preference = normalize(settings.defaultPrompt);
  if (preference) {
    messages.push({
      role: 'user',
      content: `${USER_PREFERENCE_PREFIX}${preference}`,
    });
  }

  for (const skill of settings.skills ?? []) {
    if (skill.enabled === false) continue;
    const name = normalize(skill.name);
    const content = normalize(skill.content);
    if (!name && !content) continue;
    messages.push({
      role: 'user',
      content: content
        ? `${USER_SKILL_PREFIX}「${name}」：${content}`
        : `${USER_SKILL_PREFIX}「${name}」`,
    });
  }

  return messages;
}
