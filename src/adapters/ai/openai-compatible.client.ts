import { HttpException } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import {
  AiChatInput,
  AiChatResult,
  AiClient,
  AiStreamEvent,
  OpenAiChatCompletionRequest,
  OpenAiChatCompletionResponse,
  SummaryInput,
  SummaryResult,
} from './ai-client.interface';
import { parseSummaryResponse } from './summary.parser';
import { SUMMARY_SYSTEM_PROMPT } from './summary.prompt';

const MAX_SUMMARY_CONTENT_LENGTH = 3000;
const DEFAULT_CHAT_MAX_TOKENS = 1024;
const THINKING_CHAT_MAX_TOKENS = 4096;
const MAX_CHAT_MAX_TOKENS = 8192;

function messagesFor(input: AiChatInput) {
  return input.messages && input.messages.length > 0
    ? input.messages
    : [{ role: 'user' as const, content: input.prompt || '' }];
}

function resolveMaxTokens(input: AiChatInput): number {
  const fallback = input.enableThinking
    ? THINKING_CHAT_MAX_TOKENS
    : DEFAULT_CHAT_MAX_TOKENS;
  const requested = input.maxTokens ?? fallback;
  return Math.min(Math.max(1, Math.floor(requested)), MAX_CHAT_MAX_TOKENS);
}

function thinkingPayload(enableThinking?: boolean) {
  return {
    thinking: { type: enableThinking ? 'enabled' : 'disabled' },
  };
}

function streamText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export class OpenAiCompatibleClient implements AiClient {
  constructor(private readonly config: AppConfig['ai']) {}

  async chat(input: AiChatInput): Promise<AiChatResult> {
    if (!this.config.apiKey) {
      throw new Error('AI_API_KEY is required for AI_PROVIDER=openai or custom.');
    }

    const json = (await this.createChatCompletion({
      model: this.config.model,
      messages: messagesFor(input),
      max_tokens: resolveMaxTokens(input),
      ...thinkingPayload(input.enableThinking),
    })) as {
      choices?: Array<{
        message?: {
          content?: string;
          reasoning_content?: string;
          reasoning?: string;
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const message = json.choices?.[0]?.message;
    const thinking =
      streamText(message?.reasoning_content) ||
      streamText(message?.reasoning) ||
      undefined;

    return {
      provider: this.config.provider,
      model: this.config.model,
      message: streamText(message?.content),
      thinking,
      usage: json.usage
        ? {
            promptTokens: json.usage.prompt_tokens || 0,
            completionTokens: json.usage.completion_tokens || 0,
            totalTokens: json.usage.total_tokens || 0,
          }
        : undefined,
    };
  }

  async *streamChat(input: AiChatInput): AsyncIterable<AiStreamEvent> {
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
        model: this.config.model,
        messages: messagesFor(input),
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: resolveMaxTokens(input),
        ...thinkingPayload(input.enableThinking),
      }),
      signal: input.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new HttpException(
        `AI provider failed with ${response.status}: ${text.slice(0, 300)}`,
        response.status,
      );
    }
    if (!response.body) {
      throw new Error('AI provider returned an empty stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let doneEmitted = false;

    const parseFrame = (frame: string): AiStreamEvent[] => {
      const data = frame
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data) return [];
      if (data.trim() === '[DONE]') {
        doneEmitted = true;
        return [{ type: 'done' }];
      }

      let payload: {
        choices?: Array<{
          delta?: {
            content?: string;
            reasoning_content?: string;
            reasoning?: string;
          };
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
        error?: { message?: string };
      };
      try {
        payload = JSON.parse(data);
      } catch {
        return [];
      }
      if (payload.error) {
        throw new Error(payload.error.message || 'AI provider stream failed.');
      }

      const events: AiStreamEvent[] = [];
      const delta = payload.choices?.[0]?.delta;
      const thinking =
        streamText(delta?.reasoning_content) || streamText(delta?.reasoning);
      const content = streamText(delta?.content);
      if (thinking) events.push({ type: 'thinking', content: thinking });
      if (content) events.push({ type: 'delta', content });
      if (payload.usage) {
        events.push({
          type: 'usage',
          promptTokens: payload.usage.prompt_tokens || 0,
          completionTokens: payload.usage.completion_tokens || 0,
          totalTokens: payload.usage.total_tokens || 0,
        });
      }
      return events;
    };

    try {
      while (true) {
        if (input.signal?.aborted) {
          await reader.cancel();
          break;
        }
        const result = await reader.read();
        buffer += decoder.decode(result.value, { stream: !result.done });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() || '';
        for (const frame of frames) {
          for (const event of parseFrame(frame)) yield event;
        }
        if (result.done) break;
      }
      if (buffer.trim()) {
        for (const event of parseFrame(buffer)) yield event;
      }
      if (!doneEmitted) yield { type: 'done' };
    } catch (error) {
      if (input.signal?.aborted) {
        yield { type: 'done' };
        return;
      }
      throw error;
    }
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
