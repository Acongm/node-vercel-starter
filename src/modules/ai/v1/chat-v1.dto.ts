import { Type } from 'class-transformer';
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

  @IsOptional()
  @IsString()
  @Length(1, 512)
  pagePath?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  moduleKey?: string;

  @IsOptional()
  @IsString()
  @Length(1, 256)
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @Length(1, 12000)
  content?: string;

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
  @ArrayMaxSize(50)
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
}
