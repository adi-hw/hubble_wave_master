import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateGlobalSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  platformName?: string;

  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @IsOptional()
  @IsBoolean()
  publicSignup?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  defaultTrialDays?: number;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  supportEmail?: string;
}
