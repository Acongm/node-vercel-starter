import { IsIn, IsObject, IsString, Length, ValidateIf } from 'class-validator';

export class UpdateUserSettingsDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Length(2, 16)
  language?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['system', 'light', 'dark'])
  theme?: 'system' | 'light' | 'dark';

  /**
   * Shallow-merge into preferences. Known keys (language/theme) may also be
   * set via the top-level fields above; top-level wins when both are present.
   */
  @ValidateIf((_, value) => value !== undefined)
  @IsObject()
  preferences?: Record<string, unknown>;
}
