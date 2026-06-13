import { HttpException } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import {
  AiChatInput,
  AiChatResult,
  AiClient,
  OpenAiChatCompletionRequest,
  OpenAiChatCompletionResponse,
  SummaryInput,
  SummaryResult,
} from './ai-client.interface';
import { parseSummaryResponse } from './summary.parser';
import { SUMMARY_SYSTEM_PROMPT } from './summary.prompt';

const MAX_SUMMARY_CONTENT_LENGTH = 3000;

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

  async generateSummary(input: SummaryInput): Promise<SummaryResult> {
    if (!this.config.apiKey) {
      throw new Error('AI_API_KEY is required for AI_PROVIDER=openai or custom.');
    }

    const content = input.content.slice(0, MAX_SUMMARY_CONTENT_LENGTH);
    const json = (await this.createChatCompletion({
      model: this.config.model,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `文档标题：${input.title}\n文档路径：${input.path}\n\n${content}`,
        },
      ],
    })) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const raw = json.choices?.[0]?.message?.content || '';
    return parseSummaryResponse(raw);
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
      throw new HttpException(
        `AI provider failed with ${response.status}: ${text.slice(0, 300)}`,
        response.status,
      );
    }

    return (await response.json()) as OpenAiChatCompletionResponse;
  }
}
