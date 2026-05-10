import { IsDateString, IsInt, IsOptional, IsString, Length, MaxLength, Min, IsIn } from 'class-validator';
import { LicenseStatus, LicenseType } from '@hubblewave/control-plane-db';

const LICENSE_TYPE = ['starter', 'professional', 'enterprise', 'trial'] as const;
const LICENSE_STATUS = ['active', 'pending', 'expired', 'revoked'] as const;

export class CreateLicenseDto {
  @IsString()
  customerId!: string;

  @IsIn(LICENSE_TYPE as unknown as string[])
  licenseType!: LicenseType;

  @IsInt()
  @Min(1)
  maxUsers!: number;

  @IsInt()
  @Min(1)
  maxAssets!: number;

  @IsDateString()
  expiresAt!: string;

  @IsOptional()
  features?: string[];
}

export class UpdateLicenseStatusDto {
  @IsIn(LICENSE_STATUS as unknown as string[])
  status!: LicenseStatus;

  @IsOptional()
  @MaxLength(500)
  revokeReason?: string;
}

export class ValidateLicenseDto {
  @IsString()
  @Length(10, 200)
  licenseKey!: string;
}
