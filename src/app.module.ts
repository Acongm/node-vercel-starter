import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/app-config.module';
import { HealthModule } from './modules/health/health.module';
import { CommentsModule } from './modules/comments/comments.module';
import { ChatLogsModule } from './modules/chat-logs/chat-logs.module';
import { ClientLabelsModule } from './modules/client-labels/client-labels.module';
import { AiModule } from './modules/ai/ai.module';
import { ProxyModule } from './modules/proxy/proxy.module';
import { UploadModule } from './modules/upload/upload.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    AppConfigModule,
    HealthModule,
    CommentsModule,
    ChatLogsModule,
    ClientLabelsModule,
    AiModule,
    ProxyModule,
    UploadModule,
    AuthModule,
  ],
})
export class AppModule {}
