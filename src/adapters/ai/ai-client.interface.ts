export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  scope?: 'article' | 'module';
  pagePath?: string;
  moduleKey?: string;
  title?: string;
  tags?: string[];
}

export interface ChatSource {
  title: string;
  url: string;
}

export interface AiChatInput {
  prompt?: string;
  messages?: ChatMessage[];
  context?: ChatContext;
  enableWebSearch?: boolean;
}

export interface AiChatResult {
  provider: string;
  model: string;
  message: string;
  sources?: ChatSource[];
}

export type AiStreamEvent =
  | { type: 'delta'; content: string }
  | {
      type: 'usage';
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    }
  | { type: 'done' };

export interface SummaryInput {
  path: string;
  title: string;
  content: string;
}

export interface SummaryResult {
  summary: string;
  keyPoints: string[];
  keywords: string[];
  techStack: string[];
  difficulty: string;
  contentType: string;
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
  streamChat(input: AiChatInput): AsyncIterable<AiStreamEvent>;
  generateSummary(input: SummaryInput): Promise<SummaryResult>;
  createChatCompletion(
    input: OpenAiChatCompletionRequest,
  ): Promise<OpenAiChatCompletionResponse>;
}
