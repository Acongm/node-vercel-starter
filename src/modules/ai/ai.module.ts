import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { AI_CLIENT, APP_CONFIG } from '../../common/tokens';
import { MockAiClient } from '../../adapters/ai/mock-ai.client';
import { OpenAiCompatibleClient } from '../../adapters/ai/openai-compatible.client';
import { AiController, OpenAiCompatibleController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  controllers: [AiController, OpenAiCompatibleController],
  providers: [
    AiService,
    {
      provide: AI_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => {
        if (config.ai.provider === 'mock') {
          return new MockAiClient();
        }
        return new OpenAiCompatibleClient(config.ai);
      },
    },
  ],
})
export class AiModule {}
