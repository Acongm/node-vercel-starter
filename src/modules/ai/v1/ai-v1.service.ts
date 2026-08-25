import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Request } from 'express';
import {
  AiClient,
  ChatMessage,
  ChatSource,
} from '../../../adapters/ai/ai-client.interface';
import { searchWithTavily } from '../../../adapters/web-search/tavily.client';
import { extractChatRequestMeta } from '../../../common/chat-request-meta';
import { AI_CLIENT, APP_CONFIG, SITE_CONFIG } from '../../../common/tokens';
import { AppConfig } from '../../../config/app-config';
import { SiteConfig, getChatLimitPerDay } from '../../../config/site-config';
import { JwtAuthService } from '../../auth/jwt-auth.service';
import { AuthPrincipal } from '../../auth/roles';
import { ChatLogWriterService } from '../../chat-logs/chat-log-writer.service';
import { PlatformRuntimeConfigService } from '../../platform-config/platform-runtime-config.service';
import { RequestWithCaller } from '../ai-caller.guard';
import { ChatRateLimitService } from '../chat-rate-limit.service';
import { ChatV1Dto } from './chat-v1.dto';
import {
  prepareChatV1Messages,
  type ChatSettingsInjection,
} from './chat-v1.policy';

function requestIdOf(req?: Request): string | undefined {
  if (!req || !('requestId' in req)) return undefined;
  const value = req.requestId;
  return typeof value === 'string' ? value : undefined;
}

export type AiV1StreamEvent =
  | {
      type: 'meta';
      provider: string;
      model: string;
      conversationId?: string;
      enableThinking?: boolean;
      requestId?: string;
    }
  | { type: 'sources'; sources: ChatSource[] }
  | { type: 'thinking'; content: string }
  | { type: 'delta'; content: string }
  | {
      type: 'usage';
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }
  | { type: 'done' }
  | { type: 'error'; message: string };

@Injectable()
export class AiV1Service {
  constructor(
    @Inject(AI_CLIENT) private readonly aiClient: AiClient,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
    @Inject(SITE_CONFIG) private readonly siteConfig: SiteConfig,
    private readonly chatLogWriter: ChatLogWriterService,
    private readonly rateLimit: ChatRateLimitService,
    private readonly jwtAuth: JwtAuthService,
    @Optional() private readonly runtimeConfig?: PlatformRuntimeConfigService,
  ) {}

  async chat(
    dto: ChatV1Dto,
    req: Request,
    options: {
      skipRateLimit?: boolean;
      principal?: AuthPrincipal;
      endpoint?: string;
      skipLog?: boolean;
    } = {},
  ) {
    const principal =
      options.principal ||
      (options.skipRateLimit
        ? await this.jwtAuth.resolvePrincipal(req)
        : await this.enforceRateLimit(req));
    const { messages, sources } = await this.prepare(dto);
    const result = await this.aiClient.chat({
      messages,
      context: dto.context,
      enableWebSearch: dto.enableWebSearch,
      enableThinking: dto.enableThinking,
      maxTokens: dto.maxTokens,
    });
    const response = {
      ...result,
      sources: sources.length ? sources : result.sources,
      conversationId:
        dto.conversationId || extractChatRequestMeta(req).conversationId,
      requestId: requestIdOf(req),
    };

    if (!options.skipLog) {
      await this.chatLogWriter.logFromRequest(req, {
        endpoint: options.endpoint || '/api/ai/v1/chat',
        dto,
        assistantMessage: response.message,
        thinking: response.thinking,
        provider: response.provider,
        model: response.model,
        sources: response.sources,
        userId: principal.userId,
        promptTokens: response.usage?.promptTokens,
        completionTokens: response.usage?.completionTokens,
        totalTokens: response.usage?.totalTokens,
      });
    }

    return response;
  }

  async *stream(
    dto: ChatV1Dto,
    options: {
      signal?: AbortSignal;
      principal?: AuthPrincipal;
      settings?: ChatSettingsInjection;
      requestId?: string;
    } = {},
  ): AsyncGenerator<AiV1StreamEvent> {
    const { messages, sources } = await this.prepare(dto, options.settings);
    const ai = this.runtimeConfig
      ? await this.runtimeConfig.getAiConfig()
      : this.appConfig.ai;
    yield {
      type: 'meta',
      provider: ai.provider,
      model:
        ai.provider === 'mock'
          ? 'mock-local'
          : options.settings?.defaultModel || ai.model,
      conversationId: dto.conversationId,
      enableThinking: Boolean(dto.enableThinking),
      requestId: options.requestId,
    };
    if (sources.length) yield { type: 'sources', sources };
    yield* this.aiClient.streamChat({
      messages,
      context: dto.context,
      enableWebSearch: dto.enableWebSearch,
      enableThinking: dto.enableThinking,
      maxTokens: dto.maxTokens,
      signal: options.signal,
    });
  }

  async enforceRateLimit(
    req: RequestWithCaller,
    principal?: AuthPrincipal,
  ): Promise<AuthPrincipal> {
    const verified = principal ?? (await this.jwtAuth.resolvePrincipal(req));
    const meta = extractChatRequestMeta(req);
    const limit = getChatLimitPerDay(this.siteConfig, verified.tier);
    const serviceCaller = req.resolvedCaller;
    const decision = this.rateLimit.consume({
      tier: verified.tier,
      userId: verified.userId,
      clientId: meta.clientId,
      serviceId:
        serviceCaller?.kind === 'service' ? serviceCaller.callerId : undefined,
      limit,
    });

    if (!decision.allowed) {
      throw new HttpException(
        {
          code: 'CHAT_RATE_LIMIT',
          message: `Daily chat limit exceeded (${decision.limit}/day for ${decision.tier}).`,
          limit: decision.limit,
          remaining: 0,
          resetAt: decision.resetAt,
          tier: decision.tier,
        },
        429,
      );
    }

    return verified;
  }

  private async prepare(dto: ChatV1Dto, settings?: ChatSettingsInjection) {
    const messages = prepareChatV1Messages(dto, settings);
    if (!messages.some((message) => message.role === 'user')) {
      throw new BadRequestException('Provide prompt or messages.');
    }
    const sources = await this.search(dto, messages);
    if (sources.length) {
      messages[0] = {
        ...messages[0],
        content: `${messages[0].content}\n\n【联网检索结果】\n${sources
          .map((source, index) => `${index + 1}. ${source.title} - ${source.url}`)
          .join('\n')}`,
      };
    }
    return { messages, sources };
  }

  private async search(
    dto: ChatV1Dto,
    messages: ChatMessage[],
  ): Promise<ChatSource[]> {
    const apiKey = this.runtimeConfig
      ? (await this.runtimeConfig.getAiConfig()).webSearchApiKey
      : this.appConfig.ai.webSearchApiKey;
    if (!dto.enableWebSearch || !apiKey) return [];
    const query = [...messages]
      .reverse()
      .find((message) => message.role === 'user')
      ?.content.trim();
    return query ? searchWithTavily(query, apiKey) : [];
  }
}
