import { BadRequestException } from '@nestjs/common';
import {
  decodeChatCursor,
  encodeChatCursor,
  normalizePageLimit,
} from '../src/modules/chat/chat-pagination';
import { ChatRepository } from '../src/modules/chat/chat.repository';

const request = { header: () => 'Bearer token' } as never;
const t0 = '2026-08-08T00:00:00.000Z';
const id1 = '11111111-1111-4111-8111-111111111111';
const id2 = '22222222-2222-4222-8222-222222222222';
const id3 = '33333333-3333-4333-8333-333333333333';

function repositoryWith(client: { from: jest.Mock }) {
  return new ChatRepository({ create: () => client } as never);
}

describe('chat cursor helpers', () => {
  it('round-trips an opaque stable timestamp + id cursor', () => {
    const encoded = encodeChatCursor({ timestamp: t0, id: id2 });
    expect(encoded).not.toContain(t0);
    expect(decodeChatCursor(encoded)).toEqual({ timestamp: t0, id: id2 });
  });

  it.each(['not-base64-json', Buffer.from('{}').toString('base64url')])(
    'rejects malformed cursor %s with a stable contract code',
    (cursor) => {
      try {
        decodeChatCursor(cursor);
        throw new Error('expected cursor rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          code: 'CHAT_INVALID_CURSOR',
          message: 'Pagination cursor is invalid.',
        });
      }
    },
  );

  it('normalizes defaults and clamps internal page sizes', () => {
    expect(normalizePageLimit(undefined)).toBe(50);
    expect(normalizePageLimit(0)).toBe(1);
    expect(normalizePageLimit(999)).toBe(100);
    expect(normalizePageLimit(undefined, 25, 30)).toBe(25);
  });
});

describe('ChatRepository stable cursor pagination', () => {
  it('uses limit+1 and emits next cursor from the last returned chat row', async () => {
    const rows = [
      { id: id3, updated_at: t0 },
      { id: id2, updated_at: t0 },
      { id: id1, updated_at: t0 },
    ];
    const limit = jest.fn().mockResolvedValue({ data: rows, error: null });
    const orderId = jest.fn().mockReturnValue({ limit });
    const orderUpdated = jest.fn().mockReturnValue({ order: orderId });
    const select = jest.fn().mockReturnValue({ order: orderUpdated });
    const repository = repositoryWith({
      from: jest.fn().mockReturnValue({ select }),
    });

    const page = await repository.list(request, { limit: 2 });

    expect(limit).toHaveBeenCalledWith(3);
    expect(page.chats).toEqual(rows.slice(0, 2));
    expect(decodeChatCursor(page.nextCursor!)).toEqual({
      timestamp: t0,
      id: id2,
    });
  });

  it('uses updated_at + id tie-breaker in the next chat page predicate', async () => {
    const cursor = encodeChatCursor({ timestamp: t0, id: id2 });
    const or = jest.fn().mockResolvedValue({ data: [], error: null });
    const limit = jest.fn().mockReturnValue({ or });
    const orderId = jest.fn().mockReturnValue({ limit });
    const orderUpdated = jest.fn().mockReturnValue({ order: orderId });
    const select = jest.fn().mockReturnValue({ order: orderUpdated });
    const repository = repositoryWith({
      from: jest.fn().mockReturnValue({ select }),
    });

    await expect(repository.list(request, { limit: 2, after: cursor })).resolves.toEqual({
      chats: [],
      nextCursor: null,
    });
    expect(or).toHaveBeenCalledWith(
      `updated_at.lt.${t0},and(updated_at.eq.${t0},id.lt.${id2})`,
    );
  });

  it('uses created_at + id ascending tie-breaker for message pages', async () => {
    const cursor = encodeChatCursor({ timestamp: t0, id: id2 });
    const or = jest.fn().mockResolvedValue({ data: [], error: null });
    const limit = jest.fn().mockReturnValue({ or });
    const orderId = jest.fn().mockReturnValue({ limit });
    const orderCreated = jest.fn().mockReturnValue({ order: orderId });
    const eq = jest.fn().mockReturnValue({ order: orderCreated });
    const select = jest.fn().mockReturnValue({ eq });
    const repository = repositoryWith({
      from: jest.fn().mockReturnValue({ select }),
    });

    await expect(
      repository.listMessages(request, 'chat-1', { limit: 20, after: cursor }),
    ).resolves.toEqual({ messages: [], nextCursor: null });
    expect(or).toHaveBeenCalledWith(
      `created_at.gt.${t0},and(created_at.eq.${t0},id.gt.${id2})`,
    );
  });

  it('returns no next cursor on a final message page', async () => {
    const rows = [{ id: id1, created_at: t0 }];
    const limit = jest.fn().mockResolvedValue({ data: rows, error: null });
    const orderId = jest.fn().mockReturnValue({ limit });
    const orderCreated = jest.fn().mockReturnValue({ order: orderId });
    const eq = jest.fn().mockReturnValue({ order: orderCreated });
    const select = jest.fn().mockReturnValue({ eq });
    const repository = repositoryWith({
      from: jest.fn().mockReturnValue({ select }),
    });

    await expect(
      repository.listMessages(request, 'chat-1', { limit: 2 }),
    ).resolves.toEqual({ messages: rows, nextCursor: null });
    expect(limit).toHaveBeenCalledWith(3);
  });

  it('bounds model-history candidates to 500 and reverses the descending DB window', async () => {
    const newestFirst = [
      { id: id3, created_at: '2026-08-08T00:00:03.000Z' },
      { id: id2, created_at: '2026-08-08T00:00:02.000Z' },
      { id: id1, created_at: '2026-08-08T00:00:01.000Z' },
    ];
    const limit = jest.fn().mockResolvedValue({
      data: newestFirst,
      error: null,
    });
    const orderId = jest.fn().mockReturnValue({ limit });
    const orderCreated = jest.fn().mockReturnValue({ order: orderId });
    const eq = jest.fn().mockReturnValue({ order: orderCreated });
    const select = jest.fn().mockReturnValue({ eq });
    const repository = repositoryWith({
      from: jest.fn().mockReturnValue({ select }),
    });

    await expect(repository.listRecentMessages(request, 'chat-1', 9999)).resolves.toEqual(
      [...newestFirst].reverse(),
    );
    expect(orderCreated).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(orderId).toHaveBeenCalledWith('id', { ascending: false });
    expect(limit).toHaveBeenCalledWith(500);
  });
});
