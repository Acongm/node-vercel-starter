import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { appLogger } from '../../common/app-logger';
import { RequestWithId } from '../../common/request-id.middleware';
import {
  SupabaseAuthGuard,
  SupabaseAuthenticatedRequest,
} from '../auth/supabase-auth.guard';
import { toChatErrorFrame } from './chat.errors';
import { ChatService } from './chat.service';
import {
  ChatPageQueryDto,
  CreateChatDto,
  CreateChatMessageDto,
  UpdateChatDto,
} from './dto/chat.dto';

function writeEvent(response: Response, event: Record<string, unknown>) {
  const type = typeof event.type === 'string' ? event.type : 'message';
  response.write(`event: ${type}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
}

@Controller('api/chats')
@UseGuards(SupabaseAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  list(
    @Req() request: SupabaseAuthenticatedRequest,
    @Query() query: ChatPageQueryDto,
  ) {
    return this.chatService.list(request, query);
  }

  @Post()
  create(
    @Req() request: SupabaseAuthenticatedRequest,
    @Body() dto: CreateChatDto,
  ) {
    return this.chatService.create(request, request.auth!, dto);
  }

  @Get(':id')
  get(
    @Req() request: SupabaseAuthenticatedRequest,
    @Param('id') id: string,
    @Query() query: ChatPageQueryDto,
  ) {
    return this.chatService.get(request, id, query);
  }

  @Patch(':id')
  update(
    @Req() request: SupabaseAuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateChatDto,
  ) {
    return this.chatService.update(request, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Req() request: SupabaseAuthenticatedRequest,
    @Param('id') id: string,
  ) {
    await this.chatService.delete(request, id);
  }

  @Get(':id/messages')
  messages(
    @Req() request: SupabaseAuthenticatedRequest,
    @Param('id') id: string,
    @Query() query: ChatPageQueryDto,
  ) {
    return this.chatService.listMessages(request, id, query);
  }

  @Post(':id/messages/stream')
  async streamMessage(
    @Req() request: SupabaseAuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateChatMessageDto,
    @Res() response: Response,
  ) {
    const abortController = new AbortController();
    const onClose = () => abortController.abort();
    request.on('close', onClose);

    response.status(201);
    response.set({
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    response.flushHeaders();

    const requestId = (request as RequestWithId).requestId;
    const userId = request.auth?.userId;
    const startedAt = Date.now();
    appLogger.info({
      event: 'chat.send.start',
      requestId,
      chatId: id,
      userId,
      clientMessageId: dto.clientMessageId,
      runId: dto.runId,
    });

    try {
      for await (const event of this.chatService.streamMessage(
        id,
        dto,
        request,
        request.auth!,
        abortController.signal,
      )) {
        writeEvent(response, event);
      }

      appLogger.info({
        event: 'chat.stream.done',
        requestId,
        chatId: id,
        userId,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      if (!abortController.signal.aborted) {
        appLogger.error({
          event: 'chat.stream.error',
          requestId,
          chatId: id,
          userId,
          durationMs: Date.now() - startedAt,
          message: error instanceof Error ? error.message : 'Chat stream failed',
        });
        writeEvent(response, toChatErrorFrame(error));
      }
    } finally {
      request.off('close', onClose);
      response.end();
    }
  }
}
