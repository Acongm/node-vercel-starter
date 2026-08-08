import { Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseRequestClientService } from '../auth/supabase-request-client.service';
import { CreateChatDto, UpdateChatDto } from './dto/chat.dto';
import {
  ChatMessagePart,
  ChatMessageRecord,
  ChatRecord,
  ChatRole,
  ChatRunRecord,
  ChatRunStatus,
} from './chat.types';

const MESSAGE_SELECT =
  'id, chat_id, user_id, client_message_id, parent_message_id, role, parts, metadata, created_at';
const RUN_SELECT =
  'id, chat_id, user_id, user_message_id, assistant_message_id, status, error_message, metadata, started_at, completed_at, updated_at';

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

@Injectable()
export class ChatRepository {
  constructor(
    private readonly supabaseClients: SupabaseRequestClientService,
  ) {}

  async list(request: Request, limit = 50): Promise<ChatRecord[]> {
    const client = this.supabaseClients.create(request);
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const { data, error } = await client
      .from('chats')
      .select('id, user_id, title, page_path, module_key, metadata, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(safeLimit);

    if (error) throw new Error(`Failed to list chats: ${error.message}`);
    return (data || []) as ChatRecord[];
  }

  async create(
    request: Request,
    userId: string,
    dto: CreateChatDto,
  ): Promise<ChatRecord> {
    const client = this.supabaseClients.create(request);
    const { data, error } = await client
      .from('chats')
      .insert({
        user_id: userId,
        title: dto.title?.trim() || null,
        page_path: dto.pagePath?.trim() || null,
        module_key: dto.moduleKey?.trim() || null,
        metadata: dto.metadata || {},
      })
      .select('id, user_id, title, page_path, module_key, metadata, created_at, updated_at')
      .single();

    if (error) throw new Error(`Failed to create chat: ${error.message}`);
    return data as ChatRecord;
  }

  async get(request: Request, id: string): Promise<ChatRecord> {
    const client = this.supabaseClients.create(request);
    const { data, error } = await client
      .from('chats')
      .select('id, user_id, title, page_path, module_key, metadata, created_at, updated_at')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to load chat: ${error.message}`);
    if (!data) throw new NotFoundException('Chat not found.');
    return data as ChatRecord;
  }

  async update(
    request: Request,
    id: string,
    dto: UpdateChatDto,
  ): Promise<ChatRecord> {
    const client = this.supabaseClients.create(request);
    const patch = {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.pagePath !== undefined
        ? { page_path: dto.pagePath.trim() || null }
        : {}),
      ...(dto.moduleKey !== undefined
        ? { module_key: dto.moduleKey.trim() || null }
        : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
    };

    if (Object.keys(patch).length === 0) {
      return this.get(request, id);
    }

    const { data, error } = await client
      .from('chats')
      .update(patch)
      .eq('id', id)
      .select('id, user_id, title, page_path, module_key, metadata, created_at, updated_at')
      .maybeSingle();

    if (error) throw new Error(`Failed to update chat: ${error.message}`);
    if (!data) throw new NotFoundException('Chat not found.');
    return data as ChatRecord;
  }

  async delete(request: Request, id: string): Promise<void> {
    const client = this.supabaseClients.create(request);
    const { error } = await client.from('chats').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete chat: ${error.message}`);
  }

  async listMessages(
    request: Request,
    chatId: string,
  ): Promise<ChatMessageRecord[]> {
    const client = this.supabaseClients.create(request);
    const { data, error } = await client
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to list chat messages: ${error.message}`);
    return (data || []) as ChatMessageRecord[];
  }

  async findMessageByClientId(
    request: Request,
    chatId: string,
    clientMessageId: string,
  ): Promise<ChatMessageRecord | null> {
    const client = this.supabaseClients.create(request);
    const { data, error } = await client
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('chat_id', chatId)
      .eq('client_message_id', clientMessageId.trim())
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load chat message by client id: ${error.message}`);
    }
    return (data as ChatMessageRecord | null) || null;
  }

  async findMessageByReference(
    request: Request,
    chatId: string,
    reference: string,
  ): Promise<ChatMessageRecord | null> {
    const trimmed = reference.trim();
    const byClientId = await this.findMessageByClientId(request, chatId, trimmed);
    if (byClientId || !looksLikeUuid(trimmed)) return byClientId;

    const client = this.supabaseClients.create(request);
    const { data, error } = await client
      .from('messages')
      .select(MESSAGE_SELECT)
      .eq('chat_id', chatId)
      .eq('id', trimmed)
      .maybeSingle();

    if (error) throw new Error(`Failed to load chat message: ${error.message}`);
    return (data as ChatMessageRecord | null) || null;
  }

  async createMessage(
    request: Request,
    input: {
      chatId: string;
      userId: string;
      role: ChatRole;
      parts: ChatMessagePart[];
      metadata?: Record<string, unknown>;
      clientMessageId?: string;
      parentMessageId?: string | null;
    },
  ): Promise<ChatMessageRecord> {
    const client = this.supabaseClients.create(request);
    const clientMessageId = input.clientMessageId?.trim() || undefined;
    const row = {
      chat_id: input.chatId,
      user_id: input.userId,
      role: input.role,
      parts: input.parts,
      metadata: input.metadata || {},
      ...(clientMessageId ? { client_message_id: clientMessageId } : {}),
      ...(input.parentMessageId !== undefined
        ? { parent_message_id: input.parentMessageId }
        : {}),
    };

    if (clientMessageId) {
      const { data, error } = await client
        .from('messages')
        .upsert(row, {
          onConflict: 'chat_id,client_message_id',
          ignoreDuplicates: true,
        })
        .select(MESSAGE_SELECT)
        .maybeSingle();

      if (error) throw new Error(`Failed to create chat message: ${error.message}`);
      if (data) return data as ChatMessageRecord;

      const existing = await this.findMessageByClientId(
        request,
        input.chatId,
        clientMessageId,
      );
      if (existing) return existing;
      throw new Error('Failed to create chat message: idempotent row was not visible.');
    }

    const { data, error } = await client
      .from('messages')
      .insert(row)
      .select(MESSAGE_SELECT)
      .single();

    if (error) throw new Error(`Failed to create chat message: ${error.message}`);
    return data as ChatMessageRecord;
  }

  async getRun(request: Request, runId: string): Promise<ChatRunRecord | null> {
    const client = this.supabaseClients.create(request);
    const { data, error } = await client
      .from('chat_runs')
      .select(RUN_SELECT)
      .eq('id', runId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load chat run: ${error.message}`);
    return (data as ChatRunRecord | null) || null;
  }

  async createRun(
    request: Request,
    input: {
      id?: string;
      chatId: string;
      userId: string;
      userMessageId: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ run: ChatRunRecord; created: boolean }> {
    const client = this.supabaseClients.create(request);
    const row = {
      ...(input.id ? { id: input.id } : {}),
      chat_id: input.chatId,
      user_id: input.userId,
      user_message_id: input.userMessageId,
      status: 'running' as const,
      metadata: input.metadata || {},
    };

    if (input.id) {
      const { data, error } = await client
        .from('chat_runs')
        .upsert(row, { onConflict: 'id', ignoreDuplicates: true })
        .select(RUN_SELECT)
        .maybeSingle();

      if (error) throw new Error(`Failed to create chat run: ${error.message}`);
      if (data) return { run: data as ChatRunRecord, created: true };

      const existing = await this.getRun(request, input.id);
      if (existing) return { run: existing, created: false };
      throw new Error('Failed to create chat run: idempotent row was not visible.');
    }

    const { data, error } = await client
      .from('chat_runs')
      .insert(row)
      .select(RUN_SELECT)
      .single();

    if (error) throw new Error(`Failed to create chat run: ${error.message}`);
    return { run: data as ChatRunRecord, created: true };
  }

  async updateRun(
    request: Request,
    runId: string,
    patch: {
      status?: ChatRunStatus;
      assistantMessageId?: string | null;
      errorMessage?: string | null;
      metadata?: Record<string, unknown>;
      completedAt?: string | null;
    },
  ): Promise<ChatRunRecord> {
    const client = this.supabaseClients.create(request);
    const row = {
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.assistantMessageId !== undefined
        ? { assistant_message_id: patch.assistantMessageId }
        : {}),
      ...(patch.errorMessage !== undefined
        ? { error_message: patch.errorMessage }
        : {}),
      ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
      ...(patch.completedAt !== undefined
        ? { completed_at: patch.completedAt }
        : {}),
    };

    const { data, error } = await client
      .from('chat_runs')
      .update(row)
      .eq('id', runId)
      .select(RUN_SELECT)
      .maybeSingle();

    if (error) throw new Error(`Failed to update chat run: ${error.message}`);
    if (!data) throw new NotFoundException('Chat run not found.');
    return data as ChatRunRecord;
  }

  async touch(request: Request, chatId: string): Promise<void> {
    const client = this.supabaseClients.create(request);
    const { error } = await client
      .from('chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId);

    if (error) throw new Error(`Failed to touch chat: ${error.message}`);
  }
}
