import { Module } from '@nestjs/common';
import { DynamicAiClient } from '../../adapters/ai/dynamic-ai.client';
import { AI_CLIENT } from '../../common/tokens';
import { AuthModule } from '../auth/auth.module';
import { ChatLogsModule } from '../chat-logs/chat-logs.module';
import { PlatformRuntimeConfigService } from '../platform-config/platform-runtime-config.service';
import { AiCallerGuard } from './ai-caller.guard';
import { AiController, OpenAiCompatibleController } from './ai.controller';
import { AiService } from './ai.service';
import { ChatRateLimitService } from './chat-rate-limit.service';
import { AiV1Controller } from './v1/ai-v1.controller';
import { AiV1Service } from './v1/ai-v1.service';

@Module({
  imports: [ChatLogsModule, AuthModule],
  controllers: [AiController, OpenAiCompatibleController, AiV1Controller],
  providers: [
    AiService,
    AiV1Service,
    AiCallerGuard,
    ChatRateLimitService,
    {
      provide: AI_CLIENT,
      inject: [PlatformRuntimeConfigService],
      useFactory: (runtimeConfig: PlatformRuntimeConfigService) =>
        new DynamicAiClient(runtimeConfig),
    },
  ],
  exports: [AiV1Service, ChatRateLimitService, AI_CLIENT],
})
export class AiModule {}