import { ChatRepository } from '../src/modules/chat/chat.repository';

const request = { header: () => 'Bearer token' } as never;

describe('ChatRepository recent model history', () => {
  it('surfaces database failures instead of silently generating with partial history', async () => {
    const limit = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'history failed' },
    });
    const orderId = jest.fn().mockReturnValue({ limit });
    const orderCreated = jest.fn().mockReturnValue({ order: orderId });
    const eq = jest.fn().mockReturnValue({ order: orderCreated });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });
    const repository = new ChatRepository({
      create: () => ({ from }),
    } as never);

    await expect(
      repository.listRecentMessages(request, 'chat-1', 500),
    ).rejects.toThrow('Failed to list recent chat messages: history failed');
  });
});
