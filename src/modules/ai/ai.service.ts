import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AI_CLIENT } from '../../common/tokens';
import {
  AiClient,
  OpenAiChatCompletionRequest,
} from '../../adapters/ai/ai-client.interface';
import { ChatDto } from './dto/chat.dto';

@Injectable()
export class AiService {
  constructor(@Inject(AI_CLIENT) private readonly aiClient: AiClient) {}

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
}
