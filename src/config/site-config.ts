import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load as loadYaml } from 'js-yaml';

export interface SiteDomainsConfig {
  portal: string;
  dochub: string;
  chat: string;
  auth: string;
  api: string;
}

export interface SiteGitConfig {
  owner: string;
  repo: string;
  contentDir: string;
  defaultBranch: string;
  publishBranch: string;
}

export interface SiteLimitBucket {
  chatPerDay: number;
}

export interface SiteLimitsConfig {
  anon: SiteLimitBucket;
  user: SiteLimitBucket;
}

export type OAuthProviderId = 'github' | 'google';

export interface SiteOAuthConfig {
  providers: OAuthProviderId[];
  claimThreads: boolean;
}

/**
 * Shared site config schema with auth packages/config (@acongm/config).
 * Keep field names stable across auth and api.
 */
export interface SiteConfig {
  domains: SiteDomainsConfig;
  git: SiteGitConfig;
  limits: SiteLimitsConfig;
  oauth: SiteOAuthConfig;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  domains: {
    portal: 'https://www.acongm.com',
    dochub: 'https://dochub.acongm.com',
    chat: 'https://chat.acongm.com',
    auth: 'https://auth.acongm.com',
    api: 'https://api.acongm.com',
  },
  git: {
    owner: 'Acongm',
    repo: 'portal',
    contentDir: 'content/docs',
    defaultBranch: 'master',
    publishBranch: 'master',
  },
  limits: {
    anon: { chatPerDay: 20 },
    user: { chatPerDay: 200 },
  },
  oauth: {
    providers: ['github', 'google'],
    claimThreads: true,
  },
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function positiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function normalizeProviders(value: unknown): OAuthProviderId[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [...DEFAULT_SITE_CONFIG.oauth.providers];
  }
  const allowed: OAuthProviderId[] = [];
  for (const item of value) {
    if (item === 'github' || item === 'google') allowed.push(item);
  }
  return allowed.length ? allowed : [...DEFAULT_SITE_CONFIG.oauth.providers];
}

function normalizeSiteConfig(raw: unknown): SiteConfig {
  const root = asRecord(raw);
  const domains = asRecord(root.domains);
  const git = asRecord(root.git);
  const limits = asRecord(root.limits);
  const anon = asRecord(limits.anon);
  const user = asRecord(limits.user);
  const oauth = asRecord(root.oauth);

  return {
    domains: {
      portal: stringValue(domains.portal, DEFAULT_SITE_CONFIG.domains.portal),
      dochub: stringValue(domains.dochub, DEFAULT_SITE_CONFIG.domains.dochub),
      chat: stringValue(domains.chat, DEFAULT_SITE_CONFIG.domains.chat),
      auth: stringValue(domains.auth, DEFAULT_SITE_CONFIG.domains.auth),
      api: stringValue(domains.api, DEFAULT_SITE_CONFIG.domains.api),
    },
    git: {
      owner: stringValue(git.owner, DEFAULT_SITE_CONFIG.git.owner),
      repo: stringValue(git.repo, DEFAULT_SITE_CONFIG.git.repo),
      contentDir: stringValue(git.contentDir, DEFAULT_SITE_CONFIG.git.contentDir),
      defaultBranch: stringValue(
        git.defaultBranch,
        DEFAULT_SITE_CONFIG.git.defaultBranch,
      ),
      publishBranch: stringValue(
        git.publishBranch,
        DEFAULT_SITE_CONFIG.git.publishBranch,
      ),
    },
    limits: {
      anon: {
        chatPerDay: positiveInt(
          anon.chatPerDay,
          DEFAULT_SITE_CONFIG.limits.anon.chatPerDay,
        ),
      },
      user: {
        chatPerDay: positiveInt(
          user.chatPerDay,
          DEFAULT_SITE_CONFIG.limits.user.chatPerDay,
        ),
      },
    },
    oauth: {
      providers: normalizeProviders(oauth.providers),
      claimThreads:
        typeof oauth.claimThreads === 'boolean'
          ? oauth.claimThreads
          : DEFAULT_SITE_CONFIG.oauth.claimThreads,
    },
  };
}

function applyEnvOverrides(
  config: SiteConfig,
  env: NodeJS.ProcessEnv,
): SiteConfig {
  const providersRaw = env.SITE_OAUTH_PROVIDERS;
  return {
    domains: {
      portal: stringValue(env.SITE_DOMAIN_PORTAL, config.domains.portal),
      dochub: stringValue(env.SITE_DOMAIN_DOCHUB, config.domains.dochub),
      chat: stringValue(env.SITE_DOMAIN_CHAT, config.domains.chat),
      auth: stringValue(env.SITE_DOMAIN_AUTH, config.domains.auth),
      api: stringValue(env.SITE_DOMAIN_API, config.domains.api),
    },
    git: {
      owner: stringValue(env.SITE_GIT_OWNER, config.git.owner),
      repo: stringValue(env.SITE_GIT_REPO, config.git.repo),
      contentDir: stringValue(env.SITE_GIT_CONTENT_DIR, config.git.contentDir),
      defaultBranch: stringValue(
        env.SITE_GIT_DEFAULT_BRANCH,
        config.git.defaultBranch,
      ),
      publishBranch: stringValue(
        env.SITE_GIT_PUBLISH_BRANCH,
        config.git.publishBranch,
      ),
    },
    limits: {
      anon: {
        chatPerDay: positiveInt(
          env.SITE_LIMIT_ANON_CHAT_PER_DAY,
          config.limits.anon.chatPerDay,
        ),
      },
      user: {
        chatPerDay: positiveInt(
          env.SITE_LIMIT_USER_CHAT_PER_DAY,
          config.limits.user.chatPerDay,
        ),
      },
    },
    oauth: {
      providers: providersRaw
        ? normalizeProviders(providersRaw.split(',').map((item) => item.trim()))
        : config.oauth.providers,
      claimThreads:
        env.SITE_OAUTH_CLAIM_THREADS === undefined
          ? config.oauth.claimThreads
          : env.SITE_OAUTH_CLAIM_THREADS !== '0' &&
            env.SITE_OAUTH_CLAIM_THREADS !== 'false',
    },
  };
}

export function resolveSiteConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  return resolve(cwd, env.SITE_CONFIG_PATH || 'site.config.yaml');
}

export function loadSiteConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): SiteConfig {
  const configPath = resolveSiteConfigPath(env, cwd);
  let fromFile: unknown = {};

  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, 'utf8');
    fromFile = loadYaml(raw) ?? {};
  }

  return applyEnvOverrides(normalizeSiteConfig(fromFile), env);
}

export function getApiBase(config: SiteConfig): string {
  return config.domains.api.replace(/\/+$/, '');
}

export function getPublishBranch(config: SiteConfig): string {
  return config.git.publishBranch;
}

export function getChatLimitPerDay(
  config: SiteConfig,
  tier: 'anon' | 'user',
): number {
  return config.limits[tier].chatPerDay;
}
