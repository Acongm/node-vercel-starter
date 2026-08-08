import { createClient } from '@supabase/supabase-js';
import { AppConfig } from '../src/config/app-config';
import { AuthPrincipal } from '../src/modules/auth/roles';
import { SupabaseAuthService } from '../src/modules/auth/supabase-auth.service';
import { ChatOwnershipTransferService } from '../src/modules/chat/chat-ownership-transfer.service';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));

const createClientMock = createClient as jest.MockedFunction<typeof createClient>;

function config(overrides: Partial<AppConfig['supabase']> = {}): AppConfig {
  return {
    supabase: {
      url: 'https://example.supabase.co',
      publicKey: 'sb_publishable_test',
      apiKey: 'legacy-server-key',
      serviceRoleKey: 'service-role-test',
      commentsTable: 'comments',
      chatLogsTable: 'chat_logs',
      chatClientLabelsTable: 'chat_client_labels',
      authUsersTable: 'auth_users',
      ...overrides,
    },
  } as AppConfig;
}

const destination: AuthPrincipal = {
  userId: 'permanent-user',
  role: 'viewer',
  tier: 'user',
  source: 'supabase',
};

function authVerifier(principal: AuthPrincipal | null) {
  return {
    verifyAccessToken: jest.fn().mockResolvedValue(principal),
  } as unknown as SupabaseAuthService;
}

describe('ChatOwnershipTransferService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an anonymous destination before inspecting the source token', async () => {
    const auth = authVerifier(null);
    const service = new ChatOwnershipTransferService(config(), auth);

    await expect(
      service.transfer(
        { ...destination, userId: 'anon-destination', tier: 'anon' },
        'Bearer anonymous-token',
      ),
    ).rejects.toMatchObject({ response: { code: 'DESTINATION_MUST_BE_PERMANENT' } });
    expect(auth.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('requires a separate bearer token for the anonymous source principal', async () => {
    const service = new ChatOwnershipTransferService(config(), authVerifier(null));
    await expect(service.transfer(destination, undefined)).rejects.toMatchObject({
      response: { code: 'ANONYMOUS_TOKEN_REQUIRED' },
    });
  });

  it('rejects invalid and non-anonymous source principals', async () => {
    await expect(
      new ChatOwnershipTransferService(config(), authVerifier(null)).transfer(
        destination,
        'Bearer bad-token',
      ),
    ).rejects.toMatchObject({ response: { code: 'INVALID_ANONYMOUS_TOKEN' } });

    await expect(
      new ChatOwnershipTransferService(
        config(),
        authVerifier({ ...destination, userId: 'another-permanent-user' }),
      ).transfer(destination, 'Bearer permanent-token'),
    ).rejects.toMatchObject({ response: { code: 'SOURCE_MUST_BE_ANONYMOUS' } });
  });

  it('fails closed without an explicit service-role key', async () => {
    const source: AuthPrincipal = {
      userId: 'anonymous-user',
      role: 'viewer',
      tier: 'anon',
      source: 'supabase',
    };
    const service = new ChatOwnershipTransferService(
      config({ serviceRoleKey: undefined }),
      authVerifier(source),
    );

    await expect(
      service.transfer(destination, 'Bearer anonymous-token'),
    ).rejects.toMatchObject({ response: { code: 'OWNERSHIP_TRANSFER_UNAVAILABLE' } });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('calls the service-role-only RPC with verified principal ids', async () => {
    const source: AuthPrincipal = {
      userId: 'anonymous-user',
      role: 'viewer',
      tier: 'anon',
      source: 'supabase',
    };
    const rpc = jest.fn().mockResolvedValue({
      data: [{ chats_transferred: 2, messages_transferred: '7', runs_transferred: 3 }],
      error: null,
    });
    createClientMock.mockReturnValue({ rpc } as never);

    const service = new ChatOwnershipTransferService(config(), authVerifier(source));
    await expect(
      service.transfer(destination, 'Bearer anonymous-token'),
    ).resolves.toEqual({
      chatsTransferred: 2,
      messagesTransferred: 7,
      runsTransferred: 3,
    });

    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'service-role-test',
      expect.objectContaining({ auth: expect.objectContaining({ persistSession: false }) }),
    );
    expect(rpc).toHaveBeenCalledWith('transfer_chat_ownership', {
      p_source_user_id: 'anonymous-user',
      p_destination_user_id: 'permanent-user',
    });
  });

  it('sanitizes raw Supabase RPC errors', async () => {
    const source: AuthPrincipal = {
      userId: 'anonymous-user',
      role: 'viewer',
      tier: 'anon',
      source: 'supabase',
    };
    createClientMock.mockReturnValue({
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'sensitive database detail' },
      }),
    } as never);

    await expect(
      new ChatOwnershipTransferService(config(), authVerifier(source)).transfer(
        destination,
        'Bearer anonymous-token',
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'OWNERSHIP_TRANSFER_FAILED',
        message: 'Failed to transfer anonymous chat ownership.',
      },
    });
  });
});
