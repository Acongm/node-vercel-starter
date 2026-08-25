import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const REQUEST_LOG_STATS_WINDOWS = ['24h', '7d', '30d'] as const;
export type RequestLogStatsWindow = (typeof REQUEST_LOG_STATS_WINDOWS)[number];

export const REQUEST_LOG_PATH_SORTS = [
  'count',
  'avg_duration',
  'p95',
  'max_duration',
  'errors',
] as const;
export type RequestLogPathSort = (typeof REQUEST_LOG_PATH_SORTS)[number];

export class RequestLogStatsDto {
  @IsOptional()
  @IsIn(REQUEST_LOG_STATS_WINDOWS)
  window?: RequestLogStatsWindow = '24h';

  @IsOptional()
  @Transform(({ value }) => parseBooleanQuery(value, true))
  @IsBoolean()
  excludeStream?: boolean = true;

  @IsOptional()
  @IsIn(REQUEST_LOG_PATH_SORTS)
  pathSort?: RequestLogPathSort = 'p95';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pathLimit?: number = 50;
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
