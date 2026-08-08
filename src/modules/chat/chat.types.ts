import { ChatSource } from '../../adapters/ai/ai-client.interface';

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';
export type ChatRunStatus = 'running' | 'complete' | 'cancelled' | 'error';

type ExtensibleChatMessagePart = {
  type: string;
  text?: unknown;
  source?: unknown;
  [key: string]: unknown;
};

export type ChatMessagePart =
  | (ExtensibleChatMessagePart & { type: 'text'; text: string })
  | (ExtensibleChatMessagePart & { type: 'reasoning'; text: string })
  | (ExtensibleChatMessagePart & { type: 'source'; source: ChatSource })
  | ExtensibleChatMessagePart;

export interface ChatRecord {
  id: string;
  user_id: string;
  title: string | null;
  page_path: string | null;
  module_key: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRecord {
  id: string;
  chat_id: string;
  user_id: string;
  client_message_id: string | null;
  parent_message_id: string | null;
  role: ChatRole;
  parts: ChatMessagePart[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChatRunRecord {
  id: string;
  chat_id: string;
  user_id: string;
  user_message_id: string;
  assistant_message_id: string | null;
  status: ChatRunStatus;
  error_message: string | null;
  metadata: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
}

export function textFromParts(parts: ChatMessagePart[] | null | undefined): string {
  return (parts || [])
    .flatMap((part) => {
      if (part.type !== 'text') return [];
      return typeof part.text === 'string' ? [part.text] : [];
    })
    .join('\n')
    .trim();
}

export function selectMessageBranch(
  messages: ChatMessageRecord[],
  headMessageId: string,
): ChatMessageRecord[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const branch: ChatMessageRecord[] = [];
  const visited = new Set<string>();
  let current = byId.get(headMessageId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    branch.push(current);
    current = current.parent_message_id
      ? byId.get(current.parent_message_id)
      : undefined;
  }

  return branch.reverse();
}
