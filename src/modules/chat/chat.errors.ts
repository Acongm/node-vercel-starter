import { HttpException } from '@nestjs/common';

export type ChatErrorFrame = {
  type: 'error';
  code: string;
  message: string;
};

export class ChatContractError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ChatContractError';
  }
}

export function toChatErrorFrame(error: unknown): ChatErrorFrame {
  if (error instanceof ChatContractError) {
    return { type: 'error', code: error.code, message: error.message };
  }

  if (error instanceof HttpException) {
    const response = error.getResponse();
    if (response && typeof response === 'object') {
      const body = response as Record<string, unknown>;
      const code = typeof body.code === 'string' ? body.code : undefined;
      const message = typeof body.message === 'string' ? body.message : undefined;
      if (code && message) return { type: 'error', code, message };
    }
  }

  return {
    type: 'error',
    code: 'CHAT_STREAM_FAILED',
    message: 'Chat stream failed.',
  };
}
