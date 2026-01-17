import { IsIn, IsOptional, IsPositive, IsString, Length, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { InstanceEnvironment, InstanceHealth, InstanceStatus, ResourceTier } from '@hubblewave/control-plane-db';

const INSTANCE_ENV = ['production', 'staging', 'dev'] as const;
const INSTANCE_STATUS = ['provisioning', 'active', 'suspended', 'terminated', 'failed'] as const;
const INSTANCE_HEALTH = ['healthy', 'degraded', 'unhealthy', 'unknown'] as const;
const RESOURCE_TIER = ['standard', 'professional', 'enterprise'] as const;

export class InstanceQueryParams {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsIn(INSTANCE_ENV as unknown as string[])
  environment?: InstanceEnvironment;

  @IsOptional()
  @IsIn(INSTANCE_STATUS as unknown as string[])
  status?: InstanceStatus;

  @IsOptional()
  @IsIn(INSTANCE_HEALTH as unknown as string[])
  health?: InstanceHealth;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  limit?: number;
}

export class CreateInstanceDto {
  @IsString()
  customerId!: string;

  @IsIn(INSTANCE_ENV as unknown as string[])
  environment!: InstanceEnvironment;

  @IsString()
  @Length(2, 50)
  region!: string;

  @IsString()
  @Length(1, 50)
  @Matches(/^\d{8}-[0-9a-f]{7,64}$/, {
    message: 'version must be a release id in the form YYYYMMDD-<git-sha>',
  })
  version!: string;

  @IsOptional()
  @IsIn(RESOURCE_TIER as unknown as string[])
  resourceTier?: ResourceTier;
}

export class UpdateInstanceDto {
  @IsOptional()
  @IsIn(INSTANCE_STATUS as unknown as string[])
  status?: InstanceStatus;

  @IsOptional()
  @IsIn(INSTANCE_HEALTH as unknown as string[])
  health?: InstanceHealth;

  @IsOptional()
  @IsString()
  @Matches(/^\d{8}-[0-9a-f]{7,64}$/, {
    message: 'version must be a release id in the form YYYYMMDD-<git-sha>',
  })
  version?: string;

  @IsOptional()
  @IsIn(RESOURCE_TIER as unknown as string[])
  resourceTier?: ResourceTier;

  @IsOptional()
  config?: Record<string, unknown>;

  // Internal fields used by workers
  @IsOptional()
  provisioningCompletedAt?: Date;

  @IsOptional()
  lastDeployedAt?: Date;
}
