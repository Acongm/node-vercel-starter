export type RuntimeTarget = 'node' | 'vercel';
export type DataMode = 'none' | 'memory' | 'file' | 'mongo' | 'postgres' | 'redis';
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
  };
  proxyAllowlist: Record<string, string>;
}

const runtimeTargets: RuntimeTarget[] = ['node', 'vercel'];
const dataModes: DataMode[] = ['none', 'memory', 'file', 'mongo', 'postgres', 'redis'];
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

export function loadAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    appName: env.APP_NAME || 'node-vercel-starter',
    appVersion: env.APP_VERSION || '0.1.0',
    port: numberValue(env.PORT, 3000),
    runtimeTarget: enumValue(env.RUNTIME_TARGET, runtimeTargets, 'node'),
    dataMode: enumValue(env.DATA_MODE, dataModes, 'memory'),
    dataFilePath: env.DATA_FILE_PATH || '.data/comments.json',
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
    },
    proxyAllowlist: parseAllowlist(env.PROXY_ALLOWLIST),
  };
}
