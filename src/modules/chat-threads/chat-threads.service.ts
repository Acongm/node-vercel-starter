import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { DataStore } from '../../adapters/data-store/data-store.interface';
import { extractChatRequestMeta } from '../../common/chat-request-meta';
import { CHAT_MESSAGE_STORE, CHAT_THREAD_STORE } from '../../common/tokens';
import { AiV1Service } from '../ai/v1/ai-v1.service';
import { ChatV1Dto } from '../ai/v1/chat-v1.dto';
import { AuthPrincipal } from '../auth/roles';
import { ChatLogWriterService } from '../chat-logs/chat-log-writer.service';
import {
  ChatMessageRecord,
  ChatThreadRecord,
  CreateChatMessageInput,
} from './chat-thread-record';
import {
  CreateChatThreadDto,
  CreateThreadMessageDto,
} from './dto/chat-thread.dto';

@Injectable()
export class ChatThreadsService {
  constructor(
    @Inject(CHAT_THREAD_STORE)
    private readonly threads: DataStore<ChatThreadRecord>,
    @Inject(CHAT_MESSAGE_STORE)
    private readonly messages: DataStore<ChatMessageRecord>,
    private readonly aiV1Service: AiV1Service,
    private readonly chatLogWriter: ChatLogWriterService,
  ) {}

  async create(
    dto: CreateChatThreadDto,
    req: Request,
    principal: AuthPrincipal,
  ): Promise<ChatThreadRecord> {
    const meta = extractChatRequestMeta(req);
    if (principal.tier === 'anon' && !meta.clientId) {
      throw new BadRequestException(
        'Anonymous chat requires x-client-id header.',
      );
    }
    return this.threads.create({
      userId: principal.userId || undefined,
      clientId: meta.clientId,
      conversationId: dto.conversationId || meta.conversationId,
      title: dto.title,
      callSource: meta.callSource,
      pagePath: dto.pagePath,
      moduleKey: dto.moduleKey,
      metadata: {},
    });
  }

  async list(
    req: Request,
    principal: AuthPrincipal,
  ): Promise<ChatThreadRecord[]> {
    const meta = extractChatRequestMeta(req);
    const all = await this.threads.list();
    return all.filter((thread) => this.canAccess(thread, principal, meta.clientId));
  }

  /**
   * After OAuth login: move anonymous threads (clientId, no userId) to the user.
   */
  async claimAnonymousThreads(
    clientId: string,
    principal: AuthPrincipal,
  ): Promise<{ claimedThreads: number; threadIds: string[] }> {
    if (principal.tier !== 'user' || !principal.userId) {
      throw new ForbiddenException({
        code: 'AUTH_REQUIRED',
        message: 'Login required to claim anonymous threads.',
      });
    }
    if (!clientId?.trim()) {
      throw new BadRequestException('clientId is required.');
    }

    const all = await this.threads.list();
    const owned = all.filter(
      (thread) => thread.clientId === clientId && !thread.userId,
    );
    const threadIds: string[] = [];
    for (const thread of owned) {
      await this.threads.update(thread.id, {
        userId: principal.userId,
        clientId: thread.clientId,
      });
      threadIds.push(thread.id);
    }

    return { claimedThreads: threadIds.length, threadIds };
  }

  async get(
    id: string,
    req: Request,
    principal: AuthPrincipal,
  ): Promise<{ thread: ChatThreadRecord; messages: ChatMessageRecord[] }> {
    const thread = await this.requireThread(id, req, principal);
    const messages = (await this.messages.list())
      .filter((message) => message.threadId === id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { thread, messages };
  }

  async remove(
    id: string,
    req: Request,
    principal: AuthPrincipal,
  ): Promise<void> {
    await this.requireThread(id, req, principal);
    const messages = (await this.messages.list()).filter(
      (message) => message.threadId === id,
    );
    await Promise.all(messages.map((message) => this.messages.delete(message.id)));
    await this.threads.delete(id);
  }

  async appendMessage(
    id: string,
    dto: CreateThreadMessageDto,
    req: Request,
    principal: AuthPrincipal,
  ) {
    await this.aiV1Service.enforceRateLimit(req, principal);
    const { thread, messages } = await this.get(id, req, principal);
    await this.messages.create({
      threadId: thread.id,
      role: 'user',
      content: dto.content,
      metadata: {},
      sources: [],
    });

    const chatDto = this.toChatDto(thread, messages, dto);
    const result = await this.aiV1Service.chat(chatDto, req, {
      skipRateLimit: true,
      principal,
      endpoint: '/api/chat/threads/:id/messages',
    });

    const assistant = await this.messages.create({
      threadId: thread.id,
      role: 'assistant',
      content: result.message,
      thinking: result.thinking,
      model: result.model,
      provider: result.provider,
      tokenInput: result.usage?.promptTokens,
      tokenOutput: result.usage?.completionTokens,
      sources: result.sources || [],
      metadata: {},
    });

    await this.maybeSetTitle(thread, dto.content);
    return {
      threadId: thread.id,
      message: assistant,
      sources: result.sources,
      usage: result.usage,
      thinking: result.thinking,
    };
  }

  async *streamMessage(
    id: string,
    dto: CreateThreadMessageDto,
    req: Request,
    principal: AuthPrincipal,
    signal?: AbortSignal,
  ) {
    // Rate limit is enforced by the controller before streaming starts.
    const { thread, messages } = await this.get(id, req, principal);
    await this.messages.create({
      threadId: thread.id,
      role: 'user',
      content: dto.content,
      metadata: {},
      sources: [],
    });

    const chatDto = this.toChatDto(thread, messages, dto);
    let assistantMessage = '';
    let thinking = '';
    let provider = '';
    let model = '';
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let totalTokens: number | undefined;
    let sources: CreateChatMessageInput['sources'] = [];

    for await (const event of this.aiV1Service.stream(chatDto, {
      signal,
      principal,
    })) {
      if (event.type === 'meta') {
        provider = event.provider;
        model = event.model;
      }
      if (event.type === 'sources') sources = event.sources;
      if (event.type === 'thinking') thinking += event.content;
      if (event.type === 'delta') assistantMessage += event.content;
      if (event.type === 'usage') {
        promptTokens = event.promptTokens;
        completionTokens = event.completionTokens;
        totalTokens = event.totalTokens;
      }
      yield event;
    }

    if (assistantMessage.trim()) {
      const saved = await this.messages.create({
        threadId: thread.id,
        role: 'assistant',
        content: assistantMessage,
        thinking: thinking || undefined,
        model,
        provider,
        tokenInput: promptTokens,
        tokenOutput: completionTokens,
        sources: sources || [],
        metadata: {},
      });
      await this.maybeSetTitle(thread, dto.content);
      await this.chatLogWriter.logFromRequest(req, {
        endpoint: '/api/chat/threads/:id/messages/stream',
        dto: chatDto,
        assistantMessage,
        thinking: thinking || undefined,
        provider,
        model,
        sources,
        userId: principal.userId,
        promptTokens,
        completionTokens,
        totalTokens,
      });
      yield {
        type: 'persisted' as const,
        messageId: saved.id,
        threadId: thread.id,
      };
    }
  }

  private toChatDto(
    thread: ChatThreadRecord,
    priorMessages: ChatMessageRecord[],
    dto: CreateThreadMessageDto,
  ): ChatV1Dto {
    const history = [
      ...priorMessages
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content,
        })),
      { role: 'user' as const, content: dto.content },
    ];

    return {
      messages: history,
      historyMode: 'long',
      enableThinking: dto.enableThinking,
      enableWebSearch: dto.enableWebSearch,
      maxTokens: dto.maxTokens,
      conversationId: thread.conversationId || thread.id,
      context: {
        scope: dto.context?.scope || 'article',
        pagePath: dto.context?.pagePath || thread.pagePath || '/',
        moduleKey: dto.context?.moduleKey || thread.moduleKey || '_general',
        title: dto.context?.title || thread.title || '通用对话',
        tags: dto.context?.tags,
        ...(dto.context?.content?.trim()
          ? { content: dto.context.content.trim() }
          : {}),
        ...(dto.context?.contentHash?.trim()
          ? { contentHash: dto.context.contentHash.trim() }
          : {}),
      },
    };
  }

  private async maybeSetTitle(thread: ChatThreadRecord, userContent: string) {
    if (thread.title?.trim()) return;
    const title = userContent.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!title) return;
    await this.threads.update(thread.id, { title });
  }

  private async requireThread(
    id: string,
    req: Request,
    principal: AuthPrincipal,
  ): Promise<ChatThreadRecord> {
    const thread = await this.threads.get(id);
    if (!thread) {
      throw new NotFoundException('Chat thread not found.');
    }
    const meta = extractChatRequestMeta(req);
    if (!this.canAccess(thread, principal, meta.clientId)) {
      throw new ForbiddenException('Chat thread is not accessible.');
    }
    return thread;
  }

  private canAccess(
    thread: ChatThreadRecord,
    principal: AuthPrincipal,
    clientId?: string,
  ): boolean {
    if (principal.tier === 'user' && principal.userId) {
      return thread.userId === principal.userId;
    }
    if (!clientId) return false;
    return thread.clientId === clientId && !thread.userId;
  }
}
