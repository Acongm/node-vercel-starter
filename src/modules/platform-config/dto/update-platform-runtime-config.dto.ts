import { Type } from 'class-transformer';
import {
  Allow,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ServiceCallerKeyDto {
  @IsString()
  id!: string;

  @IsOptional()
  @Allow()
  key?: string | null;
}

export class UpdatePlatformRuntimeConfigDto {
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  secrets?: Record<string, string | null>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceCallerKeyDto)
  serviceCallerKeys?: ServiceCallerKeyDto[];
}
