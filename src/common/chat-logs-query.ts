import type { SupabaseClient } from '@supabase/supabase-js';

export interface ChatLogsQueryInput {
  page?: number;
  pageSize?: number;
  userId?: string;
  clientId?: string;
  conversationId?: string;
  pagePath?: string;
  from?: string;
  to?: string;
  q?: string;
}

export interface ChatLogQueryRow {
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
}

export interface ChatLogsQueryResult {
  rows: ChatLogQueryRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const CHAT_LOG_SELECT =
  'id, user_id, client_id, conversation_id, endpoint, user_message, assistant_message, context, sources, prompt_tokens, completion_tokens, total_tokens, origin, user_agent, created_at';

export async function queryChatLogsPage(
  client: SupabaseClient,
  table: string,
  query: ChatLogsQueryInput,
): Promise<ChatLogsQueryResult> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let request = client
    .from(table)
    .select(CHAT_LOG_SELECT, { count: 'exact' })
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
    throw new Error(`Failed to query chat logs: ${error.message}`);
  }

  const total = count ?? 0;
  return {
    rows: (data ?? []) as ChatLogQueryRow[],
    total,
    page,
    pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, '\\$&');
}
