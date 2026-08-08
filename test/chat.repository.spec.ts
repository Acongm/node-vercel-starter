import { NotFoundException } from '@nestjs/common';
import { ChatRepository } from '../src/modules/chat/chat.repository';

const request = { header: () => 'Bearer token' } as never;

function repositoryWith(client: { from: jest.Mock }) {
  return new ChatRepository({ create: () => client } as never);
}

describe('ChatRepository', () => {
  it('lists chats in updated order and clamps the requested limit', async () => {
    const rows = [{ id: 'chat-1' }];
    const limit = jest.fn().mockResolvedValue({ data: rows, error: null });
    const order = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ order });
    const from = jest.fn().mockReturnValue({ select });

    await expect(repositoryWith({ from }).list(request, 500)).resolves.toBe(rows);
    expect(from).toHaveBeenCalledWith('chats');
    expect(order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(100);
  });

  it('maps create input to the chats schema', async () => {
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
  });

  it('returns 404 when RLS/query exposes no matching chat', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const eq = jest.fn().mockReturnValue({ maybeSingle });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    await expect(repositoryWith({ from }).get(request, 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(eq).toHaveBeenCalledWith('id', 'missing');
  });

  it('queries messages by chat id instead of loading all messages', async () => {
    const rows = [{ id: 'm1', chat_id: 'chat-1' }];
    const order = jest.fn().mockResolvedValue({ data: rows, error: null });
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    await expect(repositoryWith({ from }).listMessages(request, 'chat-1')).resolves.toBe(rows);
    expect(from).toHaveBeenCalledWith('messages');
    expect(eq).toHaveBeenCalledWith('chat_id', 'chat-1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('persists extensible message parts unchanged', async () => {
    const row = { id: 'm1' };
    const single = jest.fn().mockResolvedValue({ data: row, error: null });
    const select = jest.fn().mockReturnValue({ single });
    const insert = jest.fn().mockReturnValue({ select });
    const from = jest.fn().mockReturnValue({ insert });
    const parts = [
      { type: 'reasoning', text: 'why' },
      { type: 'text', text: 'answer' },
    ];

    await repositoryWith({ from }).createMessage(request, {
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'assistant',
      parts,
      metadata: { provider: 'test' },
    });

    expect(insert).toHaveBeenCalledWith({
      chat_id: 'chat-1',
      user_id: 'user-1',
      role: 'assistant',
      parts,
      metadata: { provider: 'test' },
    });
  });

  it('deletes the chat directly and relies on the FK cascade for messages', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const deleteQuery = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ delete: deleteQuery });

    await expect(repositoryWith({ from }).delete(request, 'chat-1')).resolves.toBeUndefined();
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('chats');
    expect(eq).toHaveBeenCalledWith('id', 'chat-1');
  });

  it('surfaces database errors instead of silently returning incomplete state', async () => {
    const limit = jest.fn().mockResolvedValue({ data: null, error: { message: 'db down' } });
    const order = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ order });
    const from = jest.fn().mockReturnValue({ select });

    await expect(repositoryWith({ from }).list(request)).rejects.toThrow('Failed to list chats: db down');
  });
});
