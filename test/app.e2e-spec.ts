import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/runtime/configure-app';

const TEST_ENV_KEYS = [
  'APP_NAME',
  'RUNTIME_TARGET',
  'DATA_MODE',
  'DATA_FILE_PATH',
  'FILE_MODE',
  'AUTH_MODE',
  'AI_PROVIDER',
  'AI_BASE_URL',
  'AI_API_KEY',
  'AI_MODEL',
  'PROXY_ALLOWLIST',
  'CORS_ORIGINS',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_API_KEY',
  'SUPABASE_REQUEST_SECRET',
  'SUPABASE_COMMENTS_TABLE',
  'SUPABASE_CHAT_LOGS_TABLE',
  'CHAT_LOGS_FILE_PATH',
  'AUTH_ADMIN_USERNAME',
  'AUTH_ADMIN_PASSWORD',
  'AUTH_JWT_SECRET',
  'AUTH_SESSION_TTL',
];

async function loginAdmin(
  server: Parameters<typeof request>[0],
): Promise<string> {
  const response = await request(server)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' })
    .expect(201);

  return response.body.accessToken as string;
}

async function createTestApp(env: NodeJS.ProcessEnv = {}): Promise<INestApplication> {
  for (const key of TEST_ENV_KEYS) {
    delete process.env[key];
  }

  process.env.APP_NAME = env.APP_NAME || 'node-vercel-starter-test';
  process.env.RUNTIME_TARGET = env.RUNTIME_TARGET || 'node';
  process.env.DATA_MODE = env.DATA_MODE || 'memory';
  process.env.DATA_FILE_PATH = env.DATA_FILE_PATH || '';
  process.env.FILE_MODE = env.FILE_MODE || 'memory';
  process.env.AUTH_MODE = env.AUTH_MODE || 'none';
  process.env.AI_PROVIDER = env.AI_PROVIDER || 'mock';
  process.env.AI_BASE_URL = env.AI_BASE_URL || '';
  process.env.AI_API_KEY = env.AI_API_KEY || '';
  process.env.AI_MODEL = env.AI_MODEL || '';
  process.env.PROXY_ALLOWLIST = env.PROXY_ALLOWLIST || '';
  process.env.CORS_ORIGINS = env.CORS_ORIGINS || '';
  process.env.SUPABASE_URL = env.SUPABASE_URL || '';
  process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || '';
  process.env.SUPABASE_API_KEY = env.SUPABASE_API_KEY || '';
  process.env.SUPABASE_REQUEST_SECRET = env.SUPABASE_REQUEST_SECRET || '';
  process.env.SUPABASE_COMMENTS_TABLE = env.SUPABASE_COMMENTS_TABLE || '';
  process.env.SUPABASE_CHAT_LOGS_TABLE = env.SUPABASE_CHAT_LOGS_TABLE || '';
  process.env.CHAT_LOGS_FILE_PATH = env.CHAT_LOGS_FILE_PATH || '';
  process.env.AUTH_ADMIN_USERNAME = env.AUTH_ADMIN_USERNAME || '';
  process.env.AUTH_ADMIN_PASSWORD = env.AUTH_ADMIN_PASSWORD || '';
  process.env.AUTH_JWT_SECRET = env.AUTH_JWT_SECRET || '';
  process.env.AUTH_SESSION_TTL = env.AUTH_SESSION_TTL || '';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

describe('Node Vercel Starter', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('returns runtime configuration from health endpoint', async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      appName: 'node-vercel-starter-test',
      runtimeTarget: 'node',
      dataMode: 'memory',
      fileMode: 'memory',
      authMode: 'none',
      aiProvider: 'mock',
    });
  });

  it('reports Supabase data mode when Supabase is configured', async () => {
    app = await createTestApp({
      DATA_MODE: 'supabase',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    });

    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      dataMode: 'supabase',
    });
  });

  it('requires Supabase environment variables for Supabase data mode', async () => {
    await expect(createTestApp({ DATA_MODE: 'supabase' })).rejects.toThrow(
      /SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it('allows configured acongm.com origins through CORS', async () => {
    app = await createTestApp({
      CORS_ORIGINS: 'https://acongm.com,https://*.acongm.com',
    });

    const response = await request(app.getHttpServer())
      .options('/api/comments')
      .set('Origin', 'https://admin.acongm.com')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(
      'https://admin.acongm.com',
    );
  });

  it('creates and lists comments through the DataStore adapter', async () => {
    app = await createTestApp();

    const created = await request(app.getHttpServer())
      .post('/api/comments')
      .send({ author: 'Codex', content: 'Adapter boundaries are useful.' })
      .expect(201);

    expect(created.body).toMatchObject({
      author: 'Codex',
      content: 'Adapter boundaries are useful.',
    });
    expect(created.body.id).toEqual(expect.any(String));

    const list = await request(app.getHttpServer()).get('/api/comments').expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
  });

  it('reads, updates, and deletes comments through the DataStore adapter', async () => {
    app = await createTestApp();

    const created = await request(app.getHttpServer())
      .post('/api/comments')
      .send({ author: 'Codex', content: 'Create first, refine later.' })
      .expect(201);

    const fetched = await request(app.getHttpServer())
      .get(`/api/comments/${created.body.id}`)
      .expect(200);

    expect(fetched.body).toMatchObject({
      id: created.body.id,
      author: 'Codex',
      content: 'Create first, refine later.',
    });

    const updated = await request(app.getHttpServer())
      .patch(`/api/comments/${created.body.id}`)
      .send({ author: 'Acongm', content: 'Supabase-backed CRUD is online.' })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: created.body.id,
      author: 'Acongm',
      content: 'Supabase-backed CRUD is online.',
    });
    expect(updated.body.updatedAt).not.toBe(created.body.updatedAt);

    await request(app.getHttpServer())
      .delete(`/api/comments/${created.body.id}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/comments/${created.body.id}`)
      .expect(404);
  });

  it('uses the mock AI provider by default', async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post('/api/ai/chat')
      .send({ prompt: 'hello' })
      .expect(201);

    expect(response.body).toMatchObject({
      provider: 'mock',
      model: 'mock-local',
      message: 'Mock response: hello',
    });
  });

  it('accepts vuepress chat payload with context and enableWebSearch', async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post('/api/ai/chat')
      .send({
        messages: [
          { role: 'system', content: '你是文档助手' },
          { role: 'user', content: '这篇文章讲什么？' },
        ],
        context: {
          scope: 'article',
          pagePath: '/daily-news/2026-06-13.md',
          moduleKey: 'daily-news',
          title: '每日科技动态',
          tags: ['前端', 'AI'],
        },
        enableWebSearch: true,
      })
      .expect(201);

    expect(response.body).toMatchObject({
      provider: 'mock',
      message: expect.stringContaining('Mock response'),
      sources: [{ title: 'Mock source', url: 'https://example.com/mock' }],
    });
  });

  it('serves bounded reading-assistant chat from /api/ai/v1/chat', async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post('/api/ai/v1/chat')
      .send({
        prompt: '概括本文',
        context: {
          scope: 'article',
          title: 'React 16',
          content: 'React 16 introduced Fiber.',
        },
      })
      .expect(201);

    expect(response.body).toMatchObject({
      provider: 'mock',
      model: 'mock-local',
      message: expect.stringContaining('概括本文'),
    });
  });

  it('streams reading-assistant events from /api/ai/v1/chat/stream', async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post('/api/ai/v1/chat/stream')
      .send({ prompt: '解释 Fiber' })
      .expect(201)
      .expect('content-type', /text\/event-stream/);

    expect(response.text).toContain('event: meta');
    expect(response.text).toContain('"provider":"mock"');
    expect(response.text).toContain('event: delta');
    expect(response.text).toContain('Mock response:');
    expect(response.text).toContain('event: usage');
    expect(response.text.match(/event: done/g)).toHaveLength(1);
  });

  it('records chat logs and requires admin session to list them', async () => {
    app = await createTestApp({
      AUTH_ADMIN_USERNAME: 'admin',
      AUTH_ADMIN_PASSWORD: 'admin123',
      AUTH_JWT_SECRET: 'test-session-secret',
    });

    await request(app.getHttpServer())
      .post('/api/ai/chat')
      .set('x-client-id', 'client-e2e-1')
      .set('x-call-source', 'vuepress:article-sidebar')
      .set('x-conversation-id', 'conv-e2e-1')
      .send({
        prompt: 'hello log',
        context: {
          scope: 'article',
          pagePath: '/docs/example.md',
          title: 'Example',
        },
      })
      .expect(201);

    await new Promise((resolve) => setTimeout(resolve, 20));

    await request(app.getHttpServer()).get('/api/ai/chat/logs').expect(401);

    const token = await loginAdmin(app.getHttpServer());

    const allResponse = await request(app.getHttpServer())
      .get('/api/ai/chat/logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(allResponse.body.total).toBeGreaterThanOrEqual(1);
    expect(allResponse.body).toMatchObject({
      page: 1,
      pageSize: 50,
    });
    expect(allResponse.body.totalPages).toBeGreaterThanOrEqual(1);

    const listResponse = await request(app.getHttpServer())
      .get('/api/ai/chat/logs?clientId=client-e2e-1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listResponse.body.total).toBeGreaterThanOrEqual(1);
    expect(listResponse.body.items[0]).toMatchObject({
      clientId: 'client-e2e-1',
      conversationId: 'conv-e2e-1',
      endpoint: '/api/ai/chat',
      userMessage: 'hello log',
      assistantMessage: 'Mock response: hello log',
      context: {
        scope: 'article',
        pagePath: '/docs/example.md',
        title: 'Example',
      },
    });
  });

  it('manages client labels and enriches chat log list items', async () => {
    app = await createTestApp({
      AUTH_ADMIN_USERNAME: 'admin',
      AUTH_ADMIN_PASSWORD: 'admin123',
      AUTH_JWT_SECRET: 'test-session-secret',
    });

    await request(app.getHttpServer())
      .post('/api/ai/chat')
      .set('x-client-id', 'client-label-e2e')
      .send({ prompt: 'label test' })
      .expect(201);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const token = await loginAdmin(app.getHttpServer());

    await request(app.getHttpServer())
      .get('/api/ai/chat/client-labels')
      .expect(401);

    const createResponse = await request(app.getHttpServer())
      .post('/api/ai/chat/client-labels')
      .set('Authorization', `Bearer ${token}`)
      .send({
        clientId: 'client-label-e2e',
        label: 'E2E 测试',
        note: '自动化测试账号',
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      clientId: 'client-label-e2e',
      label: 'E2E 测试',
      note: '自动化测试账号',
    });

    const listLabelsResponse = await request(app.getHttpServer())
      .get('/api/ai/chat/client-labels')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listLabelsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clientId: 'client-label-e2e',
          label: 'E2E 测试',
        }),
      ]),
    );

    await request(app.getHttpServer())
      .patch('/api/ai/chat/client-labels/client-label-e2e')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'E2E 更新' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.label).toBe('E2E 更新');
      });

    const logsResponse = await request(app.getHttpServer())
      .get('/api/ai/chat/logs?clientId=client-label-e2e')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(logsResponse.body.items[0]).toMatchObject({
      clientId: 'client-label-e2e',
      clientLabel: {
        label: 'E2E 更新',
        note: '自动化测试账号',
      },
    });

    await request(app.getHttpServer())
      .delete('/api/ai/chat/client-labels/client-label-e2e')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
  });

  it('records stream chat logs after completion', async () => {
    app = await createTestApp({
      AUTH_ADMIN_USERNAME: 'admin',
      AUTH_ADMIN_PASSWORD: 'admin123',
      AUTH_JWT_SECRET: 'test-session-secret',
    });

    await request(app.getHttpServer())
      .post('/api/ai/v1/chat/stream')
      .set('x-client-id', 'client-stream-1')
      .set('x-call-source', 'vuepress:reading-assistant')
      .send({ prompt: 'stream log test' })
      .expect(201)
      .expect('content-type', /text\/event-stream/);

    await new Promise((resolve) => setTimeout(resolve, 20));

    const token = await loginAdmin(app.getHttpServer());

    const listResponse = await request(app.getHttpServer())
      .get('/api/ai/chat/logs?clientId=client-stream-1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(listResponse.body.items.some((item: { endpoint: string }) =>
      item.endpoint === '/api/ai/v1/chat/stream',
    )).toBe(true);
  });

  it('serves OpenAI-compatible chat completions from /v1/chat/completions', async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post('/v1/chat/completions')
      .send({
        model: 'deepseek-v4-pro',
        messages: [{ role: 'user', content: 'hello' }],
      })
      .expect(201);

    expect(response.body).toMatchObject({
      object: 'chat.completion',
      model: 'deepseek-v4-pro',
      choices: [
        {
          index: 0,
          finish_reason: 'stop',
          message: {
            role: 'assistant',
            content: 'Mock response: hello',
          },
        },
      ],
    });
    expect(response.body.id).toEqual(expect.stringMatching(/^chatcmpl-/));
  });

  it('serves OpenAI-compatible chat completions from /api/openai/v1/chat/completions', async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post('/api/openai/v1/chat/completions')
      .send({
        messages: [{ role: 'user', content: 'hello from api prefix' }],
      })
      .expect(201);

    expect(response.body).toMatchObject({
      object: 'chat.completion',
      model: 'mock-local',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Mock response: hello from api prefix',
          },
        },
      ],
    });
  });

  it('creates structured document summaries from /api/ai/summary', async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post('/api/ai/summary')
      .send({
        path: '/react/react16.md',
        title: 'React 16',
        content: 'React 16 introduced Fiber architecture and improved scheduling.',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      source: 'live',
      summary: expect.stringContaining('Mock 摘要'),
      keyPoints: expect.any(Array),
      keywords: expect.any(Array),
      techStack: expect.any(Array),
      difficulty: expect.any(String),
      contentType: expect.any(String),
      generatedAt: expect.any(String),
    });
  });

  it('requires content for /api/ai/summary', async () => {
    app = await createTestApp();

    await request(app.getHttpServer())
      .post('/api/ai/summary')
      .send({ path: '/react/react16.md' })
      .expect(400);
  });

  it('rejects proxy providers outside the allowlist', async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post('/api/proxy/not-allowed')
      .send({ path: '/v1/test' })
      .expect(403);

    expect(response.body.message).toContain('not allowed');
  });
});
