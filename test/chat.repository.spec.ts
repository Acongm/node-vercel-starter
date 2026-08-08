import { NotFoundException } from '@nestjs/common';
import { ChatRepository } from '../src/modules/chat/chat.repository';

const request = { header: () => 'Bearer token' } as never;

function repositoryWith(client: { from: jest.Mock }) {
  return new ChatRepository({ create: () => client } as never);
}

describe('ChatRepository', () => {
  it('lists chats with stable updated_at + id ordering and bounded page size', async () => {
    const rows = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        updated_at: '2026-08-08T00:00:00.000Z',
      },
    ];
    const limit = jest.fn().mockResolvedValue({ data: rows, error: null });
    const orderId = jest.fn().mockReturnValue({ limit });
    const orderUpdated = jest.fn().mockReturnValue({ order: orderId });
    const select = jest.fn().mockReturnValue({ order: orderUpdated });
    const from = jest.fn().mockReturnValue({ select });

    await expect(
      repositoryWith({ from }).list(request, { limit: 100 }),
    ).resolves.toEqual({ chats: rows, nextCursor: null });
    expect(from).toHaveBeenCalledWith('chats');
    expect(orderUpdated).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(orderId).toHaveBeenCalledWith('id', { ascending: false });
    expect(limit).toHaveBeenCalledWith(101);
  });

  it('maps create input to the chats schema and applies defaults', async () => {
    const row = { id: 'chat-1', user_id: 'user-1', title: 'Title' };
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const from = jest.fn().mockReturnValue({ insert });

    const repository = repositoryWith({ from });
    await expect(
      repository.create(request, 'user-1', {
        title: ' Title ',
        pagePath: '/docs',
        moduleKey: 'docs',
        metadata: { source: 'test' },
      }),
    ).resolves.toBe(row);

    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      title: 'Title',
      page_path: '/docs',
      module_key: 'docs',
      metadata: { source: 'test' },
    });

    await repository.create(request, 'user-1', {});
    expect(insert).toHaveBeenLastCalledWith({
      user_id: 'user-1',
      title: null,
      page_path: null,
      module_key: null,
      metadata: {},
    });
  });

  it('loads a chat by id and returns 404 when no row is visible', async () => {
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: { id: 'chat-1' }, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    const repository = repositoryWith({ from });

    await expect(repository.get(request, 'chat-1')).resolves.toEqual({ id: 'chat-1' });
    await expect(repository.get(request, 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(eq).toHaveBeenCalledWith('id', 'chat-1');
    expect(eq).toHaveBeenCalledWith('id', 'missing');
  });

  it('surfaces get query errors', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'rls error' },
    });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    await expect(repositoryWith({ from }).get(request, 'chat-1')).rejects.toThrow(
      'Failed to load chat: rls error',
    );
  });

  it('updates only supplied fields and normalizes empty optional values to null', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: { id: 'chat-1' }, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ update });

    await repositoryWith({ from }).update(request, 'chat-1', {
      title: ' Updated ',
      pagePath: '   ',
      moduleKey: '  ',
      metadata: { pinned: true },
    });

    expect(update).toHaveBeenCalledWith({
      title: 'Updated',
      page_path: null,
      module_key: null,
      metadata: { pinned: true },
    });
  });

  it('falls back to get when update DTO has no fields', async () => {
    const from = jest.fn();
    const repository = repositoryWith({ from });
    const get = jest
      .spyOn(repository, 'get')
      .mockResolvedValue({ id: 'chat-1' } as never);

    await expect(repository.update(request, 'chat-1', {})).resolves.toEqual({
      id: 'chat-1',
    });
    expect(get).toHaveBeenCalledWith(request, 'chat-1');
    expect(from).not.toHaveBeenCalled();
  });

  it('returns 404 when an update affects no visible row', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const eq = jest.fn().mockReturnValue({ select });
    const update = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ update });

    await expect(
      repositoryWith({ from }).update(request, 'missing', { title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('queries paginated messages by chat id using stable created_at + id ordering', async () => {
    const rows = [
      {
        id: '22222222-2222-4222-8222-222222222222',
        chat_id: 'chat-1',
        created_at: '2026-08-08T00:00:00.000Z',
      },
    ];
    const limit = jest.fn().mockResolvedValue({ data: rows, error: null });
    const orderId = jest.fn().mockReturnValue({ limit });
    const orderCreated = jest.fn().mockReturnValue({ order: orderId });
    const eq = jest.fn().mockReturnValue({ order: orderCreated });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    await expect(
      repositoryWith({ from }).listMessages(request, 'chat-1', { limit: 50 }),
    ).resolves.toEqual({ messages: rows, nextCursor: null });
    expect(from).toHaveBeenCalledWith('messages');
    expect(eq).toHaveBeenCalledWith('chat_id', 'chat-1');
    expect(orderCreated).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(orderId).toHaveBeenCalledWith('id', { ascending: true });
    expect(limit).toHaveBeenCalledWith(51);
  });

  it('persists extensible message parts unchanged and defaults metadata', async () => {
    const row = { id: 'm1' };
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const from = jest.fn().mockReturnValue({ insert });
    const repository = repositoryWith({ from });
    const parts = [
      { type: 'reasoning', text: 'why' },
      { type: 'text', text: 'answer' },
    ];

    await repository.createMessage(request, {
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'assistant',
      parts,
      metadata: { provider: 'test' },
    });
    await repository.createMessage(request, {
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'user',
      parts: [{ type: 'text', text: 'q' }],
    });

    expect(insert).toHaveBeenNthCalledWith(1, {
      chat_id: 'chat-1',
      user_id: 'user-1',
      role: 'assistant',
      parts,
      metadata: { provider: 'test' },
    });
    expect(insert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ metadata: {} }),
    );
  });

  it('deletes the chat directly and relies on the FK cascade for messages', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const deleteQuery = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ delete: deleteQuery });

    await expect(
      repositoryWith({ from }).delete(request, 'chat-1'),
    ).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('chats');
    expect(eq).toHaveBeenCalledWith('id', 'chat-1');
  });

  it('touches updated_at and surfaces touch failures', async () => {
    const eq = jest
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'write failed' } });
    const update = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ update });
    const repository = repositoryWith({ from });

    await repository.touch(request, 'chat-1');
    expect(update).toHaveBeenCalledWith({ updated_at: expect.any(String) });
    await expect(repository.touch(request, 'chat-1')).rejects.toThrow(
      'Failed to touch chat: write failed',
    );
  });

  it('surfaces paginated list database errors instead of returning incomplete state', async () => {
    const limit = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'db down' },
    });
    const orderId = jest.fn().mockReturnValue({ limit });
    const orderUpdated = jest.fn().mockReturnValue({ order: orderId });
    const select = jest.fn().mockReturnValue({ order: orderUpdated });
    const from = jest.fn().mockReturnValue({ select });

    await expect(repositoryWith({ from }).list(request)).rejects.toThrow(
      'Failed to list chats: db down',
    );
  });
});
