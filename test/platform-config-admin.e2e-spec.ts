import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/runtime/configure-app';

const TEST_ENV_KEYS = [
  'APP_NAME',
  'RUNTIME_TARGET',
  'DATA_MODE',
  'AUTH_MODE',
  'AI_PROVIDER',
  'AUTH_ADMIN_USERNAME',
  'AUTH_ADMIN_PASSWORD',
  'AUTH_JWT_SECRET',
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

async function createTestApp(): Promise<INestApplication> {
  for (const key of TEST_ENV_KEYS) {
    delete process.env[key];
  }

  process.env.APP_NAME = 'node-vercel-starter-test';
  process.env.RUNTIME_TARGET = 'node';
  process.env.DATA_MODE = 'memory';
  process.env.AUTH_MODE = 'none';
  process.env.AI_PROVIDER = 'mock';
  process.env.AUTH_ADMIN_USERNAME = 'admin';
  process.env.AUTH_ADMIN_PASSWORD = 'admin123';
  process.env.AUTH_JWT_SECRET = 'test-admin-jwt-secret';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

describe('Platform config admin (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('does not reject a frontend-shaped PUT body as non-whitelisted properties', async () => {
    const token = await loginAdmin(app.getHttpServer());
    const response = await request(app.getHttpServer())
      .put('/api/admin/platform-config')
      .set('Authorization', `Bearer ${token}`)
      .send({
        config: {
          chat: {
            provider: 'custom',
            baseUrl: 'https://api.deepseek.com/v1',
            model: 'deepseek-v4-flash',
            maxTokensDefault: 1024,
            thinkingMaxTokens: 4096,
          },
          knowledgeBase: {
            summariesUrl: 'https://www.acongm.com/summaries-v1.json',
            portalServiceId: 'portal-ci',
          },
          openApi: {
            enabled: true,
            completionsPathEnabled: true,
          },
          webSearch: {
            enabled: false,
          },
          callers: {
            allowedCallSources: ['portal:', 'chat-site'],
            serviceCallers: [{ id: 'portal-ci' }],
          },
        },
        secrets: {},
        serviceCallerKeys: [],
      });

    expect(response.status).not.toBe(400);
    expect(JSON.stringify(response.body)).not.toMatch(/should not exist/i);
    expect(response.status).toBe(503);
    expect(response.body.message).toEqual(
      expect.stringContaining('Supabase is required'),
    );
  });

  it('lists platform-config under a readable admin group', async () => {
    const token = await loginAdmin(app.getHttpServer());
    const response = await request(app.getHttpServer())
      .get('/api/admin/routes')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const route = response.body.items.find(
      (entry: { method: string; path: string }) =>
        entry.method === 'PUT' && entry.path === '/api/admin/platform-config',
    );

    expect(route).toMatchObject({
      group: 'admin-platform',
      groupLabel: '管理 · 平台配置',
    });
  });
});
