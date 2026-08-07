import { IsObject, IsOptional, IsString, IsUrl, Length } from 'class-validator';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  displayName?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  avatarUrl?: string;

  @IsOptional()
  @IsObject()
  preferences?: Record<string, unknown>;
}
