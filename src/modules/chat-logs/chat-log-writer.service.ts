import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { ChatSource } from '../../adapters/ai/ai-client.interface';
import {
  ChatRequestMeta,
  extractChatRequestMeta,
  extractLastUserMessage,
} from '../../common/chat-request-meta';
import { ChatLogContext, CreateChatLogInput } from './chat-log-record';
import { ChatLogsService } from './chat-logs.service';

export interface ChatLogPayload {
  endpoint: string;
  dto: {
    prompt?: string;
    messages?: Array<{ role: string; content: string }>;
    context?: ChatLogContext;
    enableWebSearch?: boolean;
    conversationId?: string;
  };
  assistantMessage: string;
  thinking?: string;
  provider?: string;
  model?: string;
  sources?: ChatSource[];
  userId?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

/** Avoid logging full thinking chains to third parties; keep a short sample. */
const THINKING_LOG_CHAR_BUDGET = 2000;

@Injectable()
export class ChatLogWriterService {
  private readonly logger = new Logger(ChatLogWriterService.name);

  constructor(private readonly chatLogsService: ChatLogsService) {}

  logFromRequest(req: Request, payload: ChatLogPayload): Promise<void> {
    return this.writeLog(extractChatRequestMeta(req), payload).catch((error) => {
      const message =
        error instanceof Error ? error.message : 'Unknown chat log write error.';
      this.logger.error(`Failed to write chat log: ${message}`);
    });
  }

  private async writeLog(
    meta: ChatRequestMeta,
    payload: ChatLogPayload,
  ): Promise<void> {
    const userMessage = extractLastUserMessage(payload.dto);
    if (!userMessage || !payload.assistantMessage.trim()) {
      return;
    }

    const thinking = payload.thinking?.trim()
      ? payload.thinking.trim().slice(0, THINKING_LOG_CHAR_BUDGET)
      : undefined;

    const input: CreateChatLogInput = {
      userId: payload.userId || undefined,
      clientId: meta.clientId,
      callSource: meta.callSource,
      conversationId:
        payload.dto.conversationId || meta.conversationId || undefined,
      endpoint: payload.endpoint,
      requestId: meta.requestId,
      userMessage,
      assistantMessage: payload.assistantMessage,
      thinking,
      context: payload.dto.context,
      provider: payload.provider,
      model: payload.model,
      enableWebSearch: payload.dto.enableWebSearch ?? false,
      sources: payload.sources,
      promptTokens: payload.promptTokens,
      completionTokens: payload.completionTokens,
      totalTokens: payload.totalTokens,
      origin: meta.origin,
      userAgent: meta.userAgent,
    };

    await this.chatLogsService.create(input);
  }
}
