import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CHAT_LOG_STORE } from '../../common/tokens';
import { DataStore } from '../../adapters/data-store/data-store.interface';
import { ClientLabelsService } from '../client-labels/client-labels.service';
import {
  ChatLogListItem,
  ChatLogRecord,
  CreateChatLogInput,
} from './chat-log-record';
import { ListChatLogsDto } from './dto/list-chat-logs.dto';

export const CHAT_LOGS_PAGE_SIZE = 50;

@Injectable()
export class ChatLogsService {
  constructor(
    @Inject(CHAT_LOG_STORE)
    private readonly chatLogs: DataStore<ChatLogRecord>,
    private readonly clientLabelsService: ClientLabelsService,
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
