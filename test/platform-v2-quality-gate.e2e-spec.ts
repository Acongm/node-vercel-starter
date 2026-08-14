import { INestApplication, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  decodeChatCursor,
  encodeChatCursor,
  normalizePageLimit,
} from '../src/modules/chat/chat-pagination';
import { ChatRepository } from '../src/modules/chat/chat.repository';
import type {
  ChatMessageRecord,
  ChatRecord,
  ChatRunRecord,
} from '../src/modules/chat/chat.types';
import { SupabaseAuthService } from '../src/modules/auth/supabase-auth.service';
import { UserService } from '../src/modules/user/user.service';
import { configureApp } from '../src/runtime/configure-app';

type MemoryStore = {
  chats: Map<string, ChatRecord>;
  messages: Map<string, ChatMessageRecord>;
  runs: Map<string, ChatRunRecord>;
};

function createMemoryStore(): MemoryStore {
  return {
    chats: new Map(),
    messages: new Map(),
    runs: new Map(),
  };
}

function listMessagesTailFirst(
  store: MemoryStore,
  chatId: string,
  options: { limit?: number; before?: string; order?: 'asc' | 'desc' } = {},
) {
  const limit = normalizePageLimit(options.limit, 100, 100);
  const before = decodeChatCursor(options.before);
  let rows = [...store.messages.values()]
    .filter((message) => message.chat_id === chatId)
    .sort((left, right) => {
      if (left.created_at !== right.created_at) {
        return right.created_at.localeCompare(left.created_at);
      }
      return right.id.localeCompare(left.id);
    });

  if (before) {
    rows = rows.filter((message) => {
      if (message.created_at < before.timestamp) return true;
      return (
        message.created_at === before.timestamp && message.id < before.id
      );
    });
  }

  const hasMore = rows.length > limit;
  const window = rows.slice(0, limit).reverse();
  const oldest = window[0];
  return {
    messages: window,
    nextCursor: null as string | null,
    prevCursor:
      hasMore && oldest
        ? encodeChatCursor({ timestamp: oldest.created_at, id: oldest.id })
        : null,
  };
}

function createInMemoryChatRepository(store: MemoryStore): ChatRepository {
  const repository = Object.create(ChatRepository.prototype) as ChatRepository;

  repository.list = async (_request, options = {}) => {
    const chats = [...store.chats.values()].sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at),
    );
    return { chats: chats.slice(0, options.limit ?? 50), nextCursor: null };
  };

  repository.create = async (_request, userId, dto) => {
    const now = new Date().toISOString();
    const chat: ChatRecord = {
      id: randomUUID(),
      user_id: userId,
      title: dto.title?.trim() || null,
      page_path: dto.pagePath || null,
      module_key: dto.moduleKey || null,
      metadata: dto.metadata || {},
      created_at: now,
      updated_at: now,
    };
    store.chats.set(chat.id, chat);
    return chat;
  };

  repository.get = async (_request, id) => {
    const chat = store.chats.get(id);
    if (!chat) throw new NotFoundException('Chat not found.');
    return chat;
  };

  repository.listMessages = async (_request, chatId, options = {}) => {
    if (!store.chats.has(chatId)) {
      throw new NotFoundException('Chat not found.');
    }
    if (options.order === 'desc') {
      return listMessagesTailFirst(store, chatId, options);
    }
    const rows = [...store.messages.values()]
      .filter((message) => message.chat_id === chatId)
      .sort((left, right) => left.created_at.localeCompare(right.created_at));
    return { messages: rows, nextCursor: null };
  };

  repository.listRecentMessages = async (_request, chatId, limit = 500) => {
    return listMessagesTailFirst(store, chatId, { limit }).messages;
  };

  repository.delete = async (_request, id) => {
    store.chats.delete(id);
    for (const [messageId, message] of store.messages) {
      if (message.chat_id === id) store.messages.delete(messageId);
    }
  };

  repository.update = async (_request, id, dto) => {
    const chat = store.chats.get(id);
    if (!chat) throw new NotFoundException('Chat not found.');
    const next = {
      ...chat,
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      updated_at: new Date().toISOString(),
    };
    store.chats.set(id, next);
    return next;
  };

  repository.createMessage = async (_request, input) => {
    const message: ChatMessageRecord = {
      id: randomUUID(),
      chat_id: input.chatId,
      user_id: input.userId,
      client_message_id: input.clientMessageId || null,
      parent_message_id: input.parentMessageId ?? null,
      role: input.role,
      parts: input.parts,
      metadata: input.metadata || {},
      created_at: new Date().toISOString(),
    };
    store.messages.set(message.id, message);
    return message;
  };

  repository.findMessageByClientId = async () => null;
  repository.findMessageByReference = async (_request, chatId, reference) =>
    [...store.messages.values()].find(
      (message) => message.chat_id === chatId && message.id === reference,
    ) || null;
  repository.getRun = async (_request, runId) => store.runs.get(runId) || null;
  repository.createRun = async (_request, input) => {
    const run: ChatRunRecord = {
      id: input.id || randomUUID(),
      chat_id: input.chatId,
      user_id: input.userId,
      user_message_id: input.userMessageId,
      assistant_message_id: null,
      status: 'running',
      error_message: null,
      metadata: input.metadata || {},
      started_at: new Date().toISOString(),
      completed_at: null,
      updated_at: new Date().toISOString(),
    };
    store.runs.set(run.id, run);
    return { run, created: true };
  };
  repository.updateRun = async (_request, runId, patch) => {
    const run = store.runs.get(runId);
    if (!run) throw new NotFoundException('Chat run not found.');
    const next = {
      ...run,
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.assistantMessageId !== undefined
        ? { assistant_message_id: patch.assistantMessageId }
        : {}),
      updated_at: new Date().toISOString(),
    };
    store.runs.set(runId, next);
    return next;
  };
  repository.touch = async () => undefined;

  return repository;
}

function seedMessages(
  store: MemoryStore,
  chatId: string,
  userId: string,
  count: number,
) {
  const base = Date.parse('2026-08-08T00:00:00.000Z');
  for (let index = 0; index < count; index += 1) {
    const createdAt = new Date(base + index * 1000).toISOString();
    const message: ChatMessageRecord = {
      id: randomUUID(),
      chat_id: chatId,
      user_id: userId,
      client_message_id: null,
      parent_message_id: null,
      role: index % 2 === 0 ? 'user' : 'assistant',
      parts: [{ type: 'text', text: `message-${index + 1}` }],
      metadata: {},
      created_at: createdAt,
    };
    store.messages.set(message.id, message);
  }
}

describe('Platform v2 quality gate (#37 API path)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let store: MemoryStore;
  const userId = 'user-quality-gate';

  beforeEach(async () => {
    process.env.DATA_MODE = 'memory';
    process.env.AI_PROVIDER = 'mock';
    process.env.AUTH_MODE = 'jwt';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_API_KEY = 'test-key';
    process.env.SUPABASE_JWT_SECRET = 'supabase-test-secret';

    store = createMemoryStore();
    jwtService = new JwtService();
    const userSnapshot = {
      id: userId,
      email: 'quality@example.com',
      name: 'Quality User',
      role: 'viewer' as const,
      tier: 'user' as const,
      isAnonymous: false,
      profile: null,
      userInfo: {
        id: userId,
        displayName: 'Quality User',
        avatarUrl: null,
        email: 'quality@example.com',
        accountLabel: 'quality@example.com',
        role: 'viewer' as const,
        tier: 'user' as const,
        isAnonymous: false,
        source: 'auth' as const,
      },
      settings: { language: 'zh-CN', theme: 'system' as const, preferences: {} },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseAuthService)
      .useValue({
        isConfigured: () => true,
        verifyAccessToken: async (token: string) => {
          try {
            const payload = await jwtService.verifyAsync(token, {
              secret: 'supabase-test-secret',
            });
            return {
              userId: payload.sub,
              email: 'quality@example.com',
              name: 'Quality User',
              role: 'viewer' as const,
              tier: 'user' as const,
              source: 'supabase' as const,
            };
          } catch {
            return null;
          }
        },
      })
      .overrideProvider(UserService)
      .useValue({
        me: jest.fn().mockResolvedValue(userSnapshot),
        getUserInfo: jest.fn().mockResolvedValue(userSnapshot),
        getProfile: jest.fn().mockResolvedValue({
          profile: null,
          userInfo: userSnapshot.userInfo,
        }),
        getSettings: jest.fn().mockResolvedValue(userSnapshot.settings),
        updateSettings: jest.fn(),
        updateProfile: jest.fn(),
      })
      .overrideProvider(ChatRepository)
      .useValue(createInMemoryChatRepository(store))
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_API_KEY;
    delete process.env.SUPABASE_JWT_SECRET;
  });

  async function bearerToken() {
    return jwtService.signAsync(
      { sub: userId },
      { secret: 'supabase-test-secret', expiresIn: '1h' },
    );
  }

  it('returns userInfo from /api/user/info and /api/user/profile', async () => {
    const token = await bearerToken();

    const info = await request(app.getHttpServer())
      .get('/api/user/info')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(info.body.userInfo).toMatchObject({
      displayName: 'Quality User',
      email: 'quality@example.com',
      isAnonymous: false,
    });

    const profile = await request(app.getHttpServer())
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profile.body.userInfo.displayName).toBe('Quality User');
  });

  it('creates a chat, returns tail-first history, and pages older messages with before', async () => {
    const token = await bearerToken();

    const created = await request(app.getHttpServer())
      .post('/api/chats')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Quality gate chat', pagePath: '/docs', moduleKey: 'docs' })
      .expect(201);

    seedMessages(store, created.body.id, userId, 5);

    const latest = await request(app.getHttpServer())
      .get(`/api/chats/${created.body.id}?order=desc&limit=2`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(latest.body.messages).toHaveLength(2);
    expect(latest.body.messages[0].parts[0].text).toBe('message-4');
    expect(latest.body.messages[1].parts[0].text).toBe('message-5');
    expect(latest.body.prevCursor).toEqual(expect.any(String));
    expect(latest.body.nextCursor).toBeNull();

    const older = await request(app.getHttpServer())
      .get(
        `/api/chats/${created.body.id}/messages?order=desc&limit=10&before=${encodeURIComponent(latest.body.prevCursor)}`,
      )
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(older.body.messages).toHaveLength(3);
    expect(older.body.messages[0].parts[0].text).toBe('message-1');
    expect(older.body.messages[2].parts[0].text).toBe('message-3');
    expect(older.body.prevCursor).toBeNull();
  });

  it('rejects unauthenticated user API calls with AUTH_REQUIRED', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/user/info')
      .expect(401);

    expect(response.body).toMatchObject({
      code: 'AUTH_REQUIRED',
      message: 'Missing Supabase access token.',
    });
  });

  it('rejects invalid bearer tokens with INVALID_TOKEN', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/user/info')
      .set('Authorization', 'Bearer not-a-valid-jwt')
      .expect(401);

    expect(response.body).toMatchObject({
      code: 'INVALID_TOKEN',
      message: 'Invalid or expired Supabase access token.',
    });
  });

  it('returns 404 for missing chats without leaking ownership details', async () => {
    const token = await bearerToken();
    const missingChatId = randomUUID();

    const response = await request(app.getHttpServer())
      .get(`/api/chats/${missingChatId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);

    expect(response.body.message).toBe('Chat not found.');
    expect(JSON.stringify(response.body)).not.toMatch(/password|secret|service_role/i);
  });

  it('streams a message after chat creation in memory mode', async () => {
    const token = await bearerToken();
    const created = await request(app.getHttpServer())
      .post('/api/chats')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Stream chat' })
      .expect(201);

    const stream = await request(app.getHttpServer())
      .post(`/api/chats/${created.body.id}/messages/stream`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'hello quality gate',
        runId: randomUUID(),
        clientMessageId: randomUUID(),
        assistantMessageId: randomUUID(),
      })
      .expect(201)
      .expect('content-type', /text\/event-stream/);

    expect(stream.text).toContain('event: user-persisted');
    expect(stream.text).toContain('event: delta');
    expect(stream.text).toContain('event: persisted');
    expect(stream.text).toContain('event: done');
  });
});
