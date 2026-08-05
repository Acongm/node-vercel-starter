import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
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
import { ChatRateLimitService } from '../chat-rate-limit.service';
import { ChatV1Dto } from './chat-v1.dto';
import { prepareChatV1Messages } from './chat-v1.policy';

export type AiV1StreamEvent =
  | {
      type: 'meta';
      provider: string;
      model: string;
      conversationId?: string;
      enableThinking?: boolean;
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
    options: { signal?: AbortSignal; principal?: AuthPrincipal } = {},
  ): AsyncGenerator<AiV1StreamEvent> {
    const { messages, sources } = await this.prepare(dto);
    yield {
      type: 'meta',
      provider: this.appConfig.ai.provider,
      model:
        this.appConfig.ai.provider === 'mock'
          ? 'mock-local'
          : this.appConfig.ai.model,
      conversationId: dto.conversationId,
      enableThinking: Boolean(dto.enableThinking),
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

  async enforceRateLimit(req: Request): Promise<AuthPrincipal> {
    const principal = await this.jwtAuth.resolvePrincipal(req);
    const meta = extractChatRequestMeta(req);
    const limit = getChatLimitPerDay(this.siteConfig, principal.tier);
    const decision = this.rateLimit.consume({
      tier: principal.tier,
      userId: principal.userId,
      clientId: meta.clientId,
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

    return principal;
  }

  private async prepare(dto: ChatV1Dto) {
    const messages = prepareChatV1Messages(dto);
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
    const apiKey = this.appConfig.ai.webSearchApiKey;
    if (!dto.enableWebSearch || !apiKey) return [];
    const query = [...messages]
      .reverse()
      .find((message) => message.role === 'user')
      ?.content.trim();
    return query ? searchWithTavily(query, apiKey) : [];
  }
}
