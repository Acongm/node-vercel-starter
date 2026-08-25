import { apiFetch } from '@/services/http';
import type {
  AdminOverview,
  AdminRouteEntry,
  AdminRoutesResponse,
  AdminTableDefinition,
  AuthSessionView,
  ClientLabelRecord,
  ConversationDetail,
  ConversationListItem,
  HealthResponse,
  KbAnalysisRow,
  KbChunkRow,
  KbUsageResponse,
  LocalAuthUserRow,
  PaginatedResponse,
  PlatformUsersResponse,
  RequestLogsResponse,
  RequestLogStatsResponse,
  RequestLogPathSort,
  RequestLogSortOrder,
  SyncFailureRow,
  SyncJobRow,
  AdminChatLogItem,
} from '@/types';

export async function fetchSession(): Promise<AuthSessionView> {
  const result = await apiFetch('/api/auth/session');
  if (!result.ok) {
    return { authenticated: false };
  }
  return result.body as AuthSessionView;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const result = await apiFetch('/api/health');
  if (!result.ok) {
    throw new Error(`Health check failed: HTTP ${result.status}`);
  }
  return result.body as HealthResponse;
}

export async function fetchAuthMode() {
  const result = await apiFetch('/api/auth/mode');
  if (!result.ok) {
    throw new Error(`Auth mode failed: HTTP ${result.status}`);
  }
  return result.body;
}

export async function fetchAdminTables(): Promise<AdminTableDefinition[]> {
  const result = await apiFetch('/api/admin/tables');
  if (!result.ok) {
    throw new Error(`Admin tables failed: HTTP ${result.status}`);
  }
  const body = result.body as { items?: AdminTableDefinition[] };
  return body.items ?? [];
}

export async function fetchAdminTableRows(
  tableKey: string,
  params: { page?: number; pageSize?: number; search?: string },
): Promise<PaginatedResponse<Record<string, unknown>> & { table: AdminTableDefinition }> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await apiFetch(`/api/admin/tables/${tableKey}${suffix}`);
  if (!result.ok) {
    throw new Error(`Table query failed: HTTP ${result.status}`);
  }
  return result.body as PaginatedResponse<Record<string, unknown>> & {
    table: AdminTableDefinition;
  };
}

export async function fetchOverview(): Promise<AdminOverview> {
  const result = await apiFetch('/api/admin/overview');
  if (!result.ok) {
    throw new Error(`Overview failed: HTTP ${result.status}`);
  }
  return result.body as AdminOverview;
}

export async function fetchAdminRoutes(): Promise<AdminRouteEntry[]> {
  const result = await apiFetch('/api/admin/routes');
  if (!result.ok) {
    throw new Error(`Routes failed: HTTP ${result.status}`);
  }
  const body = result.body as AdminRoutesResponse;
  return body.items ?? [];
}

export async function fetchConversations(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<PaginatedResponse<ConversationListItem>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await apiFetch(`/api/admin/chat/conversations${suffix}`);
  if (!result.ok) {
    throw new Error(`Conversations failed: HTTP ${result.status}`);
  }
  return result.body as PaginatedResponse<ConversationListItem>;
}

export async function fetchConversationDetail(
  chatId: string,
): Promise<ConversationDetail> {
  const result = await apiFetch(`/api/admin/chat/conversations/${chatId}`);
  if (!result.ok) {
    throw new Error(`Conversation detail failed: HTTP ${result.status}`);
  }
  return result.body as ConversationDetail;
}

export async function fetchAdminChatLogs(params: {
  page?: number;
  pageSize?: number;
  userId?: string;
  clientId?: string;
  conversationId?: string;
  pagePath?: string;
  q?: string;
  from?: string;
  to?: string;
}): Promise<PaginatedResponse<AdminChatLogItem>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.userId) query.set('userId', params.userId);
  if (params.clientId) query.set('clientId', params.clientId);
  if (params.conversationId) query.set('conversationId', params.conversationId);
  if (params.pagePath) query.set('pagePath', params.pagePath);
  if (params.q) query.set('q', params.q);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await apiFetch(`/api/admin/chat/logs${suffix}`);
  if (!result.ok) {
    throw new Error(`Chat logs failed: HTTP ${result.status}`);
  }
  return result.body as PaginatedResponse<AdminChatLogItem>;
}

export async function fetchClientLabels(): Promise<ClientLabelRecord[]> {
  const result = await apiFetch('/api/ai/chat/client-labels');
  if (!result.ok) {
    throw new Error(`Client labels failed: HTTP ${result.status}`);
  }
  return result.body as ClientLabelRecord[];
}

export async function createClientLabel(input: {
  clientId: string;
  label: string;
  note?: string;
}): Promise<ClientLabelRecord> {
  const result = await apiFetch('/api/ai/chat/client-labels', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!result.ok) {
    throw new Error(`Create client label failed: HTTP ${result.status}`);
  }
  return result.body as ClientLabelRecord;
}

export async function updateClientLabel(
  clientId: string,
  input: { label?: string; note?: string },
): Promise<ClientLabelRecord> {
  const result = await apiFetch(`/api/ai/chat/client-labels/${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!result.ok) {
    throw new Error(`Update client label failed: HTTP ${result.status}`);
  }
  return result.body as ClientLabelRecord;
}

export async function deleteClientLabel(clientId: string): Promise<void> {
  const result = await apiFetch(`/api/ai/chat/client-labels/${clientId}`, {
    method: 'DELETE',
  });
  if (!result.ok && result.status !== 204) {
    throw new Error(`Delete client label failed: HTTP ${result.status}`);
  }
}

export async function fetchKbJobs(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  jobType?: string;
}): Promise<PaginatedResponse<SyncJobRow>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.status) query.set('status', params.status);
  if (params.jobType) query.set('jobType', params.jobType);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await apiFetch(`/api/admin/kb/jobs${suffix}`);
  if (!result.ok) {
    throw new Error(`KB jobs failed: HTTP ${result.status}`);
  }
  return result.body as PaginatedResponse<SyncJobRow>;
}

export async function fetchKbFailures(params: {
  page?: number;
  pageSize?: number;
  path?: string;
}): Promise<PaginatedResponse<SyncFailureRow>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.path) query.set('path', params.path);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await apiFetch(`/api/admin/kb/failures${suffix}`);
  if (!result.ok) {
    throw new Error(`KB failures failed: HTTP ${result.status}`);
  }
  return result.body as PaginatedResponse<SyncFailureRow>;
}

export async function fetchKbAnalysis(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<PaginatedResponse<KbAnalysisRow>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await apiFetch(`/api/admin/kb/analysis${suffix}`);
  if (!result.ok) {
    throw new Error(`KB analysis failed: HTTP ${result.status}`);
  }
  return result.body as PaginatedResponse<KbAnalysisRow>;
}

export async function fetchKbChunks(params: {
  path: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<KbChunkRow>> {
  const query = new URLSearchParams();
  query.set('path', params.path);
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const suffix = `?${query.toString()}`;
  const result = await apiFetch(`/api/admin/kb/chunks${suffix}`);
  if (!result.ok) {
    throw new Error(`KB chunks failed: HTTP ${result.status}`);
  }
  return result.body as PaginatedResponse<KbChunkRow>;
}

export async function fetchKbUsage(params: {
  days?: number;
  limit?: number;
}): Promise<KbUsageResponse> {
  const query = new URLSearchParams();
  if (params.days) query.set('days', String(params.days));
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await apiFetch(`/api/admin/kb/usage${suffix}`);
  if (!result.ok) {
    throw new Error(`KB usage failed: HTTP ${result.status}`);
  }
  return result.body as KbUsageResponse;
}

export async function fetchPlatformUsers(params: {
  page?: number;
  pageSize?: number;
  anonymous?: 'true' | 'false';
  q?: string;
  activity?: 'active' | 'ghost' | 'all';
}): Promise<PlatformUsersResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  if (params.anonymous) query.set('anonymous', params.anonymous);
  if (params.q) query.set('q', params.q);
  if (params.activity) query.set('activity', params.activity);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await apiFetch(`/api/admin/users${suffix}`);
  if (!result.ok) {
    throw new Error(`Platform users failed: HTTP ${result.status}`);
  }
  return result.body as PlatformUsersResponse;
}

export type PurgeGhostUsersResponse =
  | { enabled: false; reason: string }
  | {
      enabled: true;
      dryRun: boolean;
      deleted: number;
      skipped: number;
      candidateCount: number;
      ids: string[];
    };

export async function purgeGhostUsers(params?: {
  dryRun?: boolean;
}): Promise<PurgeGhostUsersResponse> {
  const query = new URLSearchParams();
  if (params?.dryRun) query.set('dryRun', 'true');
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await apiFetch(`/api/admin/users/purge-ghosts${suffix}`, {
    method: 'POST',
  });
  if (!result.ok) {
    throw new Error(`Purge ghosts failed: HTTP ${result.status}`);
  }
  return result.body as PurgeGhostUsersResponse;
}

export async function fetchLocalUsers(params: {
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResponse<LocalAuthUserRow>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await apiFetch(`/api/admin/users/local${suffix}`);
  if (!result.ok) {
    throw new Error(`Local users failed: HTTP ${result.status}`);
  }
  return result.body as PaginatedResponse<LocalAuthUserRow>;
}

export async function fetchRequestLogs(params: {
  sinceId?: number;
  path?: string;
  status?: number;
  limit?: number;
}): Promise<RequestLogsResponse> {
  const query = new URLSearchParams();
  if (params.sinceId) query.set('sinceId', String(params.sinceId));
  if (params.path) query.set('path', params.path);
  if (params.status !== undefined) query.set('status', String(params.status));
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await apiFetch(`/api/admin/request-logs${suffix}`);
  if (!result.ok) {
    throw new Error(`Request logs failed: HTTP ${result.status}`);
  }
  return result.body as RequestLogsResponse;
}

export async function fetchRequestLogStats(
  window: '24h' | '7d' | '30d',
  options: {
    excludeStream?: boolean;
    pathSort?: RequestLogPathSort;
    pathSortOrder?: RequestLogSortOrder;
    pathLimit?: number;
  } = {},
): Promise<RequestLogStatsResponse> {
  const query = new URLSearchParams({
    window,
    excludeStream: String(options.excludeStream ?? true),
    pathSort: options.pathSort ?? 'p95',
    pathSortOrder: options.pathSortOrder ?? 'desc',
    pathLimit: String(options.pathLimit ?? 50),
  });
  const result = await apiFetch(`/api/admin/request-logs/stats?${query.toString()}`);
  if (!result.ok) {
    throw new Error(`Request log stats failed: HTTP ${result.status}`);
  }
  return result.body as RequestLogStatsResponse;
}
