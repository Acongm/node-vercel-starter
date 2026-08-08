import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { ChatLogsModule } from '../chat-logs/chat-logs.module';
import { ChatController } from './chat.controller';
import { ChatOwnershipTransferService } from './chat-ownership-transfer.service';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';

@Module({
  imports: [AuthModule, AiModule, ChatLogsModule],
  controllers: [ChatController],
  providers: [ChatRepository, ChatService, ChatOwnershipTransferService],
  exports: [ChatRepository, ChatService, ChatOwnershipTransferService],
})
export class ChatModule {}
