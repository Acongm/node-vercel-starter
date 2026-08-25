import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/runtime/configure-app';

async function createApp(): Promise<INestApplication> {
  process.env.DATA_MODE = 'memory';
  process.env.AUTH_MODE = 'jwt';
  process.env.AUTH_ADMIN_USERNAME = 'admin';
  process.env.AUTH_ADMIN_PASSWORD = 'admin123';
  process.env.AUTH_JWT_SECRET = 'admin-catalog-secret';
  process.env.SUPABASE_JWT_SECRET = 'supabase-catalog-secret';
  process.env.AI_PROVIDER = 'mock';

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

async function loginAdmin(server: Parameters<typeof request>[0]) {
  const response = await request(server)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' })
    .expect(201);
  return response.body.accessToken as string;
}

describe('Admin catalog (#api-admin)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createApp();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('requires an admin principal for catalog routes', async () => {
    await request(app.getHttpServer()).get('/api/admin/me').expect(401);
    await request(app.getHttpServer()).get('/api/admin/tables').expect(401);

    const viewerToken = await new JwtService().signAsync(
      {
        sub: 'user-viewer',
        email: 'viewer@example.com',
        app_metadata: { role: 'viewer' },
      },
      { secret: 'supabase-catalog-secret', expiresIn: '1h' },
    );

    await request(app.getHttpServer())
      .get('/api/admin/tables')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
  });

  it('lets a whitelist email read store tables after creating a comment', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/comments')
      .send({ author: 'Admin UI', content: 'catalog visible' })
      .expect(201);

    const token = await new JwtService().signAsync(
      {
        sub: 'user-whitelist',
        email: 'o.arvin.peng@gmail.com',
        app_metadata: {},
      },
      { secret: 'supabase-catalog-secret', expiresIn: '1h' },
    );

    const me = await request(app.getHttpServer())
      .get('/api/admin/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(me.body).toMatchObject({
      authenticated: true,
      isAdmin: true,
      role: 'admin',
    });
    expect(me.body.tables.map((table: { key: string }) => table.key)).toEqual(
      expect.arrayContaining(['comments', 'chats', 'user_settings']),
    );

    const page = await request(app.getHttpServer())
      .get('/api/admin/tables/comments?keyword=catalog')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(page.body.available).toBe(true);
    expect(page.body.total).toBeGreaterThanOrEqual(1);
    expect(page.body.list.some((row: { id: string }) => row.id === created.body.id)).toBe(
      true,
    );

    const row = await request(app.getHttpServer())
      .get(`/api/admin/tables/comments/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(row.body.content).toBe('catalog visible');
  });

  it('lists auth users without password hashes for an admin session', async () => {
    const token = await loginAdmin(app.getHttpServer());
    const page = await request(app.getHttpServer())
      .get('/api/admin/tables/auth_users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(page.body.table).toBe('auth_users');
    for (const row of page.body.list as Array<Record<string, unknown>>) {
      expect(row).not.toHaveProperty('passwordHash');
    }
  });

  it('marks supabase-only tables unavailable in memory mode', async () => {
    const token = await loginAdmin(app.getHttpServer());
    const page = await request(app.getHttpServer())
      .get('/api/admin/tables/chats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(page.body).toMatchObject({
      table: 'chats',
      source: 'supabase',
      available: false,
      list: [],
      total: 0,
    });
  });
});
