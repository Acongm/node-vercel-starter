import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AUTH_USER_STORE } from '../src/common/tokens';
import { DataStore } from '../src/adapters/data-store/data-store.interface';
import { AuthUserRecord, hashPassword } from '../src/modules/auth/auth-user-record';
import { configureApp } from '../src/runtime/configure-app';
import { JwtAuthService } from '../src/modules/auth/jwt-auth.service';

describe('Local account login + OAuth providers', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.DATA_MODE = 'memory';
    process.env.AI_PROVIDER = 'mock';
    process.env.AUTH_MODE = 'jwt';
    process.env.AUTH_JWT_SECRET = 'local-auth-secret';
    process.env.SITE_LIMIT_ANON_CHAT_PER_DAY = '100';
    delete process.env.AUTH_ADMIN_USERNAME;
    delete process.env.AUTH_ADMIN_PASSWORD;
    delete process.env.SUPABASE_JWT_SECRET;
    delete process.env.AUTH_GITHUB_CLIENT_ID;
    delete process.env.AUTH_GITHUB_CLIENT_SECRET;
    delete process.env.AUTH_GOOGLE_CLIENT_ID;
    delete process.env.AUTH_GOOGLE_CLIENT_SECRET;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const store = app.get<DataStore<AuthUserRecord>>(AUTH_USER_STORE);
    await store.create({
      email: 'dev@acongm.com',
      username: 'dev',
      passwordHash: await hashPassword('pass-123'),
      provider: 'local',
      role: 'editor',
      name: 'Dev User',
      disabled: false,
    });
  });

  afterEach(async () => {
    await app?.close();
  });

  it('exposes auth mode flags for local + oauth', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/mode')
      .expect(200);

    expect(response.body).toMatchObject({
      localLoginEnabled: true,
      registrationOpen: false,
      oauthConfigured: { github: false, google: false },
    });
  });

  it('logs in with seeded local email/password and issues access token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'dev@acongm.com', password: 'pass-123' })
      .expect(201);

    expect(login.body).toMatchObject({
      authMode: 'jwt',
      tokenType: 'Bearer',
      user: {
        email: 'dev@acongm.com',
        role: 'editor',
        provider: 'local',
        tier: 'user',
      },
    });
    expect(login.body.accessToken).toEqual(expect.any(String));

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(me.body).toMatchObject({
      authenticated: true,
      role: 'editor',
      tier: 'user',
      source: 'local',
      user: { email: 'dev@acongm.com' },
    });

    const jwtAuth = app.get(JwtAuthService);
    const principal = await jwtAuth.verifyAccessToken(login.body.accessToken);
    expect(principal).toMatchObject({
      role: 'editor',
      source: 'local',
      email: 'dev@acongm.com',
    });
  });

  it('rejects unknown local credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'missing', password: 'nope' })
      .expect(401);
  });

  it('lists github + google providers with auth portal fallback URLs', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/oauth/providers')
      .expect(200);

    expect(response.body.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'github',
          enabled: false,
          loginUrl: 'https://auth.acongm.com/login?provider=github',
        }),
        expect.objectContaining({
          id: 'google',
          enabled: false,
          loginUrl: 'https://auth.acongm.com/login?provider=google',
        }),
      ]),
    );
  });

  it('returns API start URL when GitHub OAuth is configured', async () => {
    process.env.AUTH_GITHUB_CLIENT_ID = 'gh-client';
    process.env.AUTH_GITHUB_CLIENT_SECRET = 'gh-secret';
    await app.close();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const response = await request(app.getHttpServer())
      .get('/api/auth/oauth/providers')
      .expect(200);

    const github = response.body.providers.find(
      (item: { id: string }) => item.id === 'github',
    );
    expect(github).toMatchObject({
      enabled: true,
      authorizePath: '/api/auth/oauth/github/start',
    });
    expect(github.loginUrl).toContain('/api/auth/oauth/github/start');
  });
});
