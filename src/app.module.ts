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
import { UserModule } from './modules/user/user.module';
import { AdminDataModule } from './modules/admin-data/admin-data.module';
import { AdminInsightsModule } from './modules/admin-insights/admin-insights.module';
import { ChatModule } from './modules/chat/chat.module';

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
    UserModule,
    ChatModule,
    AdminDataModule,
    AdminInsightsModule,
  ],
})
export class AppModule {}
