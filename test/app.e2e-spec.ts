import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/runtime/configure-app';

async function createTestApp(env: NodeJS.ProcessEnv = {}): Promise<INestApplication> {
  process.env.APP_NAME = env.APP_NAME || 'node-vercel-starter-test';
  process.env.RUNTIME_TARGET = env.RUNTIME_TARGET || 'node';
  process.env.DATA_MODE = env.DATA_MODE || 'memory';
  process.env.FILE_MODE = env.FILE_MODE || 'memory';
  process.env.AUTH_MODE = env.AUTH_MODE || 'none';
  process.env.AI_PROVIDER = env.AI_PROVIDER || 'mock';
  process.env.PROXY_ALLOWLIST = env.PROXY_ALLOWLIST || '';

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

  it('rejects proxy providers outside the allowlist', async () => {
    app = await createTestApp();

    const response = await request(app.getHttpServer())
      .post('/api/proxy/not-allowed')
      .send({ path: '/v1/test' })
      .expect(403);

    expect(response.body.message).toContain('not allowed');
  });
});
