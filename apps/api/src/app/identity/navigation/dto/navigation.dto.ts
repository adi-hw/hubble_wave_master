import { IsString, IsOptional, IsArray, IsBoolean, IsNumber, IsEnum, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Resolved navigation node for frontend consumption
 */
export class ResolvedNavNode {
  @ApiProperty({ description: 'Unique key for patch targeting' })
  key!: string;

  @ApiProperty({ description: 'Display label' })
  label!: string;

  @ApiPropertyOptional({ description: 'Lucide icon name' })
  icon?: string;

  @ApiProperty({ description: 'Node type', enum: ['group', 'module', 'link', 'separator', 'smart_group'] })
  type!: 'group' | 'module' | 'link' | 'separator' | 'smart_group';

  @ApiPropertyOptional({ description: 'Route path for navigation' })
  route?: string;

  @ApiPropertyOptional({ description: 'External URL' })
  url?: string;

  @ApiPropertyOptional({ description: 'Reference module key' })
  moduleKey?: string;

  @ApiPropertyOptional({ description: 'Nested children nodes', type: [ResolvedNavNode] })
  children?: ResolvedNavNode[];

  @ApiPropertyOptional({ description: 'Smart group type' })
  smartGroupType?: 'favorites' | 'recent' | 'frequent';

  @ApiPropertyOptional({ description: 'Smart group items (populated dynamically)', type: [ResolvedNavNode] })
  smartGroupItems?: ResolvedNavNode[];
}

/**
 * Complete resolved navigation for a user
 */
export class ResolvedNavigation {
  @ApiProperty({ description: 'Active profile ID' })
  profileId!: string;

  @ApiProperty({ description: 'Active profile slug' })
  profileSlug!: string;

  @ApiProperty({ description: 'Profile name' })
  profileName!: string;

  @ApiProperty({ description: 'Navigation tree', type: [ResolvedNavNode] })
  nodes!: ResolvedNavNode[];

  @ApiPropertyOptional({ description: 'User favorites (module keys)' })
  favorites?: string[];

  @ApiPropertyOptional({ description: 'Recently accessed modules' })
  recentModules?: { key: string; label: string; icon?: string; route?: string; accessedAt: string }[];
}

/**
 * Available profile summary for profile switching
 */
export class NavProfileSummary {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  isDefault!: boolean;
}

/**
 * Navigation search result
 */
export class NavSearchResult {
  @ApiProperty()
  key!: string;

  @ApiProperty()
  label!: string;

  @ApiPropertyOptional()
  icon?: string;

  @ApiPropertyOptional()
  route?: string;

  @ApiProperty({ description: 'Breadcrumb path to this item' })
  path!: string[];

  @ApiProperty({ description: 'Match score for ranking' })
  score!: number;
}

// === Request/Response DTOs ===

export class SwitchProfileDto {
  @ApiProperty({ description: 'Profile ID to switch to' })
  @IsString()
  profileId!: string;
}

export class SearchNavigationDto {
  @ApiProperty({ description: 'Search query' })
  @IsString()
  query!: string;

  @ApiPropertyOptional({ description: 'Maximum results to return' })
  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class ToggleFavoriteDto {
  @ApiProperty({ description: 'Module key to toggle' })
  @IsString()
  moduleKey!: string;
}

export class RecordNavigationDto {
  @ApiProperty({ description: 'Module key that was accessed' })
  @IsString()
  moduleKey!: string;
}

// === Request/Response DTOs ===

export class SwitchProfileRequest {
  @ApiProperty()
  @IsString()
  profileId!: string;
}

export class ToggleFavoriteRequest {
  @ApiProperty()
  @IsString()
  moduleKey!: string;
}

export class RecordNavigationRequest {
  @ApiProperty()
  @IsString()
  moduleKey!: string;
}

// === Admin DTOs ===

export class VisibilityRulesDto {
  @ApiPropertyOptional({ description: 'User must have ANY of these roles' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rolesAny?: string[];

  @ApiPropertyOptional({ description: 'User must have ALL of these roles' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  rolesAll?: string[];

  @ApiPropertyOptional({ description: 'User must have ANY of these permissions' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionsAny?: string[];

  @ApiPropertyOptional({ description: 'ANY of these feature flags must be enabled' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featureFlagsAny?: string[];

  @ApiPropertyOptional({ description: 'DSL expression for complex visibility' })
  @IsOptional()
  @IsString()
  expression?: string;
}

export class CreateNavProfileDto {
  @ApiProperty()
  @IsString()
  slug!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Template key to base this profile on' })
  @IsOptional()
  @IsString()
  templateKey?: string;

  @ApiPropertyOptional({ description: 'Roles for auto-assignment' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  autoAssignRoles?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateNavProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  autoAssignRoles?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  autoAssignExpression?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateNavNodeDto {
  @ApiProperty()
  @IsString()
  key!: string;

  @ApiProperty()
  @IsString()
  label!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ enum: ['group', 'module', 'link', 'separator', 'smart_group'] })
  @IsEnum(['group', 'module', 'link', 'separator', 'smart_group'])
  type!: 'group' | 'module' | 'link' | 'separator' | 'smart_group';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  moduleKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional({ type: VisibilityRulesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VisibilityRulesDto)
  visibility?: VisibilityRulesDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contextTags?: string[];
}

export class UpdateNavNodeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  moduleKey?: string;

  @ApiPropertyOptional({ description: 'Parent key (send empty string to move to root)' })
  @IsOptional()
  @IsString()
  parentKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  url?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVisible?: boolean;

  @ApiPropertyOptional({ type: VisibilityRulesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VisibilityRulesDto)
  visibility?: VisibilityRulesDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contextTags?: string[];
}

export class CreateNavPatchDto {
  @ApiProperty({ enum: ['hide', 'show', 'move', 'rename', 'insert', 'replace', 'clone', 'set_visibility', 'set_icon', 'reorder'] })
  @IsString()
  operation!: string;

  @ApiProperty()
  @IsString()
  targetNodeKey!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class PreviewNavigationDto {
  @ApiPropertyOptional({ description: 'Roles to simulate' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @ApiPropertyOptional({ description: 'Permissions to simulate' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @ApiPropertyOptional({ description: 'Feature flags to simulate as enabled' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  featureFlags?: string[];

  @ApiPropertyOptional({ description: 'Context tags to include' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contextTags?: string[];
}
