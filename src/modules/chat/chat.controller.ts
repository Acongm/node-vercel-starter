import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
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
import {
  SupabaseAuthGuard,
  SupabaseAuthenticatedRequest,
} from '../auth/supabase-auth.guard';
import { toChatErrorFrame } from './chat.errors';
import { ChatOwnershipTransferService } from './chat-ownership-transfer.service';
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
  constructor(
    private readonly chatService: ChatService,
    private readonly ownershipTransfer: ChatOwnershipTransferService,
  ) {}

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

  @Post('transfer-ownership')
  @HttpCode(200)
  transferOwnership(
    @Req() request: SupabaseAuthenticatedRequest,
    @Headers('x-anonymous-authorization') sourceAuthorization?: string,
  ) {
    return this.ownershipTransfer.transfer(
      request.auth!,
      sourceAuthorization,
    );
  }

  @Get(':id')
  get(@Req() request: SupabaseAuthenticatedRequest, @Param('id') id: string) {
    return this.chatService.get(request, id);
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
    } catch (error) {
      if (!abortController.signal.aborted) {
        writeEvent(response, toChatErrorFrame(error));
      }
    } finally {
      request.off('close', onClose);
      response.end();
    }
  }
}
