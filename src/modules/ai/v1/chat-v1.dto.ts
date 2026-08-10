import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/** class-validator `@IsOptional` only skips null/undefined — empty strings still fail `@Length`. */
function EmptyToUndefined() {
  return Transform(({ value }) => (value === '' ? undefined : value));
}

export class ChatV1MessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @Length(1, 12000)
  content!: string;
}

export class ChatV1ContextDto {
  @IsOptional()
  @IsIn(['article', 'module'])
  scope?: 'article' | 'module';

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @Length(1, 512)
  pagePath?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @Length(1, 128)
  moduleKey?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @Length(1, 256)
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  tags?: string[];

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @Length(1, 12000)
  content?: string;

  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  contentHash?: string;
}

export class ChatV1Dto {
  @IsOptional()
  @IsString()
  @Length(1, 12000)
  prompt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ChatV1MessageDto)
  messages?: ChatV1MessageDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ChatV1ContextDto)
  context?: ChatV1ContextDto;

  @IsOptional()
  @IsBoolean()
  enableWebSearch?: boolean;

  /** Emit model reasoning/thinking stream events when the provider supports it. */
  @IsOptional()
  @IsBoolean()
  enableThinking?: boolean;

  /** Completion max tokens (1–8192). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8192)
  maxTokens?: number;

  /** short = document Q&A bounds; long = expanded history for multi-turn chat. */
  @IsOptional()
  @IsIn(['short', 'long'])
  historyMode?: 'short' | 'long';

  @IsOptional()
  @IsString()
  @Length(1, 128)
  conversationId?: string;

  /**
   * User preference prompt from Settings (server-validated). Appended after
   * the fixed security/system policy — never replaces it.
   */
  @IsOptional()
  @IsString()
  @Length(1, 4000)
  userDefaultPrompt?: string;
}
