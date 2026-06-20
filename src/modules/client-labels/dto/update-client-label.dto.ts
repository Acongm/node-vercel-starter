import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateClientLabelDto {
  @IsOptional()
  @IsString()
  @Length(1, 128)
  label?: string;

  @IsOptional()
  @IsString()
  @Length(1, 512)
  note?: string;
}
