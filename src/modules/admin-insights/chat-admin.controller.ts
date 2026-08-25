import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminAccessGuard } from '../auth/admin-access.guard';
import { ChatAdminService } from './chat-admin.service';
import { ListChatLogsDto, ListConversationsDto } from './dto/chat-admin.dto';

@Controller('api/admin/chat')
@UseGuards(AdminAccessGuard)
export class ChatAdminController {
  constructor(private readonly chatAdmin: ChatAdminService) {}

  @Get('conversations')
  listConversations(@Query() query: ListConversationsDto) {
    return this.chatAdmin.listConversations(query);
  }

  @Get('conversations/:chatId')
  getConversation(@Param('chatId') chatId: string) {
    return this.chatAdmin.getConversation(chatId);
  }

  @Get('logs')
  listChatLogs(@Query() query: ListChatLogsDto) {
    return this.chatAdmin.listChatLogs(query);
  }
}
