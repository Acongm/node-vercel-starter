import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class ChatContextDto {
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
}
