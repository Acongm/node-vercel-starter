import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { AiV1Service } from './ai-v1.service';
import { ChatV1Dto } from './chat-v1.dto';

function writeEvent(response: Response, event: Record<string, unknown>) {
  response.write(`event: ${event.type}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

@Controller('api/ai/v1')
export class AiV1Controller {
  constructor(private readonly aiV1Service: AiV1Service) {}

  @Post('chat')
  chat(@Body() dto: ChatV1Dto) {
    return this.aiV1Service.chat(dto);
  }

  @Post('chat/stream')
  async stream(@Body() dto: ChatV1Dto, @Res() response: Response) {
    response.status(201);
    response.set({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    response.flushHeaders();

    try {
      for await (const event of this.aiV1Service.stream(dto)) {
        writeEvent(response, event);
      }
    } catch (error) {
      writeEvent(response, {
        type: 'error',
        message: error instanceof Error ? error.message : 'AI stream failed.',
      });
    } finally {
      response.end();
    }
  }
}
