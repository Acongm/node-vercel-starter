import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AiV1Service } from '../ai/v1/ai-v1.service';
import {
  AuthenticatedRequest,
  OptionalAuthGuard,
} from '../auth/roles.guard';
import { ChatThreadsService } from './chat-threads.service';
import {
  CreateChatThreadDto,
  CreateThreadMessageDto,
} from './dto/chat-thread.dto';

function writeEvent(response: Response, event: Record<string, unknown>) {
  response.write(`event: ${event.type}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

@Controller('api/chat/threads')
@UseGuards(OptionalAuthGuard)
export class ChatThreadsController {
  constructor(
    private readonly threadsService: ChatThreadsService,
    private readonly aiV1Service: AiV1Service,
  ) {}

  @Post()
  create(@Body() dto: CreateChatThreadDto, @Req() req: AuthenticatedRequest) {
    return this.threadsService.create(dto, req, req.auth!);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.threadsService.list(req, req.auth!);
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.threadsService.get(id, req, req.auth!);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.threadsService.remove(id, req, req.auth!);
  }

  @Post(':id/messages')
  appendMessage(
    @Param('id') id: string,
    @Body() dto: CreateThreadMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.threadsService.appendMessage(id, dto, req, req.auth!);
  }

  @Post(':id/messages/stream')
  async streamMessage(
    @Param('id') id: string,
    @Body() dto: CreateThreadMessageDto,
    @Req() req: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const principal = await this.aiV1Service.enforceRateLimit(req);
    const abortController = new AbortController();
    const onClose = () => abortController.abort();
    req.on('close', onClose);

    response.status(201);
    response.set({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    response.flushHeaders();

    try {
      for await (const event of this.threadsService.streamMessage(
        id,
        dto,
        req,
        principal,
        abortController.signal,
      )) {
        writeEvent(response, event);
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        writeEvent(response, {
          type: 'error',
          message:
            error instanceof Error ? error.message : 'Thread stream failed.',
        });
      }
    } finally {
      req.off('close', onClose);
      response.end();
    }
  }
}
