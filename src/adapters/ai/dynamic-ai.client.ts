import type {
  AiChatInput,
  AiChatResult,
  AiClient,
  AiStreamEvent,
  OpenAiChatCompletionRequest,
  OpenAiChatCompletionResponse,
  SummaryInput,
  SummaryResult,
} from './ai-client.interface';
import { MockAiClient } from './mock-ai.client';
import { OpenAiCompatibleClient } from './openai-compatible.client';
import type { AiProviderRuntimeConfig } from './ai-client.interface';
import type { PlatformRuntimeConfigService } from '../../modules/platform-config/platform-runtime-config.service';

export class DynamicAiClient implements AiClient {
  constructor(private readonly runtimeConfig: PlatformRuntimeConfigService) {}

  private async client(): Promise<AiClient> {
    const ai = await this.runtimeConfig.getAiConfig();
    if (ai.provider === 'mock') {
      return new MockAiClient();
    }
    return new OpenAiCompatibleClient(ai);
  }

  async chat(input: AiChatInput): Promise<AiChatResult> {
    return (await this.client()).chat(input);
  }

  async *streamChat(input: AiChatInput): AsyncIterable<AiStreamEvent> {
    const delegate = await this.client();
    for await (const event of delegate.streamChat(input)) {
      yield event;
    }
  }

  async generateSummary(input: SummaryInput): Promise<SummaryResult> {
    return (await this.client()).generateSummary(input);
  }

  async createChatCompletion(
    input: OpenAiChatCompletionRequest,
  ): Promise<OpenAiChatCompletionResponse> {
    return (await this.client()).createChatCompletion(input);
  }
}
