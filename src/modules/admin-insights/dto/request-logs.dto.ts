import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { RouteGroup } from '../../../common/request-route-meta';

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

const ROUTE_GROUPS = ['auth', 'chat', 'admin', 'ai', 'other'] as const;

export class RequestLogStatsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  hours?: number = 24;

  @IsOptional()
  @IsIn(ROUTE_GROUPS)
  group?: RouteGroup;

  @IsOptional()
  @Transform(({ value }) => parseBooleanQuery(value, true))
  @IsBoolean()
  excludeStream?: boolean = true;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

function parseBooleanQuery(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (value === 'false' || value === '0') {
    return false;
  }
  if (value === 'true' || value === '1') {
    return true;
  }
  return Boolean(value);
}
