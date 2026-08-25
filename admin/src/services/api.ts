import { apiFetch } from '@/services/http';
import type {
  AdminTableDefinition,
  AuthSessionView,
  HealthResponse,
  PaginatedResponse,
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

export async function fetchChatLogs(params: {
  page?: number;
  clientId?: string;
  endpoint?: string;
}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.clientId) query.set('clientId', params.clientId);
  if (params.endpoint) query.set('endpoint', params.endpoint);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const result = await apiFetch(`/api/ai/chat/logs${suffix}`);
  if (!result.ok) {
    throw new Error(`Chat logs failed: HTTP ${result.status}`);
  }
  return result.body;
}
