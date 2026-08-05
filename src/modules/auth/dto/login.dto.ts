import { IsOptional, IsString, Length } from 'class-validator';

export class LoginDto {
  /** Email or username for local / admin login. */
  @IsOptional()
  @IsString()
  @Length(1, 80)
  username?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  email?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  password?: string;
}
