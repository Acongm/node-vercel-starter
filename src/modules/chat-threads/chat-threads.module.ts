import { Module } from '@nestjs/common';
import { MemoryDataStore } from '../../adapters/data-store/memory-data-store';
import { FileDataStore } from '../../adapters/data-store/file-data-store';
import { UnsupportedDataStore } from '../../adapters/data-store/unsupported-data-store';
import {
  SupabaseDataStore,
  SupabaseRow,
} from '../../adapters/data-store/supabase-data-store';
import { CreateEntityInput } from '../../adapters/data-store/data-store.interface';
import {
  APP_CONFIG,
  CHAT_MESSAGE_STORE,
  CHAT_THREAD_STORE,
} from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { ChatLogsModule } from '../chat-logs/chat-logs.module';
import {
  ChatMessageRecord,
  ChatThreadRecord,
} from './chat-thread-record';
import { ChatThreadsController } from './chat-threads.controller';
import { ChatThreadsService } from './chat-threads.service';

@Module({
  imports: [AuthModule, AiModule, ChatLogsModule],
  controllers: [ChatThreadsController],
  providers: [
    ChatThreadsService,
    {
      provide: CHAT_THREAD_STORE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createThreadStore(config),
    },
    {
      provide: CHAT_MESSAGE_STORE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createMessageStore(config),
    },
  ],
})
export class ChatThreadsModule {}

function createThreadStore(config: AppConfig) {
  switch (config.dataMode) {
    case 'none':
    case 'memory':
      return new MemoryDataStore<ChatThreadRecord>();
    case 'file':
      return new FileDataStore<ChatThreadRecord>(config.chatThreadsFilePath);
    case 'supabase':
      if (!config.supabase.url || !config.supabase.apiKey) {
        throw new Error(
          'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_API_KEY are required when DATA_MODE=supabase.',
        );
      }
      return new SupabaseDataStore<ChatThreadRecord>({
        table: 'chat_threads',
        url: config.supabase.url,
        apiKey: config.supabase.apiKey,
        requestSecret: config.supabase.requestSecret,
        fromRow: threadFromRow,
        toRow: threadToRow,
      });
    default:
      return new UnsupportedDataStore<ChatThreadRecord>(config.dataMode);
  }
}

function createMessageStore(config: AppConfig) {
  switch (config.dataMode) {
    case 'none':
    case 'memory':
      return new MemoryDataStore<ChatMessageRecord>();
    case 'file':
      return new FileDataStore<ChatMessageRecord>(config.chatMessagesFilePath);
    case 'supabase':
      if (!config.supabase.url || !config.supabase.apiKey) {
        throw new Error(
          'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_API_KEY are required when DATA_MODE=supabase.',
        );
      }
      return new SupabaseDataStore<ChatMessageRecord>({
        table: 'chat_messages',
        url: config.supabase.url,
        apiKey: config.supabase.apiKey,
        requestSecret: config.supabase.requestSecret,
        fromRow: messageFromRow,
        toRow: messageToRow,
      });
    default:
      return new UnsupportedDataStore<ChatMessageRecord>(config.dataMode);
  }
}

function threadFromRow(row: SupabaseRow): ChatThreadRecord {
  return {
    id: String(row.id),
    userId: row.user_id ? String(row.user_id) : undefined,
    clientId: row.client_id ? String(row.client_id) : undefined,
    conversationId: row.conversation_id
      ? String(row.conversation_id)
      : undefined,
    title: row.title ? String(row.title) : undefined,
    callSource: String(row.call_source || 'unknown'),
    pagePath: row.page_path ? String(row.page_path) : undefined,
    moduleKey: row.module_key ? String(row.module_key) : undefined,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at || row.created_at),
  };
}

function threadToRow(
  input: Partial<CreateEntityInput<ChatThreadRecord>>,
): SupabaseRow {
  return {
    user_id: input.userId,
    client_id: input.clientId,
    conversation_id: input.conversationId,
    title: input.title,
    call_source: input.callSource,
    page_path: input.pagePath,
    module_key: input.moduleKey,
    metadata: input.metadata || {},
  };
}

function messageFromRow(row: SupabaseRow): ChatMessageRecord {
  return {
    id: String(row.id),
    threadId: String(row.thread_id),
    role: String(row.role) as ChatMessageRecord['role'],
    content: String(row.content),
    thinking: row.thinking ? String(row.thinking) : undefined,
    model: row.model ? String(row.model) : undefined,
    provider: row.provider ? String(row.provider) : undefined,
    tokenInput: row.token_input == null ? undefined : Number(row.token_input),
    tokenOutput:
      row.token_output == null ? undefined : Number(row.token_output),
    sources: (row.sources as ChatMessageRecord['sources']) || [],
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: String(row.created_at),
    updatedAt: String(row.created_at),
  };
}

function messageToRow(
  input: Partial<CreateEntityInput<ChatMessageRecord>>,
): SupabaseRow {
  return {
    thread_id: input.threadId,
    role: input.role,
    content: input.content,
    thinking: input.thinking,
    model: input.model,
    provider: input.provider,
    token_input: input.tokenInput,
    token_output: input.tokenOutput,
    sources: input.sources || [],
    metadata: input.metadata || {},
  };
}
