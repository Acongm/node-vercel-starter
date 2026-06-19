import { Request } from 'express';

export interface ChatRequestMeta {
  clientId?: string;
  callSource: string;
  conversationId?: string;
  requestId?: string;
  origin?: string;
  userAgent?: string;
}

export function extractChatRequestMeta(req: Request): ChatRequestMeta {
  return {
    clientId: req.header('x-client-id')?.trim() || undefined,
    callSource: req.header('x-call-source')?.trim() || 'unknown',
    conversationId: req.header('x-conversation-id')?.trim() || undefined,
    requestId: req.header('x-request-id') || undefined,
    origin: req.header('origin') || undefined,
    userAgent: req.header('user-agent') || undefined,
  };
}

export function extractLastUserMessage(input: {
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
}): string {
  if (input.prompt?.trim()) {
    return input.prompt.trim();
  }

  if (!input.messages?.length) {
    return '';
  }

  const lastUser = [...input.messages]
    .reverse()
    .find((message) => message.role === 'user');

  return lastUser?.content?.trim() ?? '';
}
