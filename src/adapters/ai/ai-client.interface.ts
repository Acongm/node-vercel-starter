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

export interface AiClient {
  chat(input: AiChatInput): Promise<AiChatResult>;
}
