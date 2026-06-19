import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { ChatLogWriterService } from '../../chat-logs/chat-log-writer.service';
import { AiV1Service } from './ai-v1.service';
import { ChatV1Dto } from './chat-v1.dto';

function writeEvent(response: Response, event: Record<string, unknown>) {
  response.write(`event: ${event.type}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

@Controller('api/ai/v1')
export class AiV1Controller {
  constructor(
    private readonly aiV1Service: AiV1Service,
    private readonly chatLogWriter: ChatLogWriterService,
  ) {}

  @Post('chat')
  chat(@Body() dto: ChatV1Dto, @Req() req: Request) {
    return this.aiV1Service.chat(dto, req);
  }

  @Post('chat/stream')
  async stream(
    @Body() dto: ChatV1Dto,
    @Req() req: Request,
    @Res() response: Response,
  ) {
    response.status(201);
    response.set({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    response.flushHeaders();

    let provider = '';
    let model = '';
    let assistantMessage = '';

    try {
      for await (const event of this.aiV1Service.stream(dto)) {
        if (event.type === 'meta') {
          provider = event.provider;
          model = event.model;
        }

        if (event.type === 'delta' && event.content) {
          assistantMessage += event.content;
        }

        writeEvent(response, event);
      }
    } catch (error) {
      writeEvent(response, {
        type: 'error',
        message: error instanceof Error ? error.message : 'AI stream failed.',
      });
    } finally {
      if (assistantMessage.trim()) {
        this.chatLogWriter.logFromRequest(req, {
          endpoint: '/api/ai/v1/chat/stream',
          dto,
          assistantMessage,
          provider: provider || undefined,
          model: model || undefined,
        });
      }

      response.end();
    }
  }
}
