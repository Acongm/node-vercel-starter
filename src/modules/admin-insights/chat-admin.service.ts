import { BadRequestException, Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import { extractTextPreviewFromParts } from './helpers/message-parts';
import { SupabaseAdminClientService } from './supabase-admin-client.service';
import { UserIdentityService } from './user-identity.service';
import { ListChatLogsDto, ListConversationsDto } from './dto/chat-admin.dto';

interface ChatRow {
  id: string;
  user_id: string;
  title: string | null;
  page_path: string | null;
  module_key: string | null;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  chat_id: string;
  user_id: string;
  role: string;
  parts: unknown;
  metadata: unknown;
  created_at: string;
}

interface ChatRunRow {
  id: string;
  chat_id: string;
  status: string;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface ChatLogRow {
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
  created_at: string;
}

interface ClientLabelRow {
  client_id: string;
  label: string;
  note: string | null;
}

@Injectable()
export class ChatAdminService {
  constructor(
    private readonly supabaseAdmin: SupabaseAdminClientService,
    private readonly userIdentity: UserIdentityService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async listConversations(query: ListConversationsDto) {
    if (!this.supabaseAdmin.isConfigured()) {
      return {
        enabled: false as const,
        reason: this.supabaseAdmin.unavailableReason(),
      };
    }

    const client = this.supabaseAdmin.getClient();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let request = client
      .from('chats')
      .select('id, user_id, title, page_path, module_key, created_at, updated_at', {
        count: 'exact',
      })
      .order('updated_at', { ascending: false })
      .range(from, to);

    const search = query.search?.trim();
    if (search) {
      const pattern = `%${escapeIlike(search)}%`;
      request = request.or(`title.ilike.${pattern},page_path.ilike.${pattern}`);
    }

    const { data, error, count } = await request;
    if (error) {
      throw new BadRequestException({
        code: 'ADMIN_CHAT_CONVERSATIONS_FAILED',
        message: error.message,
      });
    }

    const rows = (data ?? []) as ChatRow[];
    const chatIds = rows.map((row) => row.id);
    const messageCounts = await this.fetchMessageCounts(chatIds);
    const userIds = rows.map((row) => row.user_id);
    const users = await this.userIdentity.resolveMany(userIds);

    const items = rows.map((row) => {
      const user = users.get(row.user_id);
      return {
        id: row.id,
        userId: row.user_id,
        userEmail: user?.email,
        isAnonymous: user?.isAnonymous ?? false,
        title: row.title,
        pagePath: row.page_path,
        moduleKey: row.module_key,
        messageCount: messageCounts.get(row.id) ?? 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    const total = count ?? 0;
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  async getConversation(chatId: string) {
    if (!this.supabaseAdmin.isConfigured()) {
      return {
        enabled: false as const,
        reason: this.supabaseAdmin.unavailableReason(),
      };
    }

    const client = this.supabaseAdmin.getClient();

    const { data: chat, error: chatError } = await client
      .from('chats')
      .select('id, user_id, title, page_path, module_key, created_at, updated_at')
      .eq('id', chatId)
      .maybeSingle();

    if (chatError) {
      throw new BadRequestException({
        code: 'ADMIN_CHAT_CONVERSATION_FAILED',
        message: chatError.message,
      });
    }

    if (!chat) {
      throw new BadRequestException({
        code: 'ADMIN_CHAT_NOT_FOUND',
        message: `Conversation not found: ${chatId}`,
      });
    }

    const chatRow = chat as ChatRow;
    const user = await this.userIdentity.resolveUser(chatRow.user_id);

    const [messagesResult, runsResult] = await Promise.all([
      client
        .from('messages')
        .select('id, chat_id, user_id, role, parts, metadata, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true }),
      client
        .from('chat_runs')
        .select('id, chat_id, status, error_message, started_at, completed_at')
        .eq('chat_id', chatId)
        .order('started_at', { ascending: false }),
    ]);

    if (messagesResult.error) {
      throw new BadRequestException({
        code: 'ADMIN_CHAT_MESSAGES_FAILED',
        message: messagesResult.error.message,
      });
    }

    if (runsResult.error) {
      throw new BadRequestException({
        code: 'ADMIN_CHAT_RUNS_FAILED',
        message: runsResult.error.message,
      });
    }

    const messages = ((messagesResult.data ?? []) as MessageRow[]).map((row) => ({
      id: row.id,
      role: row.role,
      textPreview: extractTextPreviewFromParts(row.parts),
      parts: row.parts,
      metadata: row.metadata,
      createdAt: row.created_at,
    }));

    const runs = ((runsResult.data ?? []) as ChatRunRow[]).map((row) => ({
      id: row.id,
      status: row.status,
      error: row.error_message,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    }));

    return {
      chat: {
        id: chatRow.id,
        userId: chatRow.user_id,
        userEmail: user?.email,
        isAnonymous: user?.isAnonymous ?? false,
        title: chatRow.title,
        pagePath: chatRow.page_path,
        moduleKey: chatRow.module_key,
        createdAt: chatRow.created_at,
        updatedAt: chatRow.updated_at,
      },
      messages,
      runs,
    };
  }

  async listChatLogs(query: ListChatLogsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    if (!this.supabaseAdmin.isConfigured()) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    const client = this.supabaseAdmin.getClient();
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const table = this.config.supabase.chatLogsTable;

    let request = client
      .from(table)
      .select(
        'id, user_id, client_id, conversation_id, endpoint, user_message, assistant_message, context, sources, prompt_tokens, completion_tokens, total_tokens, created_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (query.userId) {
      request = request.eq('user_id', query.userId);
    }
    if (query.clientId) {
      request = request.eq('client_id', query.clientId);
    }
    if (query.conversationId) {
      request = request.eq('conversation_id', query.conversationId);
    }
    if (query.pagePath) {
      request = request.eq('context->>pagePath', query.pagePath);
    }
    if (query.from) {
      request = request.gte('created_at', query.from);
    }
    if (query.to) {
      request = request.lte('created_at', query.to);
    }
    const q = query.q?.trim();
    if (q) {
      const pattern = `%${escapeIlike(q)}%`;
      request = request.or(
        `user_message.ilike.${pattern},assistant_message.ilike.${pattern}`,
      );
    }

    const { data, error, count } = await request;
    if (error) {
      throw new BadRequestException({
        code: 'ADMIN_CHAT_LOGS_FAILED',
        message: error.message,
      });
    }

    const rows = (data ?? []) as ChatLogRow[];
    const userIds = rows.map((row) => row.user_id).filter((id): id is string => Boolean(id));
    const clientIds = rows.map((row) => row.client_id).filter((id): id is string => Boolean(id));

    const [users, clientLabels] = await Promise.all([
      this.userIdentity.resolveMany(userIds),
      this.fetchClientLabels(clientIds),
    ]);

    const items = rows.map((row) => {
      const user = row.user_id ? users.get(row.user_id) : undefined;
      const label = row.client_id ? clientLabels.get(row.client_id) : undefined;
      return {
        id: row.id,
        userId: row.user_id,
        userEmail: user?.email,
        isAnonymous: user?.isAnonymous ?? false,
        clientId: row.client_id,
        clientLabel: label?.label,
        conversationId: row.conversation_id,
        endpoint: row.endpoint,
        userMessage: row.user_message,
        assistantMessage: row.assistant_message,
        pagePath:
          row.context && typeof row.context.pagePath === 'string'
            ? row.context.pagePath
            : undefined,
        sources: row.sources,
        promptTokens: row.prompt_tokens,
        completionTokens: row.completion_tokens,
        totalTokens: row.total_tokens,
        createdAt: row.created_at,
      };
    });

    const total = count ?? 0;
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  private async fetchMessageCounts(chatIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (chatIds.length === 0) {
      return counts;
    }

    const client = this.supabaseAdmin.getClient();
    const { data, error } = await client
      .from('messages')
      .select('chat_id')
      .in('chat_id', chatIds);

    if (error) {
      return counts;
    }

    for (const row of data ?? []) {
      const chatId = String((row as { chat_id: string }).chat_id);
      counts.set(chatId, (counts.get(chatId) ?? 0) + 1);
    }

    return counts;
  }

  private async fetchClientLabels(
    clientIds: string[],
  ): Promise<Map<string, ClientLabelRow>> {
    const labels = new Map<string, ClientLabelRow>();
    const uniqueIds = [...new Set(clientIds)];
    if (uniqueIds.length === 0) {
      return labels;
    }

    const client = this.supabaseAdmin.getClient();
    const table = this.config.supabase.chatClientLabelsTable;
    const { data, error } = await client
      .from(table)
      .select('client_id, label, note')
      .in('client_id', uniqueIds);

    if (error) {
      return labels;
    }

    for (const row of (data ?? []) as ClientLabelRow[]) {
      labels.set(row.client_id, row);
    }

    return labels;
  }
}

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, '\\$&');
}
