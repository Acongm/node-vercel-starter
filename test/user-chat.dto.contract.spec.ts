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

  it('rejects blank-only display names', async () => {
    const dto = plainToInstance(UpdateUserProfileDto, { displayName: '   ' });
    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);
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

  it('rejects message content above the public API limit', async () => {
    const dto = plainToInstance(CreateChatMessageDto, {
      content: 'x'.repeat(12001),
    });
    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);
  });
});
