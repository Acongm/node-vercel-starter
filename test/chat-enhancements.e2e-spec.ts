import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/runtime/configure-app';
import { ChatRateLimitService } from '../src/modules/ai/chat-rate-limit.service';

describe('Chat enhancements (thinking / threads / rate limit)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.DATA_MODE = 'memory';
    process.env.AI_PROVIDER = 'mock';
    process.env.AUTH_MODE = 'none';
    process.env.SITE_LIMIT_ANON_CHAT_PER_DAY = '100';
    delete process.env.AUTH_ADMIN_USERNAME;
    delete process.env.AUTH_ADMIN_PASSWORD;
    delete process.env.AUTH_JWT_SECRET;
    delete process.env.SUPABASE_JWT_SECRET;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    app.get(ChatRateLimitService).reset();
  });

  afterEach(async () => {
    await app?.close();
    delete process.env.SITE_LIMIT_ANON_CHAT_PER_DAY;
  });

  it('streams thinking events when enableThinking is true', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/ai/v1/chat/stream')
      .set('x-client-id', 'client-think')
      .send({
        prompt: '解释 Fiber',
        enableThinking: true,
        maxTokens: 512,
        historyMode: 'long',
      })
      .expect(201)
      .expect('content-type', /text\/event-stream/);

    expect(response.text).toContain('event: thinking');
    expect(response.text).toContain('Mock thinking');
    expect(response.text).toContain('event: delta');
    expect(response.text).toContain('event: usage');
    expect(response.text).toContain('event: done');
  });

  it('returns 429 when anon daily chat limit is exceeded', async () => {
    process.env.SITE_LIMIT_ANON_CHAT_PER_DAY = '1';
    await app.close();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    app.get(ChatRateLimitService).reset();

    await request(app.getHttpServer())
      .post('/api/ai/v1/chat')
      .set('x-client-id', 'client-limit')
      .send({ prompt: 'one' })
      .expect(201);

    const limited = await request(app.getHttpServer())
      .post('/api/ai/v1/chat')
      .set('x-client-id', 'client-limit')
      .send({ prompt: 'two' })
      .expect(429);

    expect(limited.body).toMatchObject({
      code: 'CHAT_RATE_LIMIT',
      limit: 1,
      remaining: 0,
      tier: 'anon',
    });
  });

  it('supports long-conversation threads with persisted messages', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/chat/threads')
      .set('x-client-id', 'client-thread-1')
      .set('x-call-source', 'portal:chat')
      .send({
        pagePath: '/docs/react.md',
        moduleKey: 'react',
      })
      .expect(201);

    expect(created.body.id).toEqual(expect.any(String));
    expect(created.body.clientId).toBe('client-thread-1');

    const reply = await request(app.getHttpServer())
      .post(`/api/chat/threads/${created.body.id}/messages`)
      .set('x-client-id', 'client-thread-1')
      .send({
        content: '这篇在讲什么？',
        enableThinking: true,
        context: {
          scope: 'article',
          title: 'React Fiber',
          content: 'Fiber is a reconciliation engine.',
        },
      })
      .expect(201);

    expect(reply.body.message).toMatchObject({
      role: 'assistant',
      content: expect.stringContaining('Mock response'),
      thinking: expect.stringContaining('Mock thinking'),
    });

    const detail = await request(app.getHttpServer())
      .get(`/api/chat/threads/${created.body.id}`)
      .set('x-client-id', 'client-thread-1')
      .expect(200);

    expect(detail.body.messages).toHaveLength(2);
    expect(detail.body.messages[0].role).toBe('user');
    expect(detail.body.messages[1].role).toBe('assistant');
    expect(detail.body.thread.title).toContain('这篇在讲什么');

    const stream = await request(app.getHttpServer())
      .post(`/api/chat/threads/${created.body.id}/messages/stream`)
      .set('x-client-id', 'client-thread-1')
      .send({ content: '再详细一点', enableThinking: true })
      .expect(201);

    expect(stream.text).toContain('event: thinking');
    expect(stream.text).toContain('event: persisted');

    const afterStream = await request(app.getHttpServer())
      .get(`/api/chat/threads/${created.body.id}`)
      .set('x-client-id', 'client-thread-1')
      .expect(200);

    expect(afterStream.body.messages.length).toBeGreaterThanOrEqual(4);
  });
});
