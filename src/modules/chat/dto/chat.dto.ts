import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ChatV1ContextDto } from '../../ai/v1/chat-v1.dto';

export class CreateChatDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 512)
  pagePath?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  moduleKey?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateChatDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsString()
  @Length(1, 512)
  pagePath?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  moduleKey?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateChatMessageDto {
  @IsString()
  @Length(1, 12000)
  @Matches(/\S/, { message: 'content must contain non-whitespace characters' })
  content!: string;

  @IsOptional()
  @IsBoolean()
  enableWebSearch?: boolean;

  @IsOptional()
  @IsBoolean()
  enableThinking?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8192)
  maxTokens?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatV1ContextDto)
  context?: ChatV1ContextDto;
}
