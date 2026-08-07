import { ChatSource } from '../../adapters/ai/ai-client.interface';

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export type ChatMessagePart =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'source'; source: ChatSource }
  | { type: string; [key: string]: unknown };

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
  role: ChatRole;
  parts: ChatMessagePart[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export function textFromParts(parts: ChatMessagePart[] | null | undefined): string {
  return (parts || [])
    .flatMap((part) => {
      if (part.type !== 'text' || !('text' in part)) return [];
      return typeof part.text === 'string' ? [part.text] : [];
    })
    .join('\n')
    .trim();
}
