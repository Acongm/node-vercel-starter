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
  it('delegates CRUD/history operations to the dedicated repository', async () => {
    const repository = {
      list: jest.fn().mockResolvedValue([{ id: 'chat-1' }]),
      create: jest.fn().mockResolvedValue({ id: 'chat-2' }),
      get: jest.fn().mockResolvedValue({ id: 'chat-1' }),
      listMessages: jest.fn().mockResolvedValue([{ id: 'm1' }]),
      update: jest.fn().mockResolvedValue({ id: 'chat-1', title: 'New' }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ChatService(repository as never, {} as never, {} as never);

    await expect(service.list(request)).resolves.toEqual([{ id: 'chat-1' }]);
    await expect(service.create(request, principal, { title: 'New chat' })).resolves.toEqual({ id: 'chat-2' });
    await expect(service.get(request, 'chat-1')).resolves.toEqual({
      chat: { id: 'chat-1' },
      messages: [{ id: 'm1' }],
    });
    await expect(service.update(request, 'chat-1', { title: 'New' })).resolves.toEqual({ id: 'chat-1', title: 'New' });
    await expect(service.listMessages(request, 'chat-1')).resolves.toEqual([{ id: 'm1' }]);
    await expect(service.delete(request, 'chat-1')).resolves.toBeUndefined();

    expect(repository.create).toHaveBeenCalledWith(request, 'user-1', { title: 'New chat' });
    expect(repository.get).toHaveBeenCalledWith(request, 'chat-1');
    expect(repository.listMessages).toHaveBeenCalledWith(request, 'chat-1');
    expect(repository.update).toHaveBeenCalledWith(request, 'chat-1', { title: 'New' });
    expect(repository.delete).toHaveBeenCalledWith(request, 'chat-1');
  });
});
