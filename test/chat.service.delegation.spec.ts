import { ChatService } from '../src/modules/chat/chat.service';
import { AuthPrincipal } from '../src/modules/auth/roles';

const request = { header: () => 'Bearer token' } as never;
const principal: AuthPrincipal = {
  userId: 'user-1',
  role: 'viewer',
  tier: 'user',
  source: 'supabase',
};

describe('ChatService CRUD', () => {
  it('delegates paginated chat/history operations to the dedicated repository', async () => {
    const chatPage = { chats: [{ id: 'chat-1' }], nextCursor: 'chat-next' };
    const firstMessagePage = {
      messages: [{ id: 'm1' }],
      nextCursor: 'message-next',
    };
    const requestedMessagePage = {
      messages: [{ id: 'm2' }],
      nextCursor: null,
    };
    const repository = {
      list: jest.fn().mockResolvedValue(chatPage),
      create: jest.fn().mockResolvedValue({ id: 'chat-2' }),
      get: jest.fn().mockResolvedValue({ id: 'chat-1' }),
      listMessages: jest
        .fn()
        .mockResolvedValueOnce(firstMessagePage)
        .mockResolvedValueOnce(requestedMessagePage),
      update: jest.fn().mockResolvedValue({ id: 'chat-1', title: 'New' }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ChatService(repository as never, {} as never, {} as never);
    const chatQuery = { limit: 20, after: 'chat-cursor' };
    const messageQuery = { limit: 40, after: 'message-cursor' };

    await expect(service.list(request, chatQuery)).resolves.toBe(chatPage);
    await expect(
      service.create(request, principal, { title: 'New chat' }),
    ).resolves.toEqual({ id: 'chat-2' });
    await expect(service.get(request, 'chat-1')).resolves.toEqual({
      chat: { id: 'chat-1' },
      ...firstMessagePage,
    });
    await expect(
      service.update(request, 'chat-1', { title: 'New' }),
    ).resolves.toEqual({ id: 'chat-1', title: 'New' });
    await expect(
      service.listMessages(request, 'chat-1', messageQuery),
    ).resolves.toBe(requestedMessagePage);
    await expect(service.delete(request, 'chat-1')).resolves.toBeUndefined();

    expect(repository.list).toHaveBeenCalledWith(request, chatQuery);
    expect(repository.create).toHaveBeenCalledWith(request, 'user-1', {
      title: 'New chat',
    });
    expect(repository.get).toHaveBeenCalledTimes(2);
    expect(repository.get).toHaveBeenNthCalledWith(1, request, 'chat-1');
    expect(repository.get).toHaveBeenNthCalledWith(2, request, 'chat-1');
    expect(repository.listMessages).toHaveBeenNthCalledWith(1, request, 'chat-1', {
      limit: 100,
    });
    expect(repository.listMessages).toHaveBeenNthCalledWith(
      2,
      request,
      'chat-1',
      messageQuery,
    );
    expect(repository.update).toHaveBeenCalledWith(request, 'chat-1', {
      title: 'New',
    });
    expect(repository.delete).toHaveBeenCalledWith(request, 'chat-1');
  });
});
