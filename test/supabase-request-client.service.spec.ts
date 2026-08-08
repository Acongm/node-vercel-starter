import { UnauthorizedException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { AppConfig } from '../src/config/app-config';
import { SupabaseRequestClientService } from '../src/modules/auth/supabase-request-client.service';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

function config(overrides: Partial<AppConfig['supabase']> = {}): AppConfig {
  return {
    supabase: {
      url: 'https://example.supabase.co',
      publicKey: 'sb_publishable_test',
      apiKey: 'service-role-test',
      commentsTable: 'comments',
      chatLogsTable: 'chat_logs',
      chatClientLabelsTable: 'chat_client_labels',
      authUsersTable: 'auth_users',
      ...overrides,
    },
  } as AppConfig;
}

function request(authorization?: string) {
  return { header: (name: string) => (name === 'authorization' ? authorization : undefined) } as never;
}

describe('SupabaseRequestClientService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requires a bearer token', () => {
    const service = new SupabaseRequestClientService(config());
    expect(() => service.create(request())).toThrow(UnauthorizedException);
  });

  it('requires Supabase URL and client key', () => {
    const service = new SupabaseRequestClientService(config({ publicKey: undefined, apiKey: undefined }));
    expect(() => service.create(request('Bearer token'))).toThrow(/SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY/);
  });

  it('creates an RLS-scoped client using the user access token', () => {
    const client = { from: jest.fn() };
    createClientMock.mockReturnValue(client as never);
    const service = new SupabaseRequestClientService(config());

    expect(service.create(request('Bearer user-token'))).toBe(client);
    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'sb_publishable_test',
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: false }),
        global: { headers: { Authorization: 'Bearer user-token' } },
      }),
    );
  });
});
