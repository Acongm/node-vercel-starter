import { BadRequestException } from '@nestjs/common';
import {
  decodeChatCursor,
  encodeChatCursor,
  normalizePageLimit,
} from '../src/modules/chat/chat-pagination';
import { ChatRepository } from '../src/modules/chat/chat.repository';

const request = { header: () => 'Bearer token' } as never;
const t0 = '2026-08-08T00:00:00.000Z';
const t1 = '2026-08-08T00:00:01.000Z';
const t2 = '2026-08-08T00:00:02.000Z';
const t3 = '2026-08-08T00:00:03.000Z';
const id1 = '11111111-1111-4111-8111-111111111111';
const id2 = '22222222-2222-4222-8222-222222222222';
const id3 = '33333333-3333-4333-8333-333333333333';
const id4 = '44444444-4444-4444-8444-444444444444';

function repositoryWith(client: { from: jest.Mock }) {
  return new ChatRepository({ create: () => client } as never);
}

describe('ChatRepository tail-first message pagination (#57)', () => {
  it('returns the latest page in chronological order with prevCursor for older pages', async () => {
    const newestFirst = [
      { id: id4, created_at: t3 },
      { id: id3, created_at: t2 },
      { id: id2, created_at: t1 },
      { id: id1, created_at: t0 },
    ];
    const limit = jest.fn().mockResolvedValue({ data: newestFirst, error: null });
    const orderId = jest.fn().mockReturnValue({ limit });
    const orderCreated = jest.fn().mockReturnValue({ order: orderId });
    const eq = jest.fn().mockReturnValue({ order: orderCreated });
    const select = jest.fn().mockReturnValue({ eq });
    const repository = repositoryWith({
      from: jest.fn().mockReturnValue({ select }),
    });

    const page = await repository.listMessages(request, 'chat-1', {
      order: 'desc',
      limit: 2,
    });

    expect(orderCreated).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(limit).toHaveBeenCalledWith(3);
    expect(page.messages).toEqual([
      { id: id3, created_at: t2 },
      { id: id4, created_at: t3 },
    ]);
    expect(page.nextCursor).toBeNull();
    expect(decodeChatCursor(page.prevCursor!)).toEqual({
      timestamp: t2,
      id: id3,
    });
  });

  it('uses before cursor to walk backward to older messages', async () => {
    const cursor = encodeChatCursor({ timestamp: t2, id: id3 });
    const or = jest.fn().mockResolvedValue({
      data: [
        { id: id2, created_at: t1 },
        { id: id1, created_at: t0 },
      ],
      error: null,
    });
    const limit = jest.fn().mockReturnValue({ or });
    const orderId = jest.fn().mockReturnValue({ limit });
    const orderCreated = jest.fn().mockReturnValue({ order: orderId });
    const eq = jest.fn().mockReturnValue({ order: orderCreated });
    const select = jest.fn().mockReturnValue({ eq });
    const repository = repositoryWith({
      from: jest.fn().mockReturnValue({ select }),
    });

    const page = await repository.listMessages(request, 'chat-1', {
      order: 'desc',
      before: cursor,
      limit: 10,
    });

    expect(or).toHaveBeenCalledWith(
      `created_at.lt.${t2},and(created_at.eq.${t2},id.lt.${id3})`,
    );
    expect(page.messages).toEqual([
      { id: id1, created_at: t0 },
      { id: id2, created_at: t1 },
    ]);
    expect(page.prevCursor).toBeNull();
  });

  it('surfaces tail-first history database failures', async () => {
    const limit = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'tail failed' },
    });
    const orderId = jest.fn().mockReturnValue({ limit });
    const orderCreated = jest.fn().mockReturnValue({ order: orderId });
    const eq = jest.fn().mockReturnValue({ order: orderCreated });
    const select = jest.fn().mockReturnValue({ eq });
    const repository = repositoryWith({
      from: jest.fn().mockReturnValue({ select }),
    });

    await expect(
      repository.listMessages(request, 'chat-1', { order: 'desc', limit: 10 }),
    ).rejects.toThrow('Failed to list tail chat messages: tail failed');
  });
});
