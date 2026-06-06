import { Body, Controller, Post } from '@nestjs/common';
import { OpenAiChatCompletionRequest } from '../../adapters/ai/ai-client.interface';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';

@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  chat(@Body() dto: ChatDto) {
    return this.aiService.chat(dto);
  }
}

@Controller()
export class OpenAiCompatibleController {
  constructor(private readonly aiService: AiService) {}

  @Post(['v1/chat/completions', 'api/openai/v1/chat/completions'])
  createChatCompletion(@Body() dto: OpenAiChatCompletionRequest) {
    return this.aiService.createChatCompletion(dto);
  }
}
