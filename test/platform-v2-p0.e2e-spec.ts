import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/runtime/configure-app';

describe('Platform v2 P0 auth + site.config', () => {
  let app: INestApplication;
  const jwtService = new JwtService();

  beforeEach(async () => {
    process.env.AUTH_ADMIN_USERNAME = 'admin';
    process.env.AUTH_ADMIN_PASSWORD = 'admin123';
    process.env.AUTH_JWT_SECRET = 'test-session-secret';
    process.env.SUPABASE_JWT_SECRET = 'supabase-test-secret';
    process.env.SITE_GIT_PUBLISH_BRANCH = 'dev';
    process.env.DATA_MODE = 'memory';
    process.env.AI_PROVIDER = 'mock';
    process.env.AUTH_MODE = 'jwt';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    delete process.env.AUTH_ADMIN_USERNAME;
    delete process.env.AUTH_ADMIN_PASSWORD;
    delete process.env.AUTH_JWT_SECRET;
    delete process.env.SUPABASE_JWT_SECRET;
    delete process.env.SITE_GIT_PUBLISH_BRANCH;
  });

  it('returns anonymous principal on /api/auth/me without token', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .expect(200);

    expect(response.body).toMatchObject({
      authenticated: false,
      role: 'anonymous',
      tier: 'anon',
    });
  });

  it('returns admin principal from admin session login', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(201);

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(me.body).toMatchObject({
      authenticated: true,
      role: 'admin',
      tier: 'user',
      user: { role: 'admin' },
    });
  });

  it('allows chat anonymously but blocks editor-check for anon', async () => {
    await request(app.getHttpServer())
      .post('/api/ai/v1/chat')
      .send({ prompt: 'anon chat ok' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/auth/roles/editor-check')
      .expect(401);
  });

  it('allows editor JWT through editor-check and rejects viewer', async () => {
    const editorToken = await jwtService.signAsync(
      {
        sub: 'editor-1',
        app_metadata: { role: 'editor' },
      },
      { secret: 'supabase-test-secret', expiresIn: '1h' },
    );
    const viewerToken = await jwtService.signAsync(
      {
        sub: 'viewer-1',
        app_metadata: { role: 'viewer' },
      },
      { secret: 'supabase-test-secret', expiresIn: '1h' },
    );

    await request(app.getHttpServer())
      .get('/api/auth/roles/editor-check')
      .set('Authorization', `Bearer ${editorToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({ ok: true, role: 'editor', tier: 'user' });
      });

    await request(app.getHttpServer())
      .get('/api/auth/roles/editor-check')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);
  });

  it('exposes site.config publishBranch and limits', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/config/site')
      .expect(200);

    expect(response.body.git.publishBranch).toBe('dev');
    expect(response.body.limits.anon.chatPerDay).toBeGreaterThan(0);
    expect(response.body.domains.api).toContain('acongm.com');
  });
});
