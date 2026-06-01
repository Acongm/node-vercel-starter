import { IsOptional, IsString, Length } from 'class-validator';

export class CreateCommentDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  author?: string;

  @IsString()
  @Length(1, 2000)
  content!: string;
}
