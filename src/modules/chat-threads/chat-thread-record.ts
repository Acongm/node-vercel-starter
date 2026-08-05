import { EntityRecord } from '../../adapters/data-store/data-store.interface';

export interface ChatThreadRecord extends EntityRecord {
  userId?: string;
  clientId?: string;
  conversationId?: string;
  title?: string;
  callSource: string;
  pagePath?: string;
  moduleKey?: string;
  metadata?: Record<string, unknown>;
}

export type CreateChatThreadInput = Omit<
  ChatThreadRecord,
  'id' | 'createdAt' | 'updatedAt'
>;

export interface ChatMessageRecord extends EntityRecord {
  threadId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  thinking?: string;
  model?: string;
  provider?: string;
  tokenInput?: number;
  tokenOutput?: number;
  sources?: Array<{ title: string; url: string }>;
  metadata?: Record<string, unknown>;
}

export type CreateChatMessageInput = Omit<
  ChatMessageRecord,
  'id' | 'createdAt' | 'updatedAt'
>;
