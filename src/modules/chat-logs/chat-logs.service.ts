import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CHAT_LOG_STORE } from '../../common/tokens';
import { DataStore } from '../../adapters/data-store/data-store.interface';
import { ChatLogRecord, CreateChatLogInput } from './chat-log-record';
import { ListChatLogsDto } from './dto/list-chat-logs.dto';

@Injectable()
export class ChatLogsService {
  constructor(
    @Inject(CHAT_LOG_STORE)
    private readonly chatLogs: DataStore<ChatLogRecord>,
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

  async list(
    filters: ListChatLogsDto,
  ): Promise<{ items: ChatLogRecord[]; total: number }> {
    const all = await this.chatLogs.list();
    const filtered = all.filter((record) => matchesFilters(record, filters));
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 200;

    return {
      total: filtered.length,
      items: filtered.slice(offset, offset + limit),
    };
  }
}

function matchesFilters(
  record: ChatLogRecord,
  filters: ListChatLogsDto,
): boolean {
  if (filters.clientId && record.clientId !== filters.clientId) {
    return false;
  }

  if (filters.callSource && record.callSource !== filters.callSource) {
    return false;
  }

  if (
    filters.conversationId &&
    record.conversationId !== filters.conversationId
  ) {
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
