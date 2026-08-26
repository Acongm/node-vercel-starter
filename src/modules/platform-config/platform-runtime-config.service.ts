import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AiProviderRuntimeConfig } from '../../adapters/ai/ai-client.interface';
import type { ServiceCaller } from '../../common/caller-identity';
import { APP_CONFIG } from '../../common/tokens';
import type { AppConfig } from '../../config/app-config';
import { SupabaseAdminClientService } from '../admin-insights/supabase-admin-client.service';
import {
  defaultPlatformRuntimeConfigBody,
  defaultPlatformRuntimeConfigDocument,
  maskSecret,
  mergePlatformRuntimeConfigBody,
  normalizePlatformRuntimeConfigBody,
} from './platform-runtime-config.defaults';
import {
  PLATFORM_RUNTIME_CONFIG_SCHEMA_VERSION,
  type PlatformRuntimeConfigAdminView,
  type PlatformRuntimeConfigBody,
  type PlatformRuntimeConfigDocument,
  type PlatformRuntimeConfigPatchInput,
  type PlatformSecretName,
  isPlatformSecretName,
  serviceCallerSecretName,
} from './platform-runtime-config.types';

const CONFIG_ROW_ID = 'default';
const CACHE_TTL_MS = 30_000;
const RESOLVE_TIMEOUT_MS = 1_500;

async function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('platform-config-timeout')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type ResolvedRuntime = {
  document: PlatformRuntimeConfigDocument;
  secrets: Map<string, string>;
  source: 'database' | 'environment';
  updatedAt: string | null;
};

@Injectable()
export class PlatformRuntimeConfigService {
  private cache: ResolvedRuntime | null = null;
  private cacheExpiresAt = 0;

  constructor(
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
    private readonly supabaseAdmin: SupabaseAdminClientService,
  ) {}

  invalidateCache(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  async getAdminView(): Promise<PlatformRuntimeConfigAdminView> {
    const resolved = await this.resolve(true);
    const secrets: PlatformRuntimeConfigAdminView['secrets'] = {};
    for (const name of ['llm.api_key', 'web_search.api_key', 'kb.portal_service_key']) {
      const value = resolved.secrets.get(name);
      secrets[name] = {
        configured: Boolean(value?.trim()),
        preview: maskSecret(value),
      };
    }

    const serviceCallerSecrets = resolved.document.callers.serviceCallers.map(
      (caller) => {
        const value = resolved.secrets.get(serviceCallerSecretName(caller.id));
        return {
          id: caller.id,
          configured: Boolean(value?.trim()),
          preview: maskSecret(value),
        };
      },
    );

    return {
      schemaVersion: resolved.document.schemaVersion,
      config: this.toConfigBody(resolved.document),
      secrets,
      serviceCallerSecrets,
      source: resolved.source,
      updatedAt: resolved.updatedAt,
    };
  }

  async updateAdminPatch(patch: PlatformRuntimeConfigPatchInput): Promise<PlatformRuntimeConfigAdminView> {
    if (!this.supabaseAdmin.isConfigured()) {
      throw new ServiceUnavailableException(
        'Supabase is required to persist platform runtime config.',
      );
    }

    const resolved = await this.resolve(true);
    const nextBody = mergePlatformRuntimeConfigBody(
      this.toConfigBody(resolved.document),
      patch.config,
    );

    if (patch.secrets) {
      for (const [name, value] of Object.entries(patch.secrets)) {
        if (!isPlatformSecretName(name)) {
          throw new BadRequestException(`Unsupported secret name: ${name}`);
        }
        await this.writeSecret(name, value);
      }
    }

    if (patch.serviceCallerKeys) {
      for (const row of patch.serviceCallerKeys) {
        const id = row.id?.trim();
        if (!id) continue;
        await this.writeSecret(serviceCallerSecretName(id), row.key);
      }
    }

    const client = this.supabaseAdmin.getClient();
    const payload = {
      id: CONFIG_ROW_ID,
      schema_version: PLATFORM_RUNTIME_CONFIG_SCHEMA_VERSION,
      config: nextBody,
      updated_at: new Date().toISOString(),
    };

    const { error } = await client.from('platform_runtime_config').upsert(payload);
    if (error) {
      throw new ServiceUnavailableException(
        `Failed to save platform runtime config: ${error.message}`,
      );
    }

    this.invalidateCache();
    return this.getAdminView();
  }

  async getAiConfig(): Promise<AiProviderRuntimeConfig> {
    const resolved = await this.resolve(true);
    const body = this.toConfigBody(resolved.document);
    return {
      provider: body.chat.provider,
      baseUrl: body.chat.baseUrl,
      model: body.chat.model,
      apiKey: resolved.secrets.get('llm.api_key') || this.appConfig.ai.apiKey,
      maxTokensDefault: body.chat.maxTokensDefault,
      thinkingMaxTokens: body.chat.thinkingMaxTokens,
      webSearchApiKey: await this.getWebSearchApiKey(),
    };
  }

  /** Resolve Tavily key; `force` bypasses admin disable when the user requested web search. */
  async getWebSearchApiKey(options?: {
    force?: boolean;
  }): Promise<string | undefined> {
    const resolved = await this.resolve(true);
    const body = this.toConfigBody(resolved.document);
    const key =
      resolved.secrets.get('web_search.api_key')?.trim() ||
      this.appConfig.ai.webSearchApiKey?.trim();
    if (!key) return undefined;
    if (options?.force || body.webSearch.enabled) return key;
    return undefined;
  }

  async getPortalSummariesUrl(): Promise<string> {
    const resolved = await this.resolve(true);
    return resolved.document.knowledgeBase.summariesUrl;
  }

  async getServiceCallers(): Promise<ServiceCaller[]> {
    const resolved = await this.resolve(true);
    const callers: ServiceCaller[] = [];
    for (const caller of resolved.document.callers.serviceCallers) {
      const key =
        resolved.secrets.get(serviceCallerSecretName(caller.id)) ||
        this.appConfig.serviceCallers.find((item) => item.id === caller.id)?.key;
      if (!key?.trim()) continue;
      callers.push({ id: caller.id, key: key.trim() });
    }
    if (callers.length === 0) {
      return this.appConfig.serviceCallers;
    }
    return callers;
  }

  async getAllowedCallSources(): Promise<string[]> {
    const resolved = await this.resolve(true);
    const sources = resolved.document.callers.allowedCallSources;
    return sources.length ? sources : this.appConfig.allowedCallSources;
  }

  async isOpenApiEnabled(): Promise<boolean> {
    const resolved = await this.resolve(true);
    return resolved.document.openApi.enabled;
  }

  async isOpenApiCompletionsEnabled(): Promise<boolean> {
    const resolved = await this.resolve(true);
    return resolved.document.openApi.enabled && resolved.document.openApi.completionsPathEnabled;
  }

  async getDefaultModel(): Promise<string> {
    const resolved = await this.resolve(true);
    return resolved.document.chat.model;
  }

  private async resolve(forceRefresh = false): Promise<ResolvedRuntime> {
    if (!forceRefresh && this.cache && Date.now() < this.cacheExpiresAt) {
      return this.cache;
    }

    const envDefaults = defaultPlatformRuntimeConfigDocument(this.appConfig);
    const envSecrets = this.secretsFromEnv();

    if (!this.supabaseAdmin.isConfigured()) {
      const resolved: ResolvedRuntime = {
        document: envDefaults,
        secrets: envSecrets,
        source: 'environment',
        updatedAt: null,
      };
      this.cache = resolved;
      this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return resolved;
    }

    const client = this.supabaseAdmin.getClient();
    let data: {
      schema_version?: number;
      config?: unknown;
      updated_at?: string;
    } | null = null;
    try {
      const result = await withTimeout(
        client
          .from('platform_runtime_config')
          .select('schema_version, config, updated_at')
          .eq('id', CONFIG_ROW_ID)
          .maybeSingle(),
        RESOLVE_TIMEOUT_MS,
      );
      if (result.error) {
        throw new Error(result.error.message);
      }
      data = result.data;
    } catch {
      const resolved: ResolvedRuntime = {
        document: envDefaults,
        secrets: envSecrets,
        source: 'environment',
        updatedAt: null,
      };
      this.cache = resolved;
      this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
      return resolved;
    }

    const fallbackBody = defaultPlatformRuntimeConfigBody(this.appConfig);
    const body = normalizePlatformRuntimeConfigBody(data?.config, fallbackBody);
    const document: PlatformRuntimeConfigDocument = {
      schemaVersion:
        typeof data?.schema_version === 'number'
          ? data.schema_version
          : PLATFORM_RUNTIME_CONFIG_SCHEMA_VERSION,
      ...body,
    };

    const secrets = await this.loadSecrets(client, envSecrets);

    const resolved: ResolvedRuntime = {
      document,
      secrets,
      source: data ? 'database' : 'environment',
      updatedAt: typeof data?.updated_at === 'string' ? data.updated_at : null,
    };

    this.cache = resolved;
    this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return resolved;
  }

  private async loadSecrets(
    client: SupabaseClient,
    envSecrets: Map<string, string>,
  ): Promise<Map<string, string>> {
    const secrets = new Map<string, string>(envSecrets);
    const { data, error } = await client
      .schema('private')
      .from('platform_secret_values')
      .select('name, value');

    if (error) {
      // Table may not exist before migration — keep env fallback.
      return secrets;
    }

    for (const row of data ?? []) {
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      const value = typeof row.value === 'string' ? row.value.trim() : '';
      if (name && value) secrets.set(name, value);
    }
    return secrets;
  }

  private secretsFromEnv(): Map<string, string> {
    const secrets = new Map<string, string>();
    if (this.appConfig.ai.apiKey?.trim()) {
      secrets.set('llm.api_key', this.appConfig.ai.apiKey.trim());
    }
    if (this.appConfig.ai.webSearchApiKey?.trim()) {
      secrets.set('web_search.api_key', this.appConfig.ai.webSearchApiKey.trim());
    }
    for (const caller of this.appConfig.serviceCallers) {
      if (!caller.key?.trim()) continue;
      secrets.set(serviceCallerSecretName(caller.id), caller.key.trim());
      if (caller.id === 'portal-ci') {
        secrets.set('kb.portal_service_key', caller.key.trim());
      }
    }
    return secrets;
  }

  private async writeSecret(name: PlatformSecretName | string, value: string | null | undefined) {
    const client = this.supabaseAdmin.getClient();
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) {
      await client.schema('private').from('platform_secret_values').delete().eq('name', name);
      return;
    }
    const { error } = await client
      .schema('private')
      .from('platform_secret_values')
      .upsert({ name, value: trimmed, updated_at: new Date().toISOString() });
    if (error) {
      throw new ServiceUnavailableException(`Failed to save secret ${name}: ${error.message}`);
    }
  }

  private toConfigBody(document: PlatformRuntimeConfigDocument): PlatformRuntimeConfigBody {
    return {
      chat: { ...document.chat },
      knowledgeBase: { ...document.knowledgeBase },
      openApi: { ...document.openApi },
      webSearch: { ...document.webSearch },
      callers: {
        allowedCallSources: [...document.callers.allowedCallSources],
        serviceCallers: document.callers.serviceCallers.map((caller) => ({ ...caller })),
      },
    };
  }
}
