import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ChatV1ContextDto } from '../../ai/v1/chat-v1.dto';

export class ChatPageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  after?: string;
}

export class CreateChatDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  @Matches(/\S/, { message: 'title must contain non-whitespace characters' })
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
  // Null is not a valid title clear operation. Omit title to leave it unchanged.
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Length(1, 200)
  @Matches(/\S/, { message: 'title must contain non-whitespace characters' })
  title?: string;

  // Page/module context can be explicitly cleared with null.
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @Length(1, 512)
  @Matches(/\S/, { message: 'pagePath must contain non-whitespace characters' })
  pagePath?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @Length(1, 128)
  @Matches(/\S/, { message: 'moduleKey must contain non-whitespace characters' })
  moduleKey?: string | null;

  // Metadata is replacement semantics when supplied; null is invalid.
  @ValidateIf((_, value) => value !== undefined)
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreateChatMessageDto {
  @IsString()
  @Length(1, 12000)
  @Matches(/\S/, { message: 'content must contain non-whitespace characters' })
  content!: string;

  /** Stable assistant-ui/local message id for retry idempotency. */
  @IsOptional()
  @IsString()
  @Length(1, 200)
  @Matches(/\S/, { message: 'clientMessageId must contain non-whitespace characters' })
  clientMessageId?: string;

  /**
   * Previous message reference for branching. May be either a server message
   * UUID returned by the API or a stable clientMessageId known to this chat.
   */
  @IsOptional()
  @IsString()
  @Length(1, 200)
  @Matches(/\S/, { message: 'parentMessageId must contain non-whitespace characters' })
  parentMessageId?: string;

  /** Stable assistant-ui id for the assistant message produced by this run. */
  @IsOptional()
  @IsString()
  @Length(1, 200)
  @Matches(/\S/, { message: 'assistantMessageId must contain non-whitespace characters' })
  assistantMessageId?: string;

  /** One UUID per model run. Reuse it only when retrying the same request. */
  @IsOptional()
  @IsUUID('4')
  runId?: string;

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
