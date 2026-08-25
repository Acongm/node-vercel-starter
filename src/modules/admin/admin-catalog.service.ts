import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DataStore, EntityRecord } from '../../adapters/data-store/data-store.interface';
import {
  APP_CONFIG,
  AUTH_USER_STORE,
  CHAT_LOG_STORE,
  CHAT_MESSAGE_STORE,
  CHAT_THREAD_STORE,
  CLIENT_LABEL_STORE,
  COMMENT_STORE,
} from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { AuthUserRecord } from '../auth/auth-user-record';
import { ChatLogRecord } from '../chat-logs/chat-log-record';
import { ChatMessageRecord, ChatThreadRecord } from '../chat-threads/chat-thread-record';
import { ClientLabelRecord } from '../client-labels/client-label-record';
import { CommentRecord } from '../comments/comment-record';
import { ADMIN_TABLES, AdminTableKey, AdminTableMeta, findAdminTable } from './admin-tables';

export interface AdminTablePage {
  table: AdminTableKey;
  title: string;
  source: AdminTableMeta['source'];
  available: boolean;
  list: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class AdminCatalogService {
  private supabase: SupabaseClient | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(COMMENT_STORE) private readonly comments: DataStore<CommentRecord>,
    @Inject(CHAT_LOG_STORE) private readonly chatLogs: DataStore<ChatLogRecord>,
    @Inject(CLIENT_LABEL_STORE)
    private readonly clientLabels: DataStore<ClientLabelRecord>,
    @Inject(AUTH_USER_STORE) private readonly authUsers: DataStore<AuthUserRecord>,
    @Inject(CHAT_THREAD_STORE)
    private readonly chatThreads: DataStore<ChatThreadRecord>,
    @Inject(CHAT_MESSAGE_STORE)
    private readonly threadMessages: DataStore<ChatMessageRecord>,
  ) {}

  listTables() {
    return ADMIN_TABLES.map((table) => ({
      key: table.key,
      title: table.title,
      source: table.source,
      description: table.description,
    }));
  }

  async listRows(
    tableKey: string,
    query: { page?: number; pageSize?: number; keyword?: string },
  ): Promise<AdminTablePage> {
    const table = this.requireTable(tableKey);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const keyword = query.keyword?.trim() ?? '';

    if (table.source === 'store') {
      const rows = this.sanitizeRows(table.key, await this.listStore(table.key));
      return this.toPage(table, this.filterRows(rows, keyword), page, pageSize, true);
    }

    const { rows, available } = await this.listSupabase(table, keyword);
    return this.toPage(table, rows, page, pageSize, available);
  }

  async getRow(tableKey: string, id: string): Promise<Record<string, unknown>> {
    const table = this.requireTable(tableKey);
    if (table.source === 'store') {
      const record = await this.getStore(table.key, id);
      if (!record) {
        throw new NotFoundException(`${table.title} row not found.`);
      }
      return this.sanitizeRow(table.key, record);
    }

    const client = this.getSupabase();
    if (!client) {
      throw new ServiceUnavailableException(
        'Supabase admin read requires DATA_MODE=supabase and a service role key.',
      );
    }

    const { data, error } = await client
      .from(table.key)
      .select('*')
      .eq(table.idField, id)
      .maybeSingle();

    if (error) {
      throw new ServiceUnavailableException(error.message);
    }
    if (!data) {
      throw new NotFoundException(`${table.title} row not found.`);
    }
    return data as Record<string, unknown>;
  }

  private requireTable(tableKey: string): AdminTableMeta {
    const table = findAdminTable(tableKey);
    if (!table) {
      throw new NotFoundException(`Unknown admin table: ${tableKey}`);
    }
    return table;
  }

  private async listStore(key: AdminTableKey): Promise<EntityRecord[]> {
    switch (key) {
      case 'comments':
        return this.comments.list();
      case 'chat_logs':
        return this.chatLogs.list();
      case 'chat_client_labels':
        return this.clientLabels.list();
      case 'auth_users':
        return this.authUsers.list();
      case 'chat_threads':
        return this.chatThreads.list();
      case 'thread_messages':
        return this.threadMessages.list();
      default:
        return [];
    }
  }

  private async getStore(
    key: AdminTableKey,
    id: string,
  ): Promise<EntityRecord | null> {
    switch (key) {
      case 'comments':
        return this.comments.get(id);
      case 'chat_logs':
        return this.chatLogs.get(id);
      case 'chat_client_labels':
        return this.clientLabels.get(id);
      case 'auth_users':
        return this.authUsers.get(id);
      case 'chat_threads':
        return this.chatThreads.get(id);
      case 'thread_messages':
        return this.threadMessages.get(id);
      default:
        return null;
    }
  }

  private async listSupabase(
    table: AdminTableMeta,
    keyword: string,
  ): Promise<{ rows: Record<string, unknown>[]; available: boolean }> {
    const client = this.getSupabase();
    if (!client) {
      return { rows: [], available: false };
    }

    const query = client
      .from(table.key)
      .select('*')
      .order(table.orderBy, { ascending: false })
      .limit(keyword ? 1000 : 500);

    const { data, error } = await query;
    if (error) {
      throw new ServiceUnavailableException(
        `Failed to read ${table.key}: ${error.message}`,
      );
    }

    return {
      rows: this.filterRows((data ?? []) as Record<string, unknown>[], keyword),
      available: true,
    };
  }

  private getSupabase(): SupabaseClient | null {
    if (this.config.dataMode !== 'supabase') {
      return null;
    }
    const url = this.config.supabase.url;
    const apiKey = this.config.supabase.apiKey;
    if (!url || !apiKey) {
      return null;
    }
    if (!this.supabase) {
      this.supabase = createClient(url, apiKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });
    }
    return this.supabase;
  }

  private filterRows(
    rows: Record<string, unknown>[],
    keyword: string,
  ): Record<string, unknown>[] {
    if (!keyword) {
      return rows;
    }
    const needle = keyword.toLowerCase();
    return rows.filter((row) =>
      JSON.stringify(row).toLowerCase().includes(needle),
    );
  }

  private sanitizeRows(
    key: AdminTableKey,
    rows: EntityRecord[],
  ): Record<string, unknown>[] {
    return rows.map((row) => this.sanitizeRow(key, row));
  }

  private sanitizeRow(
    key: AdminTableKey,
    row: EntityRecord,
  ): Record<string, unknown> {
    if (key !== 'auth_users') {
      return { ...row };
    }
    const user = row as AuthUserRecord;
    const { passwordHash, ...safe } = user;
    return {
      ...safe,
      hasPassword: Boolean(passwordHash),
    };
  }

  private toPage(
    table: AdminTableMeta,
    rows: Record<string, unknown>[],
    page: number,
    pageSize: number,
    available: boolean,
  ): AdminTablePage {
    const start = (page - 1) * pageSize;
    return {
      table: table.key,
      title: table.title,
      source: table.source,
      available,
      list: rows.slice(start, start + pageSize),
      total: rows.length,
      page,
      pageSize,
    };
  }
}
