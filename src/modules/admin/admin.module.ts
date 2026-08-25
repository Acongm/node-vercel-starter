import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatLogsModule } from '../chat-logs/chat-logs.module';
import { ChatThreadsModule } from '../chat-threads/chat-threads.module';
import { ClientLabelsModule } from '../client-labels/client-labels.module';
import { CommentsModule } from '../comments/comments.module';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    AuthModule,
    CommentsModule,
    ChatLogsModule,
    ClientLabelsModule,
    ChatThreadsModule,
  ],
  controllers: [AdminController],
  providers: [AdminCatalogService],
})
export class AdminModule {}
