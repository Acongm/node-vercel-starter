import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/runtime/configure-app';

const TEST_ENV_KEYS = [
  'APP_NAME',
  'RUNTIME_TARGET',
  'DATA_MODE',
  'AUTH_ADMIN_USERNAME',
  'AUTH_ADMIN_PASSWORD',
  'AUTH_JWT_SECRET',
  'AI_PROVIDER',
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

describe('Admin routes (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('lists registered routes for authenticated admin', async () => {
    const token = await loginAdmin(app.getHttpServer());
    const response = await request(app.getHttpServer())
      .get('/api/admin/routes')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(response.body.items)).toBe(true);

    const healthRoute = response.body.items.find(
      (entry: { method: string; path: string }) =>
        entry.method === 'GET' && entry.path === '/api/health',
    );
    expect(healthRoute).toBeDefined();

    const adminRoutesRoute = response.body.items.find(
      (entry: { method: string; path: string }) =>
        entry.method === 'GET' && entry.path === '/api/admin/routes',
    );
    expect(adminRoutesRoute).toBeDefined();
  });

  it('returns disabled platform users when service role is unavailable', async () => {
    const token = await loginAdmin(app.getHttpServer());
    const response = await request(app.getHttpServer())
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toEqual({
      enabled: false,
      reason: expect.stringContaining('SUPABASE_SERVICE_ROLE_KEY'),
    });
  });

  it('degrades admin insights when Supabase is not configured', async () => {
    const token = await loginAdmin(app.getHttpServer());
    const auth = { Authorization: `Bearer ${token}` };

    const conversations = await request(app.getHttpServer())
      .get('/api/admin/chat/conversations')
      .set(auth)
      .expect(200);
    expect(conversations.body.enabled).toBe(false);

    const chatLogs = await request(app.getHttpServer())
      .get('/api/admin/chat/logs')
      .set(auth)
      .expect(200);
    expect(chatLogs.body).toMatchObject({
      items: [],
      total: 0,
    });

    const kbJobs = await request(app.getHttpServer())
      .get('/api/admin/kb/jobs')
      .set(auth)
      .expect(200);
    expect(kbJobs.body).toMatchObject({
      source: 'portal-static',
      total: expect.any(Number),
      items: expect.any(Array),
    });
    if (kbJobs.body.items.length > 0) {
      expect(kbJobs.body.items[0]).toMatchObject({
        id: 'portal-latest',
        job_type: 'pipeline',
        source: 'portal-static',
      });
    }

    const requestLogs = await request(app.getHttpServer())
      .get('/api/admin/request-logs')
      .set(auth)
      .expect(200);
    expect(requestLogs.body).toEqual({ enabled: false });

    const requestLogStats = await request(app.getHttpServer())
      .get('/api/admin/request-logs/stats?window=24h')
      .set(auth)
      .expect(200);
    expect(requestLogStats.body).toEqual({ enabled: false });

    const overview = await request(app.getHttpServer())
      .get('/api/admin/overview')
      .set(auth)
      .expect(200);
    expect(overview.body).toEqual(
      expect.objectContaining({
        chatsCount: null,
        requestLogErrorRate24h: null,
      }),
    );
  });
});
