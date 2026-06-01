import { IsOptional, IsString, Length } from 'class-validator';

export class LoginDto {
  @IsOptional()
  @IsString()
  @Length(1, 80)
  username?: string;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  password?: string;
}
