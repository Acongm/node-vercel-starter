import { AppConfig } from '../../config/app-config';
import {
  AiChatInput,
  AiChatResult,
  AiClient,
  OpenAiChatCompletionRequest,
  OpenAiChatCompletionResponse,
} from './ai-client.interface';

export class OpenAiCompatibleClient implements AiClient {
  constructor(private readonly config: AppConfig['ai']) {}

  async chat(input: AiChatInput): Promise<AiChatResult> {
    if (!this.config.apiKey) {
      throw new Error('AI_API_KEY is required for AI_PROVIDER=openai or custom.');
    }

    const messages =
      input.messages && input.messages.length > 0
        ? input.messages
        : [{ role: 'user' as const, content: input.prompt || '' }];

    const json = (await this.createChatCompletion({
      model: this.config.model,
      messages,
    })) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return {
      provider: this.config.provider,
      model: this.config.model,
      message: json.choices?.[0]?.message?.content || '',
    };
  }

  async createChatCompletion(
    input: OpenAiChatCompletionRequest,
  ): Promise<OpenAiChatCompletionResponse> {
    if (!this.config.apiKey) {
      throw new Error('AI_API_KEY is required for AI_PROVIDER=openai or custom.');
    }

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ...input,
        model: input.model || this.config.model,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI provider failed with ${response.status}: ${text.slice(0, 300)}`);
    }

    return (await response.json()) as OpenAiChatCompletionResponse;
  }
}
