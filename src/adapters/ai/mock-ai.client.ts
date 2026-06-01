import { AiChatInput, AiChatResult, AiClient } from './ai-client.interface';

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
}
