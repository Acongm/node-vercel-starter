import {
  IsIn,
  IsObject,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateUserSettingsDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Length(2, 16)
  language?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['system', 'light', 'dark'])
  theme?: 'system' | 'light' | 'dark';

  /** null clears the override and restores platform default. */
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @Length(1, 80)
  chatDefaultModel?: string | null;

  /** null clears the override. */
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(4000)
  chatDefaultPrompt?: string | null;

  /**
   * Shallow-merge into preferences. Known keys may also be set via top-level
   * fields above; top-level wins when both are present.
   */
  @ValidateIf((_, value) => value !== undefined)
  @IsObject()
  preferences?: Record<string, unknown>;
}
