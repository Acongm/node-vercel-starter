import { BadRequestException } from '@nestjs/common';

export type ChatCursor = {
  timestamp: string;
  id: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeChatCursor(cursor: ChatCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeChatCursor(value: string | undefined): ChatCursor | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = JSON.parse(
      Buffer.from(trimmed, 'base64url').toString('utf8'),
    ) as Partial<ChatCursor>;
    if (
      typeof parsed.timestamp !== 'string' ||
      Number.isNaN(Date.parse(parsed.timestamp)) ||
      typeof parsed.id !== 'string' ||
      !UUID_RE.test(parsed.id)
    ) {
      throw new Error('invalid cursor payload');
    }
    return { timestamp: parsed.timestamp, id: parsed.id };
  } catch {
    throw new BadRequestException({
      code: 'CHAT_INVALID_CURSOR',
      message: 'Pagination cursor is invalid.',
    });
  }
}

export function normalizePageLimit(
  value: number | undefined,
  defaultLimit = 50,
  maxLimit = 100,
): number {
  if (value === undefined) return defaultLimit;
  return Math.max(1, Math.min(value, maxLimit));
}
