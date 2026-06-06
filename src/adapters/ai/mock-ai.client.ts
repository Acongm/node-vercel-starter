import {
  AiChatInput,
  AiChatResult,
  AiClient,
  OpenAiChatCompletionRequest,
  OpenAiChatCompletionResponse,
} from './ai-client.interface';

export class MockAiClient implements AiClient {
  async chat(input: AiChatInput): Promise<AiChatResult> {
    const prompt =
      input.prompt ||
      input.messages?.map((message) => message.content).join('\n') ||
      '';

    return {
      provider: 'mock',
      model: 'mock-local',
      message: prompt ? `Mock response: ${prompt}` : 'Mock response ready.',
    };
  }

  async createChatCompletion(
    input: OpenAiChatCompletionRequest,
  ): Promise<OpenAiChatCompletionResponse> {
    const prompt = input.messages
      .map((message) => String(message.content ?? ''))
      .filter(Boolean)
      .join('\n');

    return {
      id: `chatcmpl-${Date.now().toString(36)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: input.model || 'mock-local',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: prompt ? `Mock response: ${prompt}` : 'Mock response ready.',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }
}
