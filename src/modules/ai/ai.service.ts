import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { AI_CLIENT } from '../../common/tokens';
import { AiClient } from '../../adapters/ai/ai-client.interface';
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
}
