import { NotFoundException } from '@nestjs/common';
import { ChatRepository } from '../src/modules/chat/chat.repository';

const request = { header: () => 'Bearer token' } as never;

function repositoryWith(client: { from: jest.Mock }) {
  return new ChatRepository({ create: () => client } as never);
}

describe('ChatRepository durable messages/runs', () => {
  it('looks up a stable client message id inside one chat only', async () => {
    const row = { id: 'm1', client_message_id: 'ui-m1' };
    const maybeSingle = jest.fn().mockResolvedValue({ data: row, error: null });
    const eqClient = jest.fn().mockReturnValue({ maybeSingle });
    const eqChat = jest.fn().mockReturnValue({ eq: eqClient });
    const select = jest.fn().mockReturnValue({ eq: eqChat });
    const from = jest.fn().mockReturnValue({ select });

    await expect(
      repositoryWith({ from }).findMessageByClientId(request, 'chat-1', ' ui-m1 '),
    ).resolves.toBe(row);
    expect(from).toHaveBeenCalledWith('messages');
    expect(eqChat).toHaveBeenCalledWith('chat_id', 'chat-1');
    expect(eqClient).toHaveBeenCalledWith('client_message_id', 'ui-m1');
  });

  it('resolves parent references by client id first and only treats UUID-shaped refs as server ids', async () => {
    const repository = repositoryWith({ from: jest.fn() });
    const findByClient = jest
      .spyOn(repository, 'findMessageByClientId')
      .mockResolvedValueOnce({ id: 'client-hit' } as never)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      repository.findMessageByReference(request, 'chat-1', 'local-message-id'),
    ).resolves.toEqual({ id: 'client-hit' });
    await expect(
      repository.findMessageByReference(request, 'chat-1', 'not-a-uuid'),
    ).resolves.toBeNull();

    const serverRow = { id: '22222222-2222-4222-8222-222222222222' };
    const maybeSingle = jest.fn().mockResolvedValue({ data: serverRow, error: null });
    const eqId = jest.fn().mockReturnValue({ maybeSingle });
    const eqChat = jest.fn().mockReturnValue({ eq: eqId });
    const select = jest.fn().mockReturnValue({ eq: eqChat });
    (repository as any).supabaseClients = {
      create: () => ({ from: jest.fn().mockReturnValue({ select }) }),
    };

    await expect(
      repository.findMessageByReference(
        request,
        'chat-1',
        '22222222-2222-4222-8222-222222222222',
      ),
    ).resolves.toBe(serverRow);
    expect(findByClient).toHaveBeenCalledTimes(3);
    expect(eqId).toHaveBeenCalledWith(
      'id',
      '22222222-2222-4222-8222-222222222222',
    );
  });

  it('uses chat_id + client_message_id as the message upsert conflict key and persists the parent FK', async () => {
    const row = { id: 'm1', client_message_id: 'ui-user-1' };
    const maybeSingle = jest.fn().mockResolvedValue({ data: row, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const upsert = jest.fn().mockReturnValue({ select });
    const from = jest.fn().mockReturnValue({ upsert });
    const repository = repositoryWith({ from });

    await expect(
      repository.createMessage(request, {
        chatId: 'chat-1',
        userId: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'hello' }],
        clientMessageId: ' ui-user-1 ',
        parentMessageId: 'parent-server-id',
      }),
    ).resolves.toBe(row);

    expect(upsert).toHaveBeenCalledWith(
      {
        chat_id: 'chat-1',
        user_id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'hello' }],
        metadata: {},
        client_message_id: 'ui-user-1',
        parent_message_id: 'parent-server-id',
      },
      {
        onConflict: 'chat_id,client_message_id',
        ignoreDuplicates: true,
      },
    );
  });

  it('returns the existing message when an idempotent insert loses a duplicate race', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const upsert = jest.fn().mockReturnValue({ select });
    const repository = repositoryWith({
      from: jest.fn().mockReturnValue({ upsert }),
    });
    const existing = { id: 'existing' } as never;
    jest.spyOn(repository, 'findMessageByClientId').mockResolvedValue(existing);

    await expect(
      repository.createMessage(request, {
        chatId: 'chat-1',
        userId: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'hello' }],
        clientMessageId: 'ui-user-1',
      }),
    ).resolves.toBe(existing);
  });

  it('creates a stable run id once and reports later duplicate delivery as reused', async () => {
    const runRow = {
      id: '11111111-1111-4111-8111-111111111111',
      chat_id: 'chat-1',
      user_id: 'user-1',
      user_message_id: 'm1',
      status: 'running',
    };
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: runRow, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const upsert = jest.fn().mockReturnValue({ select });
    const repository = repositoryWith({
      from: jest.fn().mockReturnValue({ upsert }),
    });

    await expect(
      repository.createRun(request, {
        id: runRow.id,
        chatId: 'chat-1',
        userId: 'user-1',
        userMessageId: 'm1',
      }),
    ).resolves.toEqual({ run: runRow, created: true });

    jest.spyOn(repository, 'getRun').mockResolvedValue(runRow as never);
    await expect(
      repository.createRun(request, {
        id: runRow.id,
        chatId: 'chat-1',
        userId: 'user-1',
        userMessageId: 'm1',
      }),
    ).resolves.toEqual({ run: runRow, created: false });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: runRow.id,
        chat_id: 'chat-1',
        user_id: 'user-1',
        user_message_id: 'm1',
        status: 'running',
      }),
      { onConflict: 'id', ignoreDuplicates: true },
    );
  });

  it('maps terminal run updates and returns 404 if RLS exposes no matching run', async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: 'run-1', status: 'complete' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ update });
    const repository = repositoryWith({ from });

    await repository.updateRun(request, 'run-1', {
      status: 'complete',
      assistantMessageId: 'assistant-1',
      errorMessage: null,
      completedAt: '2026-08-08T00:01:00.000Z',
    });

    expect(update).toHaveBeenCalledWith({
      status: 'complete',
      assistant_message_id: 'assistant-1',
      error_message: null,
      completed_at: '2026-08-08T00:01:00.000Z',
    });

    await expect(
      repository.updateRun(request, 'missing', { status: 'error' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
