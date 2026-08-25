import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export const REQUEST_LOG_STATS_WINDOWS = ['24h', '7d', '30d'] as const;
export type RequestLogStatsWindow = (typeof REQUEST_LOG_STATS_WINDOWS)[number];

export class RequestLogStatsDto {
  @IsOptional()
  @IsIn(REQUEST_LOG_STATS_WINDOWS)
  window?: RequestLogStatsWindow = '24h';

  @IsOptional()
  @Transform(({ value }) => parseBooleanQuery(value, true))
  @IsBoolean()
  excludeStream?: boolean = true;
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
