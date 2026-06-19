import { EntityRecord } from '../../adapters/data-store/data-store.interface';

export interface ChatLogContext {
  scope?: string;
  pagePath?: string;
  moduleKey?: string;
  title?: string;
  tags?: string[];
  contentHash?: string;
}

export interface ChatLogSource {
  title: string;
  url: string;
}

export interface ChatLogRecord extends EntityRecord {
  clientId?: string;
  callSource: string;
  conversationId?: string;
  endpoint: string;
  requestId?: string;
  userMessage: string;
  assistantMessage: string;
  context?: ChatLogContext;
  provider?: string;
  model?: string;
  enableWebSearch: boolean;
  sources?: ChatLogSource[];
  origin?: string;
  userAgent?: string;
}

export type CreateChatLogInput = Omit<
  ChatLogRecord,
  'id' | 'createdAt' | 'updatedAt'
>;
