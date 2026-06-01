import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class ProxyRequestDto {
  @IsOptional()
  @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  body?: unknown;
}
