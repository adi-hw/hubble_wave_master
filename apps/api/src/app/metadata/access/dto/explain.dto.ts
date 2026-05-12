import { IsString, IsUUID, IsEnum, IsObject, IsOptional, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * §28.7 — input shape for the `/authorization/explain` admin endpoint.
 *
 * The admin asks: "what would user X see for collection Y / operation Z?".
 * The endpoint resolves the target user's identity (roles, groups) via
 * the `IdentityResolverPort` and runs the evaluator AS IF the target user
 * was the request principal — returning the §28.7 provenance shape
 * without surfacing the target user's data.
 */
export class ExplainCollectionDto {
  /** Target user UUID — the user whose policy outcome is being explained. */
  @IsUUID()
  userId!: string;

  /** Collection UUID being checked. */
  @IsUUID()
  collectionId!: string;

  /** CRUD operation to explain. */
  @IsEnum(['read', 'create', 'update', 'delete'])
  operation!: 'read' | 'create' | 'update' | 'delete';
}

/**
 * §28.7 — minimal field shape sufficient to identify a field for the
 * explain endpoint. Mirrors `PropertyMeta` from `@hubblewave/authorization`
 * with only the fields the evaluator actually reads (`code` and
 * `isSystem`).
 */
export class ExplainFieldShape {
  @IsString()
  code!: string;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}

export class ExplainFieldDto {
  /** Target user UUID. */
  @IsUUID()
  userId!: string;

  /** Collection UUID containing the field. */
  @IsUUID()
  collectionId!: string;

  /** The field shape (`code` + optional `isSystem`). */
  @IsObject()
  @ValidateNested()
  @Type(() => ExplainFieldShape)
  field!: ExplainFieldShape;
}
