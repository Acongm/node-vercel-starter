import { IsOptional, IsString, Length } from 'class-validator';

export class ClaimOAuthThreadsDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  clientId?: string;
}
