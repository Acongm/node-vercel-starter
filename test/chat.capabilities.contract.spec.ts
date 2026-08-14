import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CHAT_V2_CAPABILITIES } from '../src/modules/chat/chat.capabilities';
import { configureApp } from '../src/runtime/configure-app';

/**
 * #37 capability consistency: production-visible Chat capabilities must
 * match the durable backend matrix. Unsupported Stage 6 adapters stay
 * explicitly false instead of lingering as it.todo happy paths.
 */
export const EXPECTED_CHAT_V2_CAPABILITIES = {
  durableSend: true,
  durableRetry: true,
  durableReload: true,
  durableEditBranch: true,
  durableCancel: true,
  cursorPagination: true,
  historyUpdate: false,
  historyDelete: false,
  resume: false,
} as const;

describe('Chat v2 capability contract (#37)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.DATA_MODE = 'memory';
    process.env.AI_PROVIDER = 'mock';
    process.env.AUTH_MODE = 'none';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('publishes the durable capability matrix without authentication', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/chat/capabilities')
      .expect(200);

    expect(response.body.capabilities).toEqual(EXPECTED_CHAT_V2_CAPABILITIES);
    expect(CHAT_V2_CAPABILITIES).toEqual(EXPECTED_CHAT_V2_CAPABILITIES);
  });

  it('disables history update/delete and resume so UI cannot claim local-only adapters', () => {
    expect(EXPECTED_CHAT_V2_CAPABILITIES.historyUpdate).toBe(false);
    expect(EXPECTED_CHAT_V2_CAPABILITIES.historyDelete).toBe(false);
    expect(EXPECTED_CHAT_V2_CAPABILITIES.resume).toBe(false);
  });
});

