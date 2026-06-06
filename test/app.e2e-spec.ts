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
];

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

  it('rejects proxy providers outside the allowlist', async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post('/api/proxy/not-allowed')
      .send({ path: '/v1/test' })
      .expect(403);

    expect(response.body.message).toContain('not allowed');
  });
});
