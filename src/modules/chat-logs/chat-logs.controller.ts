import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminSecretGuard } from './admin-secret.guard';
import { ChatLogsService } from './chat-logs.service';
import { ListChatLogsDto } from './dto/list-chat-logs.dto';

@Controller('api/ai/chat/logs')
@UseGuards(AdminSecretGuard)
export class ChatLogsController {
  constructor(private readonly chatLogsService: ChatLogsService) {}

  @Get()
  list(@Query() query: ListChatLogsDto) {
    return this.chatLogsService.list(query);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.chatLogsService.get(id);
  }
}
