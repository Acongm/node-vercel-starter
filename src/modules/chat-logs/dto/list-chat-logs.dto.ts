import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class ListChatLogsDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  clientId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 512)
  pagePath?: string;

  @IsOptional()
  @IsString()
  @Length(1, 128)
  conversationId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
}
