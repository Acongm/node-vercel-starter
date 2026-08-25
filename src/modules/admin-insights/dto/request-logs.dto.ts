import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListRequestLogsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sinceId?: number;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 100;
}
