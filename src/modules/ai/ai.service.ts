import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { searchWithTavily, formatWebSearchContext } from '../../adapters/web-search/tavily.client';
import { AI_CLIENT, APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import {
  AiClient,
  ChatMessage,
  OpenAiChatCompletionRequest,
  OpenAiChatCompletionResponse,
} from '../../adapters/ai/ai-client.interface';
import { ChatLogWriterService } from '../chat-logs/chat-log-writer.service';
import { PlatformRuntimeConfigService } from '../platform-config/platform-runtime-config.service';
import { ChatDto } from './dto/chat.dto';
import { SummaryDto } from './dto/summary.dto';
import {
  buildSummaryUserPrompt,
  createMockSummary,
  LiveSummaryResult,
  parseSummaryResponse,
  SUMMARY_SYSTEM_PROMPT,
} from './summary.utils';

function requestIdOf(req?: Request): string | undefined {
  if (!req || !('requestId' in req)) return undefined;
  const value = req.requestId;
  return typeof value === 'string' ? value : undefined;
}

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_CLIENT) private readonly aiClient: AiClient,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
    private readonly chatLogWriter: ChatLogWriterService,
    private readonly runtimeConfig: PlatformRuntimeConfigService,
  ) {}

  async chat(dto: ChatDto, req: Request) {
    if (!dto.prompt && (!dto.messages || dto.messages.length === 0)) {
      throw new BadRequestException('Provide prompt or messages.');
    }

    const messages = this.buildChatMessages(dto);
    const searchResult = dto.enableWebSearch
      ? await this.searchWeb(messages)
      : null;

    const enrichedMessages =
      dto.enableWebSearch && messages
        ? this.injectSearchContext(messages, searchResult ?? { sources: [] })
        : messages;

    const result = await this.aiClient.chat({
      prompt: dto.prompt,
      messages: enrichedMessages,
      context: dto.context,
      enableWebSearch: dto.enableWebSearch,
    });

    const response = {
      provider: result.provider,
      model: result.model,
      message: result.message,
      sources: searchResult?.sources?.length
        ? searchResult.sources
        : result.sources,
      requestId: requestIdOf(req),
    };

    await this.chatLogWriter.logFromRequest(req, {
      endpoint: '/api/ai/chat',
      dto,
      assistantMessage: response.message,
      provider: response.provider,
      model: response.model,
      sources: response.sources,
    });

    return response;
  }

  async createSummary(
    dto: SummaryDto,
    req?: Request,
  ): Promise<LiveSummaryResult & { requestId?: string }> {
    const ai = await this.runtimeConfig.getAiConfig();
    if (ai.provider === 'mock') {
      return {
        ...createMockSummary(dto.content, dto.title),
        requestId: requestIdOf(req),
      };
    }

    const result = await this.aiClient.chat({
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildSummaryUserPrompt(dto.content, dto.title),
        },
      ],
    });

    try {
      const parsed = parseSummaryResponse(result.message);
      return {
        ...parsed,
        source: 'live',
        generatedAt: new Date().toISOString(),
        requestId: requestIdOf(req),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to parse AI summary.';
      throw new BadRequestException(message);
    }
  }

  async createChatCompletion(dto: OpenAiChatCompletionRequest, req: Request) {
    if (!(await this.runtimeConfig.isOpenApiCompletionsEnabled())) {
      throw new NotFoundException('OpenAI-compatible chat completions are disabled.');
    }

    if (!Array.isArray(dto.messages) || dto.messages.length === 0) {
      throw new BadRequestException(
        'OpenAI-compatible requests require messages.',
      );
    }

    const ai = await this.runtimeConfig.getAiConfig();
    const response = await this.aiClient.createChatCompletion(dto);

    await this.chatLogWriter.logFromRequest(req, {
      endpoint: requestPath(req),
      dto: {
        messages: dto.messages.map((message) => ({
          role: String(message.role),
          content: textFromOpenAiContent(message.content),
        })),
      },
      assistantMessage: assistantMessageFromCompletion(response),
      provider: ai.provider,
      model: modelFromCompletion(response, dto, { ai }),
    });

    return response;
  }

  private buildChatMessages(dto: ChatDto): ChatMessage[] | undefined {
    if (!dto.messages?.length) {
      return undefined;
    }

    const messages = [...dto.messages];
    if (!dto.context) {
      return messages;
    }

    const contextLines = [
      `对话范围：${dto.context.scope || 'article'}`,
      dto.context.title ? `文档标题：${dto.context.title}` : '',
      dto.context.pagePath ? `文档路径：${dto.context.pagePath}` : '',
      dto.context.moduleKey ? `模块：${dto.context.moduleKey}` : '',
      dto.context.tags?.length
        ? `标签：${dto.context.tags.join('、')}`
        : '',
    ].filter(Boolean);

    if (!contextLines.length) {
      return messages;
    }

    const contextBlock = `【页面上下文】\n${contextLines.join('\n')}`;
    const systemIndex = messages.findIndex((message) => message.role === 'system');

    if (systemIndex >= 0) {
      messages[systemIndex] = {
        ...messages[systemIndex],
        content: `${messages[systemIndex].content}\n\n${contextBlock}`,
      };
      return messages;
    }

    return [{ role: 'system' as const, content: contextBlock }, ...messages];
  }

  private async searchWeb(messages: ChatMessage[] | undefined) {
    const apiKey = await this.runtimeConfig.getWebSearchApiKey({ force: true });
    if (!apiKey || !messages?.length) {
      return { sources: [] };
    }

    const lastUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === 'user');

    if (!lastUserMessage?.content?.trim()) {
      return { sources: [] };
    }

    return searchWithTavily(lastUserMessage.content, apiKey);
  }

  private injectSearchContext(
    messages: ChatMessage[],
    searchResult: Awaited<ReturnType<typeof searchWithTavily>>,
  ): ChatMessage[] {
    const searchBlock = formatWebSearchContext(searchResult);

    const cloned = [...messages];
    const systemIndex = cloned.findIndex((message) => message.role === 'system');

    if (systemIndex >= 0) {
      cloned[systemIndex] = {
        ...cloned[systemIndex],
        content: `${cloned[systemIndex].content}\n\n${searchBlock}`,
      };
      return cloned;
    }

    return [{ role: 'system' as const, content: searchBlock }, ...cloned];
  }
}

function requestPath(req: Request): string {
  return req.path || req.originalUrl.split('?')[0] || '/v1/chat/completions';
}

function assistantMessageFromCompletion(
  response: OpenAiChatCompletionResponse,
): string {
  const choices = response.choices;
  if (!Array.isArray(choices)) {
    return '';
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== 'object') {
    return '';
  }

  const message = (firstChoice as { message?: { content?: unknown } }).message;
  return textFromOpenAiContent(message?.content);
}

function modelFromCompletion(
  response: OpenAiChatCompletionResponse,
  dto: OpenAiChatCompletionRequest,
  config: Pick<AppConfig, 'ai'>,
): string | undefined {
  if (typeof response.model === 'string') {
    return response.model;
  }

  if (typeof dto.model === 'string') {
    return dto.model;
  }

  return config.ai.provider === 'mock' ? 'mock-local' : config.ai.model;
}

function textFromOpenAiContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return content === undefined || content === null ? '' : String(content);
  }

  return content
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }

      if (!part || typeof part !== 'object') {
        return '';
      }

      const text = (part as { text?: unknown }).text;
      return typeof text === 'string' ? text : '';
    })
    .filter(Boolean)
    .join('\n');
}
