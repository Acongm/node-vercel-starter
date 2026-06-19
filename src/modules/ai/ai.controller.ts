import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { OpenAiChatCompletionRequest } from '../../adapters/ai/ai-client.interface';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';
import { SummaryDto } from './dto/summary.dto';

@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  chat(@Body() dto: ChatDto, @Req() req: Request) {
    return this.aiService.chat(dto, req);
  }

  @Post('summary')
  createSummary(@Body() dto: SummaryDto) {
    return this.aiService.createSummary(dto);
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
