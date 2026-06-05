import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  author?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2000)
  content?: string;
}
