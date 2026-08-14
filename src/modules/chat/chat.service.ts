import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { appLogger } from '../../common/app-logger';
import { RequestWithId } from '../../common/request-id.middleware';
import { AiV1Service } from '../ai/v1/ai-v1.service';
import { ChatV1Dto } from '../ai/v1/chat-v1.dto';
import type { ChatSettingsInjection } from '../ai/v1/chat-v1.policy';
import { AuthPrincipal } from '../auth/roles';
import { ChatLogWriterService } from '../chat-logs/chat-log-writer.service';
import { UserService } from '../user/user.service';
import { ChatContractError } from './chat.errors';
import { ChatRepository } from './chat.repository';
import {
  ChatMessagePart,
  ChatMessageRecord,
  ChatRunRecord,
  selectMessageBranch,
  textFromParts,
} from './chat.types';
import {
  ChatPageQueryDto,
  CreateChatDto,
  CreateChatMessageDto,
  UpdateChatDto,
} from './dto/chat.dto';

/** Bounded model-context window; persisted history pagination is a separate API. */
export const CHAT_MODEL_CONTEXT_LIMIT = 500;

@Injectable()
export class ChatService {
  constructor(
    private readonly repository: ChatRepository,
    private readonly aiV1Service: AiV1Service,
    private readonly chatLogWriter: ChatLogWriterService,
    @Optional() private readonly userService?: UserService,
  ) {}

  list(request: Request, query: ChatPageQueryDto = {}) {
    return this.repository.list(request, query);
  }

  create(request: Request, principal: AuthPrincipal, dto: CreateChatDto) {
    return this.repository.create(request, this.requireUserId(principal), dto);
  }

  async get(request: Request, id: string, query: ChatPageQueryDto = {}) {
    const chat = await this.repository.get(request, id);
    const page = await this.repository.listMessages(request, id, {
      limit: query.limit ?? 100,
      order: query.order ?? 'desc',
      before: query.before,
      after: query.order === 'asc' ? query.after : undefined,
    });
    return { chat, ...page };
  }

  update(request: Request, id: string, dto: UpdateChatDto) {
    return this.repository.update(request, id, dto);
  }

  delete(request: Request, id: string) {
    return this.repository.delete(request, id);
  }

  async listMessages(
    request: Request,
    id: string,
    query: ChatPageQueryDto = {},
  ) {
    if (query.after && query.before) {
      throw new BadRequestException({
        code: 'CHAT_INVALID_CURSOR',
        message: 'Use either after or before, not both.',
      });
    }
    await this.repository.get(request, id);
    return this.repository.listMessages(request, id, query);
  }

  async *streamMessage(
    id: string,
    dto: CreateChatMessageDto,
    request: Request,
    principal: AuthPrincipal,
    signal?: AbortSignal,
  ) {
    const userId = this.requireUserId(principal);
    const startedAt = Date.now();
    await this.aiV1Service.enforceRateLimit(request, principal);

    const [chat, priorMessages, settings] = await Promise.all([
      this.repository.get(request, id),
      // Model context is deliberately bounded and separate from persisted history
      // pagination. The model only projects the latest selected branch below.
      this.repository.listRecentMessages(request, id, CHAT_MODEL_CONTEXT_LIMIT),
      this.loadSendSettings(request, principal),
    ]);
    const parentMessage = dto.parentMessageId
      ? await this.resolveParentMessage(request, id, dto.parentMessageId)
      : priorMessages.at(-1) || null;

    const { message: userMessage, reused: userMessageReused } =
      await this.ensureUserMessage(request, id, userId, dto, parentMessage);

    const { run, created: runCreated } = await this.repository.createRun(request, {
      id: dto.runId,
      chatId: id,
      userId,
      userMessageId: userMessage.id,
      metadata: {
        clientMessageId: dto.clientMessageId || null,
        assistantMessageId: dto.assistantMessageId || null,
      },
    });

    this.assertRunMatchesRequest(run, id, userId, userMessage.id);
    if (!userMessageReused) await this.safeTouch(request, id);

    yield {
      type: 'user-persisted' as const,
      chatId: id,
      messageId: userMessage.id,
      clientMessageId: userMessage.client_message_id || dto.clientMessageId || undefined,
      runId: run.id,
      reused: userMessageReused,
    };

    if (!runCreated) {
      yield* this.replayExistingRun(request, run);
      return;
    }

    const branchMessages = selectMessageBranch(
      this.withCurrentMessage(priorMessages, userMessage),
      userMessage.id,
    );
    const chatDto = this.toChatDto(chat, branchMessages, dto);

    let assistantText = '';
    let reasoning = '';
    let provider = '';
    let model = '';
    let sources: { title: string; url: string }[] = [];
    let promptTokens: number | undefined;
    let completionTokens: number | undefined;
    let totalTokens: number | undefined;
    let streamDone = false;
    let firstTokenLogged = false;
    const requestId = (request as RequestWithId).requestId;
    const noteFirstToken = () => {
      if (firstTokenLogged) return;
      firstTokenLogged = true;
      appLogger.info({
        event: 'chat.first_token',
        requestId,
        chatId: id,
        userId,
        durationMs: Date.now() - startedAt,
      });
    };

    try {
      for await (const event of this.aiV1Service.stream(chatDto, {
        signal,
        principal,
        settings,
      })) {
        if (event.type === 'meta') {
          provider = event.provider;
          model = event.model;
        } else if (event.type === 'sources') {
          sources = event.sources;
        } else if (event.type === 'thinking') {
          reasoning += event.content;
          if (event.content) noteFirstToken();
        } else if (event.type === 'delta') {
          assistantText += event.content;
          if (event.content) noteFirstToken();
        } else if (event.type === 'usage') {
          promptTokens = event.promptTokens;
          completionTokens = event.completionTokens;
          totalTokens = event.totalTokens;
        } else if (event.type === 'done') {
          streamDone = true;
          continue;
        }
        yield event;
      }

      if (signal?.aborted) {
        await this.finishRun(request, run.id, 'cancelled', undefined, 'Request cancelled.');
        return;
      }

      if (!streamDone) {
        throw new ChatContractError(
          'CHAT_STREAM_INCOMPLETE',
          'Model stream ended before completion.',
        );
      }

      if (!reasoning.trim() && !assistantText.trim()) {
        throw new ChatContractError(
          'CHAT_EMPTY_RESPONSE',
          'Model returned no usable content.',
        );
      }

      const parts = this.assistantParts(reasoning, assistantText, sources);
      const assistant = await this.repository.createMessage(request, {
        chatId: id,
        userId,
        role: 'assistant',
        parts,
        clientMessageId: dto.assistantMessageId,
        parentMessageId: userMessage.id,
        metadata: {
          provider,
          model,
          usage: {
            promptTokens,
            completionTokens,
            totalTokens,
          },
          runId: run.id,
        },
      });

      // This write is the authoritative terminal state. Nothing auxiliary below
      // is allowed to turn a completed durable run back into a product failure.
      await this.repository.updateRun(request, run.id, {
        status: 'complete',
        assistantMessageId: assistant.id,
        errorMessage: null,
        completedAt: new Date().toISOString(),
        metadata: {
          provider,
          model,
          usage: { promptTokens, completionTokens, totalTokens },
          clientMessageId: dto.clientMessageId || null,
          assistantMessageId: dto.assistantMessageId || null,
        },
      });

      await this.safeTouch(request, id);
      await this.safeMaybeSetTitle(request, chat.id, chat.title, dto.content);
      await this.safeTelemetry(request, {
        chatDto,
        assistantText,
        reasoning,
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
        clientMessageId:
          assistant.client_message_id || dto.assistantMessageId || undefined,
        runId: run.id,
      };
      yield { type: 'done' as const, runId: run.id, status: 'complete' as const };
    } catch (error) {
      const cancelled = signal?.aborted || this.isAbortError(error);
      try {
        await this.finishRun(
          request,
          run.id,
          cancelled ? 'cancelled' : 'error',
          undefined,
          cancelled ? 'Request cancelled.' : this.errorMessage(error),
        );
      } catch {
        // Preserve the original provider/persistence failure.
      }

      if (cancelled) return;
      throw error;
    }
  }

  private async ensureUserMessage(
    request: Request,
    chatId: string,
    userId: string,
    dto: CreateChatMessageDto,
    parentMessage: ChatMessageRecord | null,
  ): Promise<{ message: ChatMessageRecord; reused: boolean }> {
    const clientMessageId = dto.clientMessageId?.trim();
    if (clientMessageId) {
      const existing = await this.repository.findMessageByClientId(
        request,
        chatId,
        clientMessageId,
      );
      if (existing) {
        if (existing.role !== 'user' || textFromParts(existing.parts) !== dto.content.trim()) {
          throw new ConflictException({
            code: 'CHAT_MESSAGE_IDEMPOTENCY_CONFLICT',
            message: 'clientMessageId is already bound to different message content.',
          });
        }
        if (
          dto.parentMessageId !== undefined &&
          existing.parent_message_id !== parentMessage?.id
        ) {
          throw new ConflictException({
            code: 'CHAT_MESSAGE_PARENT_CONFLICT',
            message: 'clientMessageId is already bound to a different parent message.',
          });
        }
        return { message: existing, reused: true };
      }
    }

    const message = await this.repository.createMessage(request, {
      chatId,
      userId,
      role: 'user',
      parts: [{ type: 'text', text: dto.content }],
      clientMessageId,
      parentMessageId: parentMessage?.id || null,
    });
    return { message, reused: false };
  }

  private async resolveParentMessage(
    request: Request,
    chatId: string,
    reference: string,
  ): Promise<ChatMessageRecord> {
    const parent = await this.repository.findMessageByReference(
      request,
      chatId,
      reference,
    );
    if (!parent) {
      throw new BadRequestException({
        code: 'CHAT_PARENT_NOT_FOUND',
        message: 'parentMessageId does not reference a visible message in this chat.',
      });
    }
    return parent;
  }

  private assertRunMatchesRequest(
    run: ChatRunRecord,
    chatId: string,
    userId: string,
    userMessageId: string,
  ) {
    if (
      run.chat_id !== chatId ||
      run.user_id !== userId ||
      run.user_message_id !== userMessageId
    ) {
      throw new ConflictException({
        code: 'CHAT_RUN_IDEMPOTENCY_CONFLICT',
        message: 'runId is already bound to another chat or user message.',
      });
    }
  }

  private async *replayExistingRun(request: Request, run: ChatRunRecord) {
    if (run.status === 'running') {
      throw new ConflictException({
        code: 'CHAT_RUN_IN_PROGRESS',
        message: 'This runId is already running.',
      });
    }
    if (run.status === 'cancelled' || run.status === 'error') {
      throw new ConflictException({
        code: 'CHAT_RUN_TERMINAL',
        status: run.status,
        message:
          run.error_message ||
          `This runId is already ${run.status}; create a new runId to retry.`,
      });
    }

    const assistant = run.assistant_message_id
      ? await this.repository.findMessageByReference(
          request,
          run.chat_id,
          run.assistant_message_id,
        )
      : null;

    if (assistant) {
      const reasoning = assistant.parts
        .filter((part) => part.type === 'reasoning' && 'text' in part)
        .map((part) => (typeof part.text === 'string' ? part.text : ''))
        .join('');
      const text = textFromParts(assistant.parts);
      const sources = assistant.parts
        .filter((part) => part.type === 'source' && 'source' in part)
        .map((part) => part.source)
        .filter(
          (source): source is { title: string; url: string } =>
            Boolean(
              source &&
                typeof source === 'object' &&
                'title' in source &&
                'url' in source &&
                typeof source.title === 'string' &&
                typeof source.url === 'string',
            ),
        );

      if (reasoning) yield { type: 'thinking' as const, content: reasoning };
      if (sources.length) yield { type: 'sources' as const, sources };
      if (text) yield { type: 'delta' as const, content: text };
      yield {
        type: 'persisted' as const,
        chatId: run.chat_id,
        messageId: assistant.id,
        clientMessageId: assistant.client_message_id || undefined,
        runId: run.id,
        replayed: true,
      };
    }

    yield {
      type: 'done' as const,
      runId: run.id,
      status: 'complete' as const,
      replayed: true,
    };
  }

  private assistantParts(
    reasoning: string,
    assistantText: string,
    sources: { title: string; url: string }[],
  ): ChatMessagePart[] {
    const parts: ChatMessagePart[] = [];
    if (reasoning.trim()) parts.push({ type: 'reasoning', text: reasoning });
    if (assistantText.trim()) parts.push({ type: 'text', text: assistantText });
    for (const source of sources) parts.push({ type: 'source', source });
    return parts;
  }

  private withCurrentMessage(
    messages: ChatMessageRecord[],
    current: ChatMessageRecord,
  ): ChatMessageRecord[] {
    return messages.some((message) => message.id === current.id)
      ? messages
      : [...messages, current];
  }

  private toChatDto(
    chat: {
      id: string;
      title: string | null;
      page_path: string | null;
      module_key: string | null;
    },
    branchMessages: ChatMessageRecord[],
    dto: CreateChatMessageDto,
  ): ChatV1Dto {
    const history = branchMessages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: textFromParts(message.parts),
      }))
      .filter((message) => message.content)
      .slice(-100);

    return {
      messages: history,
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

  private async finishRun(
    request: Request,
    runId: string,
    status: 'cancelled' | 'error',
    assistantMessageId?: string,
    errorMessage?: string,
  ) {
    await this.repository.updateRun(request, runId, {
      status,
      assistantMessageId,
      errorMessage: errorMessage || null,
      completedAt: new Date().toISOString(),
    });
  }

  private async safeTouch(request: Request, chatId: string) {
    try {
      await this.repository.touch(request, chatId);
    } catch {
      // updated_at is auxiliary to the durable message/run lifecycle.
    }
  }

  private async safeMaybeSetTitle(
    request: Request,
    chatId: string,
    currentTitle: string | null,
    content: string,
  ) {
    if (currentTitle?.trim()) return;
    const title = content.replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!title) return;
    try {
      await this.repository.update(request, chatId, { title });
    } catch {
      // Auto-title failure must not invalidate an already completed run.
    }
  }

  private async safeTelemetry(
    request: Request,
    input: {
      chatDto: ChatV1Dto;
      assistantText: string;
      reasoning: string;
      provider: string;
      model: string;
      sources: { title: string; url: string }[];
      userId: string;
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    },
  ) {
    try {
      await this.chatLogWriter.logFromRequest(request, {
        endpoint: '/api/chats/:id/messages/stream',
        dto: input.chatDto,
        assistantMessage: input.assistantText,
        thinking: input.reasoning || undefined,
        provider: input.provider,
        model: input.model,
        sources: input.sources,
        userId: input.userId,
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        totalTokens: input.totalTokens,
      });
    } catch {
      // Observability is auxiliary and always best-effort.
    }
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError';
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Chat run failed.';
  }

  private async loadSendSettings(
    request: Request,
    principal: AuthPrincipal,
  ): Promise<ChatSettingsInjection | undefined> {
    if (!this.userService) return undefined;
    try {
      const document = await this.userService.getSettings(request, principal);
      const defaultPrompt = document.effective.chat.defaultPrompt?.trim();
      return {
        defaultModel: document.effective.chat.defaultModel,
        defaultPrompt: defaultPrompt || undefined,
      };
    } catch {
      return undefined;
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
