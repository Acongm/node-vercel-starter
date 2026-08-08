import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ChatContractError,
  toChatErrorFrame,
} from '../src/modules/chat/chat.errors';

describe('toChatErrorFrame', () => {
  it('preserves explicit safe ChatContractError code and message', () => {
    expect(
      toChatErrorFrame(
        new ChatContractError(
          'CHAT_EMPTY_RESPONSE',
          'Model returned no usable content.',
        ),
      ),
    ).toEqual({
      type: 'error',
      code: 'CHAT_EMPTY_RESPONSE',
      message: 'Model returned no usable content.',
    });
  });

  it('preserves an HttpException only when both stable code and string message are present', () => {
    expect(
      toChatErrorFrame(
        new ConflictException({
          code: 'CHAT_RUN_IN_PROGRESS',
          message: 'This runId is already running.',
        }),
      ),
    ).toEqual({
      type: 'error',
      code: 'CHAT_RUN_IN_PROGRESS',
      message: 'This runId is already running.',
    });
  });

  it.each([
    new BadRequestException({ message: 'missing code' }),
    new BadRequestException({ code: 'CHAT_BAD_REQUEST' }),
    new HttpException('raw string response', HttpStatus.BAD_REQUEST),
    new HttpException(null, HttpStatus.BAD_REQUEST),
  ])('sanitizes incomplete/non-object HttpException payloads', (error) => {
    expect(toChatErrorFrame(error)).toEqual({
      type: 'error',
      code: 'CHAT_STREAM_FAILED',
      message: 'Chat stream failed.',
    });
  });

  it.each([
    new Error('postgres password=secret'),
    'provider-string-error',
    { internal: 'stack trace' },
    null,
  ])('sanitizes unknown failures without leaking raw details', (error) => {
    expect(toChatErrorFrame(error)).toEqual({
      type: 'error',
      code: 'CHAT_STREAM_FAILED',
      message: 'Chat stream failed.',
    });
  });
});
