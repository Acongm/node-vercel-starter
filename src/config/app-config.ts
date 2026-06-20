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

export interface AppConfig {
  appName: string;
  appVersion: string;
  port: number;
  runtimeTarget: RuntimeTarget;
  dataMode: DataMode;
  dataFilePath: string;
  chatLogsFilePath: string;
  fileMode: FileMode;
  uploadDir: string;
  auth: {
    mode: AuthMode;
    jwtSecret: string;
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
    apiKey?: string;
    requestSecret?: string;
    commentsTable: string;
    chatLogsTable: string;
  };
  chatLogs: {
    adminUsername?: string;
    adminPassword?: string;
    sessionSecret?: string;
    sessionTtl: string;
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
    fileMode: enumValue(env.FILE_MODE, fileModes, 'memory'),
    uploadDir: env.UPLOAD_DIR || 'uploads',
    auth: {
      mode: enumValue(env.AUTH_MODE, authModes, 'none'),
      jwtSecret: env.AUTH_JWT_SECRET || 'change-me',
    },
    ai: {
      provider: enumValue(env.AI_PROVIDER, aiProviders, 'mock'),
      apiKey: env.AI_API_KEY,
      baseUrl: (env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, ''),
      model: env.AI_MODEL || 'gpt-4.1-mini',
      webSearchApiKey: env.WEB_SEARCH_API_KEY || env.TAVILY_API_KEY,
    },
    corsOrigins: parseList(env.CORS_ORIGINS || 'https://acongm.com,https://*.acongm.com'),
    proxyAllowlist: parseAllowlist(env.PROXY_ALLOWLIST),
    supabase: {
      url: env.SUPABASE_URL,
      apiKey: env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_API_KEY,
      requestSecret: env.SUPABASE_REQUEST_SECRET,
      commentsTable: env.SUPABASE_COMMENTS_TABLE || 'comments',
      chatLogsTable: env.SUPABASE_CHAT_LOGS_TABLE || 'chat_logs',
    },
    chatLogs: {
      adminUsername: env.CHAT_LOGS_ADMIN_USERNAME,
      adminPassword: env.CHAT_LOGS_ADMIN_PASSWORD,
      sessionSecret:
        env.CHAT_LOGS_SESSION_SECRET || env.AUTH_JWT_SECRET || 'change-me',
      sessionTtl: env.CHAT_LOGS_SESSION_TTL || '7d',
    },
  };
}
