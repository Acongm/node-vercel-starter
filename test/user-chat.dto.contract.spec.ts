import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateChatMessageDto } from '../src/modules/chat/dto/chat.dto';
import { UpdateUserProfileDto } from '../src/modules/user/dto/update-user-profile.dto';

describe('User/Chat DTO contract', () => {
  it('rejects blank-only chat message content', async () => {
    const dto = plainToInstance(CreateChatMessageDto, { content: '   ' });
    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);
  });

  it('rejects blank-only durable message references', async () => {
    for (const field of [
      'clientMessageId',
      'parentMessageId',
      'assistantMessageId',
    ] as const) {
      const dto = plainToInstance(CreateChatMessageDto, {
        content: 'hello',
        [field]: '   ',
      });
      const errors = await validate(dto);
      expect(errors.some((error) => error.property === field)).toBe(true);
    }
  });

  it('requires runId to be a v4 UUID so retries have a stable unambiguous key', async () => {
    const invalid = plainToInstance(CreateChatMessageDto, {
      content: 'hello',
      runId: 'same-run',
    });
    const valid = plainToInstance(CreateChatMessageDto, {
      content: 'hello',
      runId: '22222222-2222-4222-8222-222222222222',
    });

    expect((await validate(invalid)).some((error) => error.property === 'runId')).toBe(
      true,
    );
    expect(await validate(valid)).toHaveLength(0);
  });

  it('accepts assistant-ui message ids that are not UUIDs', async () => {
    const dto = plainToInstance(CreateChatMessageDto, {
      content: 'hello',
      clientMessageId: 'msg_user_local_1',
      parentMessageId: 'msg_assistant_local_0',
      assistantMessageId: 'msg_assistant_local_1',
      runId: '22222222-2222-4222-8222-222222222222',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects blank-only display names', async () => {
    const dto = plainToInstance(UpdateUserProfileDto, { displayName: '   ' });
    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);
  });

  it('allows explicit null to clear display name and avatar', async () => {
    const dto = plainToInstance(UpdateUserProfileDto, {
      displayName: null,
      avatarUrl: null,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects avatar URLs without a protocol', async () => {
    const dto = plainToInstance(UpdateUserProfileDto, {
      avatarUrl: 'example.com/avatar.png',
    });
    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);
  });

  it('accepts a partial profile patch without identity fields', async () => {
    const dto = plainToInstance(UpdateUserProfileDto, {
      preferences: { language: 'zh-CN' },
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects null preferences instead of leaking a NOT NULL violation to the database', async () => {
    const dto = plainToInstance(UpdateUserProfileDto, {
      preferences: null,
    });
    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);
  });

  it('rejects message content above the public API limit', async () => {
    const dto = plainToInstance(CreateChatMessageDto, {
      content: 'x'.repeat(12001),
    });
    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);
  });
});
