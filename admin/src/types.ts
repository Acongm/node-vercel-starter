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
  source?: 'supabase' | 'portal-static' | null;
};

export type ApiResult = {
  ok: boolean;
  status: number;
  statusText: string;
  durationMs: number;
  body: unknown;
};

export type PlatformRole = 'anonymous' | 'viewer' | 'editor' | 'admin';

export type SyncJobSummary = {
  id: string;
  job_type: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  source?: 'supabase' | 'portal-static';
};

export type AdminOverview = {
  chatsCount: number | null;
  messagesCount: number | null;
  chatLogs24hCount: number | null;
  kbAnalysisCount: number | null;
  kbChunksCount: number | null;
  kbSource?: 'supabase' | 'portal-static' | null;
  latestSyncJob: SyncJobSummary | null;
  requestLogErrorRate24h: number | null;
  chatLogsTodayCount: number | null;
};

export type AdminRouteEntry = {
  method: string;
  path: string;
  controllerName: string;
  handlerName: string;
};

export type AdminRoutesResponse = {
  items: AdminRouteEntry[];
};

export type ConversationListItem = {
  id: string;
  userId: string;
  userEmail?: string;
  isAnonymous: boolean;
  title: string | null;
  pagePath: string | null;
  moduleKey: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ConversationDetailChat = {
  id: string;
  userId: string;
  userEmail?: string;
  isAnonymous: boolean;
  title: string | null;
  pagePath: string | null;
  moduleKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationMessage = {
  id: string;
  role: string;
  textPreview: string;
  parts: unknown;
  metadata: unknown;
  createdAt: string;
};

export type ConversationRun = {
  id: string;
  status: string;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type ConversationDetail = {
  chat: ConversationDetailChat;
  messages: ConversationMessage[];
  runs: ConversationRun[];
};

export type ChatLogSource = {
  url?: string;
  title?: string;
  [key: string]: unknown;
};

export type AdminChatLogItem = {
  id: string;
  userId: string | null;
  userEmail?: string;
  isAnonymous: boolean;
  clientId: string | null;
  clientLabel?: string;
  anonKey?: string;
  userAgent?: string;
  origin?: string;
  conversationId: string | null;
  endpoint: string;
  userMessage: string;
  assistantMessage: string;
  pagePath?: string;
  sources: unknown;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  createdAt: string;
};

export type ClientLabelRecord = {
  id: string;
  clientId: string;
  label: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
};

export type SyncJobRow = {
  id: string;
  job_type: string;
  status: string;
  trigger_source: string;
  payload: unknown;
  result: unknown;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  source?: 'supabase' | 'portal-static';
};

export type SyncFailureRow = {
  id: string;
  job_id: string | null;
  path: string | null;
  failure_code: string;
  reason: string;
  context: unknown;
  retry_count: number;
  next_retry_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

export type KbAnalysisRow = {
  id: string;
  path: string;
  title: string | null;
  summary: string | null;
  key_points?: string[];
  keywords: unknown;
  tech_stack?: string[];
  difficulty: string | null;
  content_type: string | null;
  status?: string | null;
  created_at: string;
  updated_at: string;
  source?: 'supabase' | 'portal-static';
};

export type KbChunkRow = {
  id: string;
  path: string;
  chunk_index: number;
  content: string;
  heading: string | null;
  token_count: number | null;
  created_at: string;
};

export type KbCoverageItem = {
  path: string;
  chunkCount: number;
  tokenSum: number;
};

export type KbCountAggregate = {
  key: string;
  count: number;
};

export type KbUsageResponse = {
  coverage: KbCoverageItem[];
  chatPages: KbCountAggregate[];
  citations: KbCountAggregate[];
  days: number;
  limit: number;
};

export type PlatformUserItem = {
  id: string;
  email?: string;
  providers: string[];
  role: PlatformRole;
  isAnonymous: boolean;
  createdAt?: string;
  lastSignInAt?: string;
  cid?: string;
  hasChats?: boolean;
  isGhost?: boolean;
};

export type PlatformUsersDisabled = {
  enabled: false;
  reason: string;
};

export type PlatformUsersEnabled = {
  enabled: true;
  items: PlatformUserItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  ghostCount?: number;
  activeCount?: number;
};

export type PlatformUsersResponse = PlatformUsersDisabled | PlatformUsersEnabled;

export type LocalAuthUserRow = {
  id: string;
  email: string;
  username: string | null;
  provider: string;
  provider_user_id: string | null;
  role: string;
  name: string | null;
  avatar_url: string | null;
  disabled: boolean;
  created_at: string;
  updated_at: string;
};

export type RequestLogRow = {
  id: number;
  request_id: string | null;
  method: string;
  path: string;
  status_code: number;
  duration_ms: number;
  user_id: string | null;
  client_id: string | null;
  call_source: string | null;
  caller_kind: string | null;
  route_group?: string | null;
  is_stream?: boolean;
  origin: string | null;
  user_agent: string | null;
  error_message: string | null;
  created_at: string;
};

export type RequestLogsDisabled = {
  enabled: false;
  reason?: 'migration_missing' | string;
};

export type RequestLogsEnabled = {
  enabled: true;
  items: RequestLogRow[];
};

export type RequestLogsResponse = RequestLogsDisabled | RequestLogsEnabled;

export type RequestLogPathStat = {
  method: string;
  path: string;
  count: number;
  avg_duration_ms: number;
  p95_ms?: number;
  errors: number;
};

export type RequestLogRouteGroupStat = {
  route_group: string;
  count: number;
  avg_duration_ms: number;
  p95_ms?: number;
  errors: number;
};

export type RequestLogDimensionStat = {
  count: number;
  avg_duration_ms: number;
};

export type RequestLogCallerKindStat = RequestLogDimensionStat & {
  caller_kind: string;
};

export type RequestLogCallSourceStat = RequestLogDimensionStat & {
  call_source: string;
};

export type RequestLogStats = {
  window: '24h' | '7d' | '30d';
  since: string;
  total: number;
  avgDurationMs: number;
  errorCount: number;
  errorRate: number;
  excludeStream?: boolean;
  byPath: RequestLogPathStat[];
  byRouteGroup?: RequestLogRouteGroupStat[];
  byCallerKind: RequestLogCallerKindStat[];
  byCallSource: RequestLogCallSourceStat[];
};

export type RequestLogStatsDisabled = {
  enabled: false;
  reason?: 'migration_missing' | 'stats_fn_missing' | string;
};

export type RequestLogStatsEnabled = {
  enabled: true;
  stats: RequestLogStats;
};

export type RequestLogStatsResponse = RequestLogStatsDisabled | RequestLogStatsEnabled;
