import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';

const PASSWORD_POLICY_VALUES = ['standard', 'strict', 'compliance'] as const;
const BACKUP_FREQUENCY_VALUES = ['hourly', 'daily', 'weekly', 'monthly'] as const;

/**
 * Strict allowlist DTO for the customer settings payload. Combined with
 * `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` on the
 * controller, any unknown key is rejected at the boundary instead of being
 * silently spread into the customer record.
 */

export class FeatureSettingsDto {
  @IsOptional() @IsBoolean() ai_assistant?: boolean;
  @IsOptional() @IsBoolean() advanced_analytics?: boolean;
  @IsOptional() @IsBoolean() custom_integrations?: boolean;
  @IsOptional() @IsBoolean() mobile_app?: boolean;
  @IsOptional() @IsBoolean() sso?: boolean;
  @IsOptional() @IsBoolean() audit_logs?: boolean;
}

export class SecuritySettingsDto {
  @IsOptional() @IsBoolean() mfa_required?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ip_whitelist?: string[];

  @IsOptional() @IsInt() @Min(5) @Max(1440) session_timeout?: number;

  @IsOptional()
  @IsIn(PASSWORD_POLICY_VALUES as unknown as string[])
  password_policy?: (typeof PASSWORD_POLICY_VALUES)[number];
}

export class NotificationSettingsDto {
  @IsOptional() @IsBoolean() email_alerts?: boolean;
  @IsOptional() @IsBoolean() slack_integration?: boolean;
  @IsOptional() @IsString() @MaxLength(2048) webhook_url?: string;
}

export class BackupSettingsDto {
  @IsOptional()
  @IsIn(BACKUP_FREQUENCY_VALUES as unknown as string[])
  frequency?: (typeof BACKUP_FREQUENCY_VALUES)[number];

  @IsOptional() @IsInt() @Min(1) @Max(3650) retention_days?: number;
  @IsOptional() @IsBoolean() cross_region?: boolean;
}

export class ApiSettingsDto {
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) rate_limit?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) burst_limit?: number;
}

export class BrandingSettingsDto {
  @IsOptional() @IsString() @MaxLength(20) primary_color?: string;
  @IsOptional() @IsString() @MaxLength(2048) logo_url?: string;
  @IsOptional() @IsString() @MaxLength(255) custom_domain?: string;
}

export class CustomerSettingsDto {
  @IsOptional() @IsString() @MaxLength(64) timezone?: string;
  @IsOptional() @IsString() @MaxLength(32) dateFormat?: string;
  @IsOptional() @IsString() @MaxLength(16) locale?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FeatureSettingsDto)
  features?: FeatureSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SecuritySettingsDto)
  security?: SecuritySettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationSettingsDto)
  notifications?: NotificationSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BackupSettingsDto)
  backup?: BackupSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ApiSettingsDto)
  api?: ApiSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandingSettingsDto)
  branding?: BrandingSettingsDto;
}
