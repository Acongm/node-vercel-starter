import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChatContextDto } from './chat-context.dto';

class ChatMessageDto {
  @IsIn(['system', 'user', 'assistant'])
  role!: 'system' | 'user' | 'assistant';

  @IsString()
  @Length(1, 12000)
  content!: string;
}

export class ChatDto {
  @IsOptional()
  @IsString()
  @Length(1, 12000)
  prompt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages?: ChatMessageDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatContextDto)
  context?: ChatContextDto;

  @IsOptional()
  @IsBoolean()
  enableWebSearch?: boolean;
}
