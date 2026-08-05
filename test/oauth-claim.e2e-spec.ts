import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/runtime/configure-app';

describe('OAuth providers + anonymous thread claim', () => {
  let app: INestApplication;
  const jwtService = new JwtService();

  beforeEach(async () => {
    process.env.DATA_MODE = 'memory';
    process.env.AI_PROVIDER = 'mock';
    process.env.AUTH_MODE = 'jwt';
    process.env.SUPABASE_JWT_SECRET = 'supabase-oauth-secret';
    process.env.SITE_LIMIT_ANON_CHAT_PER_DAY = '100';
    delete process.env.AUTH_ADMIN_USERNAME;
    delete process.env.AUTH_ADMIN_PASSWORD;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    delete process.env.SUPABASE_JWT_SECRET;
  });

  it('lists GitHub and Google login URLs from auth.acongm.com when OAuth secrets are unset', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/oauth/providers')
      .expect(200);

    expect(response.body).toMatchObject({
      authBase: 'https://auth.acongm.com',
      claimThreads: true,
    });
    expect(response.body.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'github',
          loginUrl: 'https://auth.acongm.com/login?provider=github',
        }),
        expect.objectContaining({
          id: 'google',
          loginUrl: 'https://auth.acongm.com/login?provider=google',
        }),
      ]),
    );
  });

  it('claims anonymous threads after OAuth login', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/chat/threads')
      .set('x-client-id', 'anon-device-1')
      .send({ pagePath: '/docs/a.md' })
      .expect(201);

    const token = await jwtService.signAsync(
      {
        sub: 'user-oauth-1',
        email: 'dev@acongm.com',
        app_metadata: { role: 'viewer' },
      },
      { secret: 'supabase-oauth-secret', expiresIn: '1h' },
    );

    const claim = await request(app.getHttpServer())
      .post('/api/auth/oauth/claim')
      .set('Authorization', `Bearer ${token}`)
      .set('x-client-id', 'anon-device-1')
      .send({ clientId: 'anon-device-1' })
      .expect(201);

    expect(claim.body).toMatchObject({
      claimedThreads: 1,
      threadIds: [created.body.id],
    });

    const list = await request(app.getHttpServer())
      .get('/api/chat/threads')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.body.id,
          userId: 'user-oauth-1',
        }),
      ]),
    );
  });
});
