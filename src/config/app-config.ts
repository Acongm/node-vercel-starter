import { knownPublicKeyForSupabaseUrl } from './acongm-supabase-public';

export type RuntimeTarget = 'node' | 'vercel';
export type DataMode =
  | 'none'
  | 'memory'
  | 'file'
  | 'mongo'
  | 'postgres'
  | 'redis'
  | 'supabase';
export type FileMode = 'memory' | 'local' | 'vercel-blob' | 's3';
export type AuthMode = 'none' | 'jwt' | 'external';
export type AiProvider = 'mock' | 'openai' | 'custom';

export const DEFAULT_AI_MODEL = 'deepseek-v4-flash';

export interface AppConfig {
  appName: string;
  appVersion: string;
  port: number;
  runtimeTarget: RuntimeTarget;
  dataMode: DataMode;
  dataFilePath: string;
  chatLogsFilePath: string;
  chatThreadsFilePath: string;
  chatMessagesFilePath: string;
  clientLabelsFilePath: string;
  authUsersFilePath: string;
  fileMode: FileMode;
  uploadDir: string;
  siteConfigPath: string;
  auth: {
    mode: AuthMode;
    jwtSecret: string;
    /** HS256 secret for Supabase access tokens (legacy JWT secret). */
    supabaseJwtSecret?: string;
    adminUsername?: string;
    adminPassword?: string;
    sessionTtl: string;
    oauth: {
      githubClientId?: string;
      githubClientSecret?: string;
      googleClientId?: string;
      googleClientSecret?: string;
      /** Public API origin used to build OAuth callback URLs. */
      redirectBase?: string;
    };
  };
  ai: {
    provider: AiProvider;
    apiKey?: string;
    baseUrl: string;
    model: string;
    webSearchApiKey?: string;
  };
  corsOrigins: string[];
  proxyAllowlist: Record<string, string>;
  supabase: {
    url?: string;
    /** Publishable/anon key used for end-user Auth/RLS scoped requests. */
    publicKey?: string;
    /** Server-side API key; service role is allowed only for trusted backend tasks. */
    apiKey?: string;
    requestSecret?: string;
    commentsTable: string;
    chatLogsTable: string;
    chatClientLabelsTable: string;
    authUsersTable: string;
  };
}

const runtimeTargets: RuntimeTarget[] = ['node', 'vercel'];
const dataModes: DataMode[] = [
  'none',
  'memory',
  'file',
  'mongo',
  'postgres',
  'redis',
  'supabase',
];
const fileModes: FileMode[] = ['memory', 'local', 'vercel-blob', 's3'];
const authModes: AuthMode[] = ['none', 'jwt', 'external'];
const aiProviders: AiProvider[] = ['mock', 'openai', 'custom'];

function enumValue<T extends string>(value: string | undefined, allowed: T[], fallback: T): T {
  return value && allowed.includes(value as T) ? (value as T) : fallback;
}

function numberValue(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseAllowlist(raw: string | undefined): Record<string, string> {
  if (!raw) {
    return {};
  }

  return raw.split(',').reduce<Record<string, string>>((acc, item) => {
    const [provider, ...urlParts] = item.trim().split('=');
    const url = urlParts.join('=');
    if (provider && url && URL.canParse(url)) {
      acc[provider] = url.replace(/\/+$/, '');
    }
    return acc;
  }, {});
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(json) as unknown;
    return payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** True only for publishable/anon keys. Service-role / secret keys stay server-only. */
export function isBrowserSafeSupabaseKey(value: string | undefined): boolean {
  const key = value?.trim();
  if (!key) return false;
  if (key.startsWith('sb_secret_')) return false;
  if (key.startsWith('sb_publishable_')) return true;
  if (!key.startsWith('eyJ')) return false;
  const role = decodeJwtPayload(key)?.role;
  return role === 'anon';
}

function firstBrowserSafeKey(
  ...values: Array<string | undefined>
): string | undefined {
  return values.find((value) => isBrowserSafeSupabaseKey(value))?.trim();
}

function parseList(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    appName: env.APP_NAME || 'node-vercel-starter',
    appVersion: env.APP_VERSION || '0.1.0',
    port: numberValue(env.PORT, 3000),
    runtimeTarget: enumValue(env.RUNTIME_TARGET, runtimeTargets, 'node'),
    dataMode: enumValue(env.DATA_MODE, dataModes, 'memory'),
    dataFilePath: env.DATA_FILE_PATH || '.data/comments.json',
    chatLogsFilePath: env.CHAT_LOGS_FILE_PATH || '.data/chat-logs.json',
    chatThreadsFilePath:
      env.CHAT_THREADS_FILE_PATH || '.data/chat-threads.json',
    chatMessagesFilePath:
      env.CHAT_MESSAGES_FILE_PATH || '.data/chat-messages.json',
    clientLabelsFilePath:
      env.CLIENT_LABELS_FILE_PATH || '.data/chat-client-labels.json',
    authUsersFilePath: env.AUTH_USERS_FILE_PATH || '.data/auth-users.json',
    fileMode: enumValue(env.FILE_MODE, fileModes, 'memory'),
    uploadDir: env.UPLOAD_DIR || 'uploads',
    siteConfigPath: env.SITE_CONFIG_PATH || 'site.config.yaml',
    auth: {
      mode: enumValue(env.AUTH_MODE, authModes, 'none'),
      jwtSecret: env.AUTH_JWT_SECRET || 'change-me',
      supabaseJwtSecret:
        env.SUPABASE_JWT_SECRET || env.AUTH_SUPABASE_JWT_SECRET,
      adminUsername: env.AUTH_ADMIN_USERNAME,
      adminPassword: env.AUTH_ADMIN_PASSWORD,
      sessionTtl: env.AUTH_SESSION_TTL || '7d',
      oauth: {
        githubClientId: env.AUTH_GITHUB_CLIENT_ID,
        githubClientSecret: env.AUTH_GITHUB_CLIENT_SECRET,
        googleClientId: env.AUTH_GOOGLE_CLIENT_ID,
        googleClientSecret: env.AUTH_GOOGLE_CLIENT_SECRET,
        redirectBase: env.AUTH_OAUTH_REDIRECT_BASE || env.PUBLIC_API_BASE,
      },
    },
    ai: {
      provider: enumValue(env.AI_PROVIDER, aiProviders, 'mock'),
      apiKey: env.AI_API_KEY,
      baseUrl: (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
      model: env.AI_MODEL || DEFAULT_AI_MODEL,
      webSearchApiKey: env.WEB_SEARCH_API_KEY || env.TAVILY_API_KEY,
    },
    corsOrigins: parseList(env.CORS_ORIGINS || 'https://acongm.com,https://*.acongm.com'),
    proxyAllowlist: parseAllowlist(env.PROXY_ALLOWLIST),
    supabase: {
      url: env.SUPABASE_URL,
      publicKey:
        firstBrowserSafeKey(
          env.SUPABASE_PUBLISHABLE_KEY,
          env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          env.SUPABASE_ANON_KEY,
          env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          env.SUPABASE_API_KEY,
        ) || knownPublicKeyForSupabaseUrl(env.SUPABASE_URL),
      apiKey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_API_KEY,
      requestSecret: env.SUPABASE_REQUEST_SECRET,
      commentsTable: env.SUPABASE_COMMENTS_TABLE || 'comments',
      chatLogsTable: env.SUPABASE_CHAT_LOGS_TABLE || 'chat_logs',
      chatClientLabelsTable:
        env.SUPABASE_CHAT_CLIENT_LABELS_TABLE || 'chat_client_labels',
      authUsersTable: env.SUPABASE_AUTH_USERS_TABLE || 'auth_users',
    },
  };
}
