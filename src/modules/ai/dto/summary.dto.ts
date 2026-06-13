import { IsOptional, IsString, Length } from 'class-validator';

export class SummaryDto {
  @IsOptional()
  @IsString()
  @Length(1, 512)
  path?: string;

  @IsOptional()
  @IsString()
  @Length(1, 256)
  title?: string;

  @IsString()
  @Length(1, 12000)
  content!: string;
}
