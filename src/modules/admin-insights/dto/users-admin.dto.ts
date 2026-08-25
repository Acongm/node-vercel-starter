import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListPlatformUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 50;

  @IsOptional()
  @IsIn(['true', 'false'])
  anonymous?: 'true' | 'false';

  @IsOptional()
  @IsString()
  q?: string;

  /** Anonymous tab: users with chats, purgeable ghosts, or everyone. */
  @IsOptional()
  @IsIn(['active', 'ghost', 'all'])
  activity?: 'active' | 'ghost' | 'all';
}

export class PurgeGhostUsersDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  dryRun?: 'true' | 'false';
}

export class ListLocalUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 20;
}
