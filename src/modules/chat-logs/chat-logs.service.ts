import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { CHAT_LOG_STORE, APP_CONFIG } from '../../common/tokens';
import { DataStore } from '../../adapters/data-store/data-store.interface';
import { AppConfig } from '../../config/app-config';
import { ClientLabelsService } from '../client-labels/client-labels.service';
import { SupabaseAdminClientService } from '../admin-insights/supabase-admin-client.service';
import {
  ChatLogListItem,
  ChatLogRecord,
  CreateChatLogInput,
} from './chat-log-record';
import { ListChatLogsDto } from './dto/list-chat-logs.dto';
import { queryChatLogsPage } from '../../common/chat-logs-query';

export const CHAT_LOGS_PAGE_SIZE = 50;

@Injectable()
export class ChatLogsService {
  constructor(
    @Inject(CHAT_LOG_STORE)
    private readonly chatLogs: DataStore<ChatLogRecord>,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly clientLabelsService: ClientLabelsService,
    @Optional() private readonly supabaseAdmin?: SupabaseAdminClientService,
  ) {}

  create(input: CreateChatLogInput): Promise<ChatLogRecord> {
    return this.chatLogs.create(input);
  }

  async get(id: string): Promise<ChatLogRecord> {
    const record = await this.chatLogs.get(id);
    if (!record) {
      throw new NotFoundException('Chat log not found.');
    }
    return record;
  }

  async list(filters: ListChatLogsDto): Promise<{
    items: ChatLogListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    if (
      this.config.dataMode === 'supabase' &&
      this.supabaseAdmin?.isConfigured()
    ) {
      return this.listFromSupabase(filters);
    }

    return this.listFromMemory(filters);
  }

  private async listFromSupabase(filters: ListChatLogsDto) {
    const client = this.supabaseAdmin!.getClient();
    const table = this.config.supabase.chatLogsTable;
    const result = await queryChatLogsPage(client, table, {
      page: filters.page,
      pageSize: CHAT_LOGS_PAGE_SIZE,
      clientId: filters.clientId,
      conversationId: filters.conversationId,
      pagePath: filters.pagePath,
      from: filters.from,
      to: filters.to,
    });

    const pageItems = result.rows.map((row) => mapQueryRowToRecord(row));
    const labelMap = await this.clientLabelsService.mapByClientIds(
      pageItems.map((record) => record.clientId ?? ''),
    );

    const items = pageItems.map((record) => {
      const clientLabel = record.clientId
        ? labelMap.get(record.clientId)
        : undefined;
      return clientLabel ? { ...record, clientLabel } : record;
    });

    return {
      items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }

  private async listFromMemory(filters: ListChatLogsDto) {
    const all = await this.chatLogs.list();
    const filtered = all.filter((record) => matchesFilters(record, filters));
    const page = filters.page ?? 1;
    const pageSize = CHAT_LOGS_PAGE_SIZE;
    const total = filtered.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);
    const labelMap = await this.clientLabelsService.mapByClientIds(
      pageItems.map((record) => record.clientId ?? ''),
    );

    const items = pageItems.map((record) => {
      const clientLabel = record.clientId
        ? labelMap.get(record.clientId)
        : undefined;
      return clientLabel ? { ...record, clientLabel } : record;
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}

function mapQueryRowToRecord(row: {
  id: string;
  user_id: string | null;
  client_id: string | null;
  conversation_id: string | null;
  endpoint: string;
  user_message: string;
  assistant_message: string;
  context: Record<string, unknown> | null;
  sources: unknown;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  origin: string | null;
  user_agent: string | null;
  created_at: string;
}): ChatLogRecord {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    clientId: row.client_id ?? undefined,
    callSource: 'unknown',
    conversationId: row.conversation_id ?? undefined,
    endpoint: row.endpoint,
    userMessage: row.user_message,
    assistantMessage: row.assistant_message,
    enableWebSearch: false,
    context: row.context as ChatLogRecord['context'],
    sources: row.sources as ChatLogRecord['sources'],
    promptTokens: row.prompt_tokens ?? undefined,
    completionTokens: row.completion_tokens ?? undefined,
    totalTokens: row.total_tokens ?? undefined,
    origin: row.origin ?? undefined,
    userAgent: row.user_agent ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.created_at,
  };
}

function matchesFilters(
  record: ChatLogRecord,
  filters: ListChatLogsDto,
): boolean {
  if (filters.clientId && record.clientId !== filters.clientId) {
    return false;
  }

  if (
    filters.conversationId &&
    record.conversationId !== filters.conversationId
  ) {
    return false;
  }

  if (filters.endpoint && record.endpoint !== filters.endpoint) {
    return false;
  }

  if (
    filters.pagePath &&
    record.context?.pagePath !== filters.pagePath
  ) {
    return false;
  }

  if (filters.from && record.createdAt < filters.from) {
    return false;
  }

  if (filters.to && record.createdAt > filters.to) {
    return false;
  }

  return true;
}
