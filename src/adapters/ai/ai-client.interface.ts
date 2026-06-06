export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatInput {
  prompt?: string;
  messages?: ChatMessage[];
}

export interface AiChatResult {
  provider: string;
  model: string;
  message: string;
}

export type OpenAiMessage = {
  role: string;
  content?: unknown;
};

export interface OpenAiChatCompletionRequest {
  model?: string;
  messages: OpenAiMessage[];
  [key: string]: unknown;
}

export type OpenAiChatCompletionResponse = Record<string, unknown>;

export interface AiClient {
  chat(input: AiChatInput): Promise<AiChatResult>;
  createChatCompletion(
    input: OpenAiChatCompletionRequest,
  ): Promise<OpenAiChatCompletionResponse>;
}
