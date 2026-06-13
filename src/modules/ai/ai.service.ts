import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AI_CLIENT, APP_CONFIG } from '../../common/tokens';
import { AppConfig } from '../../config/app-config';
import {
  AiClient,
  OpenAiChatCompletionRequest,
} from '../../adapters/ai/ai-client.interface';
import { ChatDto } from './dto/chat.dto';
import { SummaryDto } from './dto/summary.dto';
import {
  buildSummaryUserPrompt,
  createMockSummary,
  LiveSummaryResult,
  parseSummaryResponse,
  SUMMARY_SYSTEM_PROMPT,
} from './summary.utils';

@Injectable()
export class AiService {
  constructor(
    @Inject(AI_CLIENT) private readonly aiClient: AiClient,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
  ) {}

  chat(dto: ChatDto) {
    if (!dto.prompt && (!dto.messages || dto.messages.length === 0)) {
      throw new BadRequestException('Provide prompt or messages.');
    }
    return this.aiClient.chat(dto);
  }

  createChatCompletion(dto: OpenAiChatCompletionRequest) {
    if (!Array.isArray(dto.messages) || dto.messages.length === 0) {
      throw new BadRequestException('OpenAI-compatible requests require messages.');
    }

    return this.aiClient.createChatCompletion(dto);
  }

  async createSummary(dto: SummaryDto): Promise<LiveSummaryResult> {
    if (this.appConfig.ai.provider === 'mock') {
      return createMockSummary(dto.content, dto.title);
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
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to parse AI summary.';
      throw new BadRequestException(message);
    }
  }
}
