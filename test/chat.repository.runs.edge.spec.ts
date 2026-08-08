import { ChatRepository } from '../src/modules/chat/chat.repository';

const request = { header: () => 'Bearer token' } as never;

function repositoryWith(client: { from: jest.Mock }) {
  return new ChatRepository({ create: () => client } as never);
}

describe('ChatRepository durable idempotency edge paths', () => {
  it('surfaces client-message lookup database errors', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'lookup failed' },
    });
    const eqClient = jest.fn().mockReturnValue({ maybeSingle });
    const eqChat = jest.fn().mockReturnValue({ eq: eqClient });
    const select = jest.fn().mockReturnValue({ eq: eqChat });
    const from = jest.fn().mockReturnValue({ select });

    await expect(
      repositoryWith({ from }).findMessageByClientId(
        request,
        'chat-1',
        'ui-message-1',
      ),
    ).rejects.toThrow('Failed to load chat message by client id: lookup failed');
  });

  it('surfaces server-id parent lookup database errors after client-id lookup misses', async () => {
    const repository = repositoryWith({ from: jest.fn() });
    jest.spyOn(repository, 'findMessageByClientId').mockResolvedValue(null);

    const maybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'parent lookup failed' },
    });
    const eqId = jest.fn().mockReturnValue({ maybeSingle });
    const eqChat = jest.fn().mockReturnValue({ eq: eqId });
    const select = jest.fn().mockReturnValue({ eq: eqChat });
    (repository as unknown as { supabaseClients: unknown }).supabaseClients = {
      create: () => ({ from: jest.fn().mockReturnValue({ select }) }),
    };

    await expect(
      repository.findMessageByReference(
        request,
        'chat-1',
        '22222222-2222-4222-8222-222222222222',
      ),
    ).rejects.toThrow('Failed to load chat message: parent lookup failed');
  });

  it('fails loudly if an idempotent message insert returns neither the inserted nor existing row', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const upsert = jest.fn().mockReturnValue({ select });
    const repository = repositoryWith({
      from: jest.fn().mockReturnValue({ upsert }),
    });
    jest.spyOn(repository, 'findMessageByClientId').mockResolvedValue(null);

    await expect(
      repository.createMessage(request, {
        chatId: 'chat-1',
        userId: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'hello' }],
        clientMessageId: 'ui-message-1',
      }),
    ).rejects.toThrow(
      'Failed to create chat message: idempotent row was not visible.',
    );
  });

  it('surfaces idempotent message upsert errors without a fallback lookup', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'upsert failed' },
    });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const upsert = jest.fn().mockReturnValue({ select });
    const repository = repositoryWith({
      from: jest.fn().mockReturnValue({ upsert }),
    });
    const lookup = jest.spyOn(repository, 'findMessageByClientId');

    await expect(
      repository.createMessage(request, {
        chatId: 'chat-1',
        userId: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'hello' }],
        clientMessageId: 'ui-message-1',
      }),
    ).rejects.toThrow('Failed to create chat message: upsert failed');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('executes getRun for visible, missing, and database-error states', async () => {
    const runRow = { id: 'run-1', status: 'complete' };
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: runRow, error: null })
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'run lookup failed' } });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    const repository = repositoryWith({ from });

    await expect(repository.getRun(request, 'run-1')).resolves.toBe(runRow);
    await expect(repository.getRun(request, 'missing')).resolves.toBeNull();
    await expect(repository.getRun(request, 'broken')).rejects.toThrow(
      'Failed to load chat run: run lookup failed',
    );
  });

  it('creates a server-generated run when the client omits runId', async () => {
    const runRow = { id: 'generated-run', status: 'running' };
    const single = jest.fn().mockResolvedValue({ data: runRow, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const from = jest.fn().mockReturnValue({ insert });
    const repository = repositoryWith({ from });

    await expect(
      repository.createRun(request, {
        chatId: 'chat-1',
        userId: 'user-1',
        userMessageId: 'message-1',
      }),
    ).resolves.toEqual({ run: runRow, created: true });

    expect(insert).toHaveBeenCalledWith({
      chat_id: 'chat-1',
      user_id: 'user-1',
      user_message_id: 'message-1',
      status: 'running',
      metadata: {},
    });
  });

  it('surfaces server-generated run insert errors', async () => {
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'run insert failed' },
    });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });

    await expect(
      repositoryWith({ from: jest.fn().mockReturnValue({ insert }) }).createRun(
        request,
        {
          chatId: 'chat-1',
          userId: 'user-1',
          userMessageId: 'message-1',
        },
      ),
    ).rejects.toThrow('Failed to create chat run: run insert failed');
  });

  it('fails loudly if a duplicate run upsert cannot see the existing row', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const upsert = jest.fn().mockReturnValue({ select });
    const repository = repositoryWith({
      from: jest.fn().mockReturnValue({ upsert }),
    });
    jest.spyOn(repository, 'getRun').mockResolvedValue(null);

    await expect(
      repository.createRun(request, {
        id: '11111111-1111-4111-8111-111111111111',
        chatId: 'chat-1',
        userId: 'user-1',
        userMessageId: 'message-1',
      }),
    ).rejects.toThrow(
      'Failed to create chat run: idempotent row was not visible.',
    );
  });

  it('surfaces stable run upsert errors', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'run upsert failed' },
    });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const upsert = jest.fn().mockReturnValue({ select });

    await expect(
      repositoryWith({ from: jest.fn().mockReturnValue({ upsert }) }).createRun(
        request,
        {
          id: '11111111-1111-4111-8111-111111111111',
          chatId: 'chat-1',
          userId: 'user-1',
          userMessageId: 'message-1',
        },
      ),
    ).rejects.toThrow('Failed to create chat run: run upsert failed');
  });
});
