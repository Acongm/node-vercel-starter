import {
  IsObject,
  IsString,
  IsUrl,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

export class UpdateUserProfileDto {
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @Length(1, 80)
  @Matches(/\S/, {
    message: 'displayName must contain non-whitespace characters',
  })
  displayName?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUrl({ require_protocol: true })
  avatarUrl?: string | null;

  // Preferences use explicit replacement semantics when supplied. `null` is
  // rejected instead of leaking through @IsOptional into the NOT NULL column.
  @ValidateIf((_, value) => value !== undefined)
  @IsObject()
  preferences?: Record<string, unknown>;
}
