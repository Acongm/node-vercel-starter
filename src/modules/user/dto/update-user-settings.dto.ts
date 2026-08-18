import { IsArray, IsIn, IsObject, IsString, Length, ValidateIf } from 'class-validator';
import type { AgentSkill } from '../user-settings';

export class UpdateUserSettingsDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Length(2, 16)
  language?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsIn(['system', 'light', 'dark'])
  theme?: 'system' | 'light' | 'dark';

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Length(1, 80)
  defaultModel?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @Length(0, 2000)
  defaultPrompt?: string | null;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsArray()
  skills?: AgentSkill[] | null;

  /**
   * Shallow-merge into preferences. Known keys (language/theme) may also be
   * set via the top-level fields above; top-level wins when both are present.
   */
  @ValidateIf((_, value) => value !== undefined)
  @IsObject()
  preferences?: Record<string, unknown>;
}
