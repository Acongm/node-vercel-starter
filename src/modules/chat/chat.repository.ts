import { Injectable, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseRequestClientService } from '../auth/supabase-request-client.service';
import { CreateChatDto, UpdateChatDto } from './dto/chat.dto';
import {
  ChatMessagePart,
  ChatMessageRecord,
  ChatRecord,
  ChatRole,
} from './chat.types';

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
      .select('id, chat_id, user_id, role, parts, metadata, created_at')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to list chat messages: ${error.message}`);
    return (data || []) as ChatMessageRecord[];
  }

  async createMessage(
    request: Request,
    input: {
      chatId: string;
      userId: string;
      role: ChatRole;
      parts: ChatMessagePart[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<ChatMessageRecord> {
    const client = this.supabaseClients.create(request);
    const { data, error } = await client
      .from('messages')
      .insert({
        chat_id: input.chatId,
        user_id: input.userId,
        role: input.role,
        parts: input.parts,
        metadata: input.metadata || {},
      })
      .select('id, chat_id, user_id, role, parts, metadata, created_at')
      .single();

    if (error) throw new Error(`Failed to create chat message: ${error.message}`);
    return data as ChatMessageRecord;
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
