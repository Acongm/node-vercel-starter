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
  };
  assistantMessage: string;
  provider?: string;
  model?: string;
  sources?: ChatSource[];
}

@Injectable()
export class ChatLogWriterService {
  private readonly logger = new Logger(ChatLogWriterService.name);

  constructor(private readonly chatLogsService: ChatLogsService) {}

  logFromRequest(req: Request, payload: ChatLogPayload): void {
    const meta = extractChatRequestMeta(req);
    void this.writeLog(meta, payload).catch((error) => {
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

    const input: CreateChatLogInput = {
      clientId: meta.clientId,
      callSource: meta.callSource,
      conversationId: meta.conversationId,
      endpoint: payload.endpoint,
      requestId: meta.requestId,
      userMessage,
      assistantMessage: payload.assistantMessage,
      context: payload.dto.context,
      provider: payload.provider,
      model: payload.model,
      enableWebSearch: payload.dto.enableWebSearch ?? false,
      sources: payload.sources,
      origin: meta.origin,
      userAgent: meta.userAgent,
    };

    await this.chatLogsService.create(input);
  }
}
