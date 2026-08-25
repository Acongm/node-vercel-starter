export type AuthSessionView = {
  authenticated: boolean;
  configured?: boolean;
  isAnonymous?: boolean;
  user?: {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl?: string | null;
  } | null;
  userInfo?: {
    role?: string;
    tier?: string;
    email?: string | null;
    displayName?: string;
  } | null;
  accessToken?: string | null;
};

export type HealthResponse = {
  status: string;
  dataMode?: string;
  aiProvider?: string;
  aiModel?: string;
};

export type AdminTableDefinition = {
  key: string;
  table: string;
  label: string;
  description: string;
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ApiResult = {
  ok: boolean;
  status: number;
  statusText: string;
  durationMs: number;
  body: unknown;
};
