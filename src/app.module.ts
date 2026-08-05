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
import { SiteConfigModule } from './modules/config/site-config.module';
import { ChatThreadsModule } from './modules/chat-threads/chat-threads.module';

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
    SiteConfigModule,
    ChatThreadsModule,
  ],
})
export class AppModule {}