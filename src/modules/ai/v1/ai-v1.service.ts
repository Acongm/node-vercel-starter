import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AiClient } from '../../../adapters/ai/ai-client.interface';
import { AI_CLIENT, APP_CONFIG } from '../../../common/tokens';
import { AppConfig } from '../../../config/app-config';
import { ChatV1Dto } from './chat-v1.dto';
import { prepareChatV1Messages } from './chat-v1.policy';

@Injectable()
export class AiV1Service {
  constructor(
    @Inject(AI_CLIENT) private readonly aiClient: AiClient,
    @Inject(APP_CONFIG) private readonly appConfig: AppConfig,
  ) {}

  async chat(dto: ChatV1Dto) {
    const messages = this.prepare(dto);
    return this.aiClient.chat({
      messages,
      context: dto.context,
      enableWebSearch: dto.enableWebSearch,
    });
  }

  async *stream(dto: ChatV1Dto) {
    const messages = this.prepare(dto);
    yield {
      type: 'meta' as const,
      provider: this.appConfig.ai.provider,
      model:
        this.appConfig.ai.provider === 'mock'
          ? 'mock-local'
          : this.appConfig.ai.model,
    };
    yield* this.aiClient.streamChat({
      messages,
      context: dto.context,
      enableWebSearch: dto.enableWebSearch,
    });
  }

  private prepare(dto: ChatV1Dto) {
    const messages = prepareChatV1Messages(dto);
    if (!messages.some((message) => message.role === 'user')) {
      throw new BadRequestException('Provide prompt or messages.');
    }
    return messages;
  }
}
