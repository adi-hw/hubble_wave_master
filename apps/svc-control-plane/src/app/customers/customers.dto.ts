import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerSettings } from '@hubblewave/control-plane-db';

const CUSTOMER_STATUS = ['active', 'trial', 'suspended', 'churned', 'pending', 'terminated'] as const;
const CUSTOMER_TIER = ['starter', 'professional', 'enterprise'] as const;

export class CustomerQueryParams {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(CUSTOMER_STATUS as unknown as string[])
  status?: (typeof CUSTOMER_STATUS)[number];

  @IsOptional()
  @IsIn(CUSTOMER_TIER as unknown as string[])
  tier?: (typeof CUSTOMER_TIER)[number];

  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsPositive()
  @Type(() => Number)
  limit?: number;
}

export class CreateCustomerDto {
  @IsString()
  @Length(2, 50)
  code!: string;

  @IsString()
  @Length(2, 255)
  name!: string;

  @IsOptional()
  @IsIn(CUSTOMER_STATUS as unknown as string[])
  status?: (typeof CUSTOMER_STATUS)[number];

  @IsOptional()
  @IsIn(CUSTOMER_TIER as unknown as string[])
  tier?: (typeof CUSTOMER_TIER)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  primaryContactName?: string;

  @IsOptional()
  @IsEmail()
  primaryContactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  primaryContactPhone?: string;

  @IsOptional()
  @IsNumber()
  mrr?: number;

  @IsOptional()
  contractStart?: Date;

  @IsOptional()
  contractEnd?: Date;

  @IsOptional()
  settings?: Partial<CustomerSettings>;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @Length(2, 255)
  name?: string;

  @IsOptional()
  @IsIn(CUSTOMER_STATUS as unknown as string[])
  status?: (typeof CUSTOMER_STATUS)[number];

  @IsOptional()
  @IsIn(CUSTOMER_TIER as unknown as string[])
  tier?: (typeof CUSTOMER_TIER)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  primaryContactName?: string;

  @IsOptional()
  @IsEmail()
  primaryContactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  primaryContactPhone?: string;

  @IsOptional()
  @IsNumber()
  mrr?: number;

  @IsOptional()
  contractStart?: Date;

  @IsOptional()
  contractEnd?: Date;

  @IsOptional()
  settings?: Partial<CustomerSettings>;

  @IsOptional()
  @IsString()
  notes?: string;
}
