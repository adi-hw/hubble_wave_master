import { IsString, IsOptional, IsBoolean, IsEnum, IsUUID, IsNumber, IsObject } from 'class-validator';

type PrincipalType = 'role' | 'team' | 'user' | 'everyone';
type AccessCondition = { property: string; operator: string; value: any };
type AccessConditionGroup = { and?: AccessCondition[]; or?: AccessCondition[] };

export class CreateCollectionAccessRuleDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['role', 'team', 'user', 'everyone'])
  principalType!: PrincipalType;

  @IsOptional()
  @IsUUID()
  principalId?: string;

  @IsOptional()
  @IsBoolean()
  canRead?: boolean;

  @IsOptional()
  @IsBoolean()
  canCreate?: boolean;

  @IsOptional()
  @IsBoolean()
  canUpdate?: boolean;

  @IsOptional()
  @IsBoolean()
  canDelete?: boolean;

  @IsOptional()
  @IsObject()
  condition?: AccessCondition | AccessConditionGroup;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  stopProcessing?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}

export class UpdateCollectionAccessRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  canRead?: boolean;

  @IsOptional()
  @IsBoolean()
  canCreate?: boolean;

  @IsOptional()
  @IsBoolean()
  canUpdate?: boolean;

  @IsOptional()
  @IsBoolean()
  canDelete?: boolean;

  @IsOptional()
  @IsObject()
  condition?: AccessCondition | AccessConditionGroup;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  stopProcessing?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePropertyAccessRuleDto {
  @IsString()
  propertyId!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsEnum(['role', 'team', 'user', 'everyone'])
  principalType!: PrincipalType;

  @IsOptional()
  @IsUUID()
  principalId?: string;

  @IsOptional()
  @IsBoolean()
  canRead?: boolean;

  @IsOptional()
  @IsBoolean()
  canWrite?: boolean;

  @IsOptional()
  @IsObject()
  condition?: AccessCondition | AccessConditionGroup;

  @IsOptional()
  @IsString()
  maskValue?: string;

  @IsOptional()
  @IsString()
  maskPattern?: string;

  @IsOptional()
  @IsBoolean()
  isPhi?: boolean;

  @IsOptional()
  @IsBoolean()
  phiAccessRequiresBreakGlass?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePropertyAccessRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  canRead?: boolean;

  @IsOptional()
  @IsBoolean()
  canWrite?: boolean;

  @IsOptional()
  @IsObject()
  condition?: AccessCondition | AccessConditionGroup;

  @IsOptional()
  @IsString()
  maskValue?: string;

  @IsOptional()
  @IsString()
  maskPattern?: string;

  @IsOptional()
  @IsBoolean()
  isPhi?: boolean;

  @IsOptional()
  @IsBoolean()
  phiAccessRequiresBreakGlass?: boolean;

  @IsOptional()
  @IsNumber()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

