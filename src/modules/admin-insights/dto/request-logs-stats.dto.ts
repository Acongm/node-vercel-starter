import { IsIn, IsOptional } from 'class-validator';

export const REQUEST_LOG_STATS_WINDOWS = ['24h', '7d', '30d'] as const;
export type RequestLogStatsWindow = (typeof REQUEST_LOG_STATS_WINDOWS)[number];

export class RequestLogStatsDto {
  @IsOptional()
  @IsIn(REQUEST_LOG_STATS_WINDOWS)
  window?: RequestLogStatsWindow = '24h';
}
