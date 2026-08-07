import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AiV1Service } from '../ai/v1/ai-v1.service';
import { ChatV1Dto } from '../ai/v1/chat-v1.dto';
import { AuthPrincipal } from '../auth/roles';
import { ChatLogWriterService } from '../chat-logs/chat-log-writer.service';
import { ChatRepository } from './chat.repository';
import { ChatMessagePart, textFromParts } from './chat.types';
import { CreateChatDto, CreateChatMessageDto, UpdateChatDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly repository: ChatRepository,
    private readonly aiV1Service: AiV1Service,
    private readonly chatLogWriter: ChatLogWriterService,
  ) {}

  list(request: Request) {
    return this.repository.list(request);
  }

  create(request: Request, principal: AuthPrincipal, dto: CreateChatDto) {
    return this.repository.create(request, this.requireUserId(principal), dto);
  }

  async get(request: Request, id: string) {
    const chat = await this.repository.get(request, id);
    const messages = await this.repository.listMessages(request, id);
    return { chat, messages };
  }

  update(request: Request, id: string, dto: UpdateChatDto) {
    return this.repository.update(request, id, dto);
  }

  delete(request: Request, id: string) {
    return this.repository.delete(request, id);
  }

  listMessages(request: Request, id: string) {
    return this.repository.listMessages(request, id);
  }

  async *streamMessage(
    id: string,
    dto: CreateChatMessageDto,
    request: Request,
    principal: AuthPrincipal,
    signal?: AbortSignal,
  ) {
    const userId = this.requireUserId(principal);
    await this.aiV1Service.enforceRateLimit(request);

    const chat = await this.repository.get(request, id);
    const priorMessages = await this.repository.listMessages(request, id);

    const userMessage = await this.repository.createMessage(request, {
      chatId: id,
      userId,
      role: 'user',
      parts: [{ type: 'text', text: dto.content }],
    });
    await this.repository.touch(request, id);

    yield {
      type: 'user-persisted' as const,
      chatId: id,
      messageId: userMessage.id,
    };

    const chatDto = this.toChatDto(chat, priorMessages, dto);
    let assistantText = '';
    let reasoning = '';
    let provider = '';
    let model = '';
    let sources: { title: string; url: string }[] = [];
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let totalTokens: number | undefined;
    let streamDone = false;

    for await (const event of this.aiV1Service.stream(chatDto, {
      signal,
      principal,
    })) {
      if (event.type === 'meta') {
        provider = event.provider;
        model = event.model;
      } else if (event.type === 'sources') {
        sources = event.sources;
      } else if (event.type === 'thinking') {
        reasoning += event.content;
      } else if (event.type === 'delta') {
        assistantText += event.content;
      } else if (event.type === 'usage') {
        promptTokens = event.promptTokens;
        completionTokens = event.completionTokens;
        totalTokens = event.totalTokens;
      } else if (event.type === 'done') {
        // Persist the assistant message before exposing the terminal event.
        // Clients are allowed to stop reading once `done` is observed.
        streamDone = true;
        continue;
      }
      yield event;
    }

    const parts: ChatMessagePart[] = [];
    if (reasoning.trim()) {
      parts.push({ type: 'reasoning', text: reasoning });
    }
    if (assistantText.trim()) {
      parts.push({ type: 'text', text: assistantText });
    }
    for (const source of sources) {
      parts.push({ type: 'source', source });
    }

    if (parts.length > 0) {
      const assistant = await this.repository.createMessage(request, {
        chatId: id,
        userId,
        role: 'assistant',
        parts,
        metadata: {
          provider,
          model,
          usage: {
            promptTokens,
            completionTokens,
            totalTokens,
          },
        },
      });
      await this.repository.touch(request, id);
      await this.maybeSetTitle(request, chat.id, chat.title, dto.content);

      await this.chatLogWriter.logFromRequest(request, {
        endpoint: '/api/chats/:id/messages/stream',
        dto: chatDto,
        assistantMessage: assistantText,
        thinking: reasoning || undefined,
        provider,
        model,
        sources,
        userId,
        promptTokens,
        completionTokens,
        totalTokens,
      });

      yield {
        type: 'persisted' as const,
        chatId: id,
        messageId: assistant.id,
      };
    }

    if (streamDone) {
      yield { type: 'done' as const };
    }
  }

  private toChatDto(
    chat: {
      id: string;
      title: string | null;
      page_path: string | null;
      module_key: string | null;
    },
    priorMessages: { role: string; parts: ChatMessagePart[] }[],
    dto: CreateChatMessageDto,
  ): ChatV1Dto {
    const history = priorMessages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: textFromParts(message.parts),
      }))
      .filter((message) => message.content)
      .slice(-99);

    return {
      messages: [...history, { role: 'user', content: dto.content }],
      historyMode: 'long',
      enableThinking: dto.enableThinking,
      enableWebSearch: dto.enableWebSearch,
      maxTokens: dto.maxTokens,
      conversationId: chat.id,
      context: {
        ...dto.context,
        scope: dto.context?.scope || 'article',
        pagePath: dto.context?.pagePath || chat.page_path || '/',
        moduleKey: dto.context?.moduleKey || chat.module_key || '_general',
        title: dto.context?.title || chat.title || '通用对话',
      },
    };
  }

  private async maybeSetTitle(
    request: Request,
    chatId: string,
    currentTitle: string | null,
    content: string,
  ) {
    if (currentTitle?.trim()) return;
    const title = content.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (title) {
      await this.repository.update(request, chatId, { title });
    }
  }

  private requireUserId(principal: AuthPrincipal): string {
    if (!principal.userId || principal.source !== 'supabase') {
      throw new UnauthorizedException({
        code: 'SUPABASE_AUTH_REQUIRED',
        message: 'A verified Supabase user is required.',
      });
    }
    return principal.userId;
  }
}
