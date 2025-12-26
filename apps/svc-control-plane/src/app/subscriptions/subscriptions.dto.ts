import { IsNumber, IsOptional, IsString, MaxLength, IsIn } from 'class-validator';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing';
const SUB_STATUS = ['active', 'past_due', 'canceled', 'trialing'] as const;
const BILLING_CYCLE = ['monthly', 'annual'] as const;

export class CreateSubscriptionDto {
  @IsString()
  customerId!: string;

  @IsString()
  planId!: string;

  @IsIn(BILLING_CYCLE as unknown as string[])
  billingCycle!: 'monthly' | 'annual';

  @IsNumber()
  monthlyAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  externalId?: string;
}

export class UpdateSubscriptionDto {
  @IsOptional()
  @IsIn(SUB_STATUS as unknown as string[])
  status?: SubscriptionStatus;

  @IsOptional()
  @IsString()
  planId?: string;

  @IsOptional()
  @IsNumber()
  monthlyAmount?: number;
}
