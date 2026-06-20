import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Request } from 'express';
import {
  AiClient,
  ChatMessage,
  ChatSource,
} from '../../../adapters/ai/ai-client.interface';
import { searchWithTavily } from '../../../adapters/web-search/tavily.client';
import { AI_CLIENT, APP_CONFIG } from '../../../common/tokens';
import { AppConfig } from '../../../config/app-config';
import { ChatLogWriterService } from '../../chat-logs/chat-log-writer.service';
import { ChatV1Dto } from './chat-v1.dto';
import { prepareChatV1Messages } from './chat-v1.policy';

@Injectable()
export class AiV1Service {
  constructor(
    @Inject(AI_CLIENT) private readonly aiClient: AiClient,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
    private readonly chatLogWriter: ChatLogWriterService,
  ) {}

  async chat(dto: ChatV1Dto, req: Request) {
    const { messages, sources } = await this.prepare(dto);
    const result = await this.aiClient.chat({
      messages,
      context: dto.context,
      enableWebSearch: dto.enableWebSearch,
    });
    const response = {
      ...result,
      sources: sources.length ? sources : result.sources,
    };

    await this.chatLogWriter.logFromRequest(req, {
      endpoint: '/api/ai/v1/chat',
      dto,
      assistantMessage: response.message,
      provider: response.provider,
      model: response.model,
      sources: response.sources,
    });

    return response;
  }

  async *stream(dto: ChatV1Dto) {
    const { messages, sources } = await this.prepare(dto);
    yield {
      type: 'meta' as const,
      provider: this.appConfig.ai.provider,
      model:
        this.appConfig.ai.provider === 'mock'
          ? 'mock-local'
          : this.appConfig.ai.model,
    };
    if (sources.length) yield { type: 'sources' as const, sources };
    yield* this.aiClient.streamChat({
      messages,
      context: dto.context,
      enableWebSearch: dto.enableWebSearch,
    });
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
