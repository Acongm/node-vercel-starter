import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { APP_CONFIG, CHAT_LOG_STORE } from '../../common/tokens';
import { MemoryDataStore } from '../../adapters/data-store/memory-data-store';
import { FileDataStore } from '../../adapters/data-store/file-data-store';
import { UnsupportedDataStore } from '../../adapters/data-store/unsupported-data-store';
import {
  SupabaseDataStore,
  SupabaseRow,
} from '../../adapters/data-store/supabase-data-store';
import { CreateEntityInput } from '../../adapters/data-store/data-store.interface';
import { AdminSecretGuard } from './admin-secret.guard';
import { ChatLogRecord } from './chat-log-record';
import { ChatLogWriterService } from './chat-log-writer.service';
import { ChatLogsController } from './chat-logs.controller';
import { ChatLogsService } from './chat-logs.service';

@Module({
  controllers: [ChatLogsController],
  providers: [
    ChatLogsService,
    ChatLogWriterService,
    AdminSecretGuard,
    {
      provide: CHAT_LOG_STORE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        switch (config.dataMode) {
          case 'none':
          case 'memory':
            return new MemoryDataStore<ChatLogRecord>();
          case 'file':
            return new FileDataStore<ChatLogRecord>(config.chatLogsFilePath);
          case 'supabase':
            if (!config.supabase.url || !config.supabase.apiKey) {
              throw new Error(
                'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_API_KEY are required when DATA_MODE=supabase.',
              );
            }

            return new SupabaseDataStore<ChatLogRecord>({
              table: config.supabase.chatLogsTable,
              url: config.supabase.url,
              apiKey: config.supabase.apiKey,
              requestSecret: config.supabase.requestSecret,
              fromRow: chatLogFromSupabaseRow,
              toRow: chatLogToSupabaseRow,
            });
          default:
            return new UnsupportedDataStore<ChatLogRecord>(config.dataMode);
        }
      },
    },
  ],
  exports: [ChatLogWriterService],
})
export class ChatLogsModule {}

function chatLogFromSupabaseRow(row: SupabaseRow): ChatLogRecord {
  return {
    id: String(row.id),
    clientId: row.client_id ? String(row.client_id) : undefined,
    callSource: String(row.call_source),
    conversationId: row.conversation_id
      ? String(row.conversation_id)
      : undefined,
    endpoint: String(row.endpoint),
    requestId: row.request_id ? String(row.request_id) : undefined,
    userMessage: String(row.user_message),
    assistantMessage: String(row.assistant_message),
    context: row.context as ChatLogRecord['context'],
    provider: row.provider ? String(row.provider) : undefined,
    model: row.model ? String(row.model) : undefined,
    enableWebSearch: Boolean(row.enable_web_search),
    sources: row.sources as ChatLogRecord['sources'],
    origin: row.origin ? String(row.origin) : undefined,
    userAgent: row.user_agent ? String(row.user_agent) : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.created_at),
  };
}

function chatLogToSupabaseRow(
  input: Partial<CreateEntityInput<ChatLogRecord>>,
): SupabaseRow {
  return {
    client_id: input.clientId,
    call_source: input.callSource,
    conversation_id: input.conversationId,
    endpoint: input.endpoint,
    request_id: input.requestId,
    user_message: input.userMessage,
    assistant_message: input.assistantMessage,
    context: input.context,
    provider: input.provider,
    model: input.model,
    enable_web_search: input.enableWebSearch,
    sources: input.sources,
    origin: input.origin,
    user_agent: input.userAgent,
  };
}
