import { IsOptional, IsString, Length } from 'class-validator';

export class OAuthExchangeDto {
  @IsString()
  @Length(1, 2048)
  code!: string;

  @IsOptional()
  @IsString()
  @Length(1, 2048)
  redirectUri?: string;
}
