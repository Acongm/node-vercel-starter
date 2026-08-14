import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { ChatLogsModule } from '../chat-logs/chat-logs.module';
import { UserModule } from '../user/user.module';
import { ChatCapabilitiesController } from './chat-capabilities.controller';
import { ChatController } from './chat.controller';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';

@Module({
  imports: [AuthModule, AiModule, ChatLogsModule, UserModule],
  controllers: [ChatController, ChatCapabilitiesController],
  providers: [ChatRepository, ChatService],
  exports: [ChatRepository, ChatService],
})
export class ChatModule {}
