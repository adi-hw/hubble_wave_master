import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PropertyAccessRule, PropertyDefinition } from '@hubblewave/instance-db';
import {
  PropertyAccessRuleData,
  PropertyAccessRuleRepository,
  AccessConditionData,
  AccessOperator,
  MaskingStrategy,
} from './types';

const VALID_ACCESS_OPERATORS: ReadonlySet<AccessOperator> = new Set<AccessOperator>([
  'equals',
  'not_equals',
  'greater_than',
  'greater_than_or_equals',
  'less_than',
  'less_than_or_equals',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'in',
  'not_in',
  'is_null',
  'is_not_null',
]);

const SAFE_PROPERTY_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const FORBIDDEN_VALUE_MARKERS = /(;|--|\/\*|\*\/)/;

/**
 * Validate an AccessConditionData tree before persisting. We refuse:
 *  - prototype-pollution-shaped keys
 *  - function values
 *  - raw SQL identifiers in `property`
 *  - operators outside the whitelist
 * The result is a structurally identical, freshly-allocated AccessConditionData
 * (no shared references with the input), suitable for direct serialization.
 */
function validateAccessCondition(
  raw: unknown,
  depth = 0,
): AccessConditionData | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  if (depth > 8) {
    throw new BadRequestException('Access condition is too deeply nested');
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException('Access condition must be an object');
  }
  const input = raw as Record<string, unknown>;
  const out: AccessConditionData = {};

  for (const key of Object.keys(input)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new BadRequestException(`Disallowed key in access condition: ${key}`);
    }
  }

  const property = input['property'];
  if (property !== undefined) {
    if (typeof property !== 'string' || !SAFE_PROPERTY_NAME.test(property)) {
      throw new BadRequestException(`Invalid property name in access condition: ${String(property)}`);
    }
    out.property = property;
  }

  const operator = input['operator'];
  if (operator !== undefined) {
    if (typeof operator !== 'string' || !VALID_ACCESS_OPERATORS.has(operator as AccessOperator)) {
      throw new BadRequestException(`Invalid operator in access condition: ${String(operator)}`);
    }
    out.operator = operator as AccessOperator;
  }

  if (input['value'] !== undefined) {
    out.value = sanitizeConditionValue(input['value']);
  }

  const andClauses = input['and'];
  if (andClauses !== undefined) {
    if (!Array.isArray(andClauses)) {
      throw new BadRequestException('and must be an array');
    }
    out.and = andClauses
      .map((item) => validateAccessCondition(item, depth + 1))
      .filter((c): c is AccessConditionData => c !== null);
  }

  const orClauses = input['or'];
  if (orClauses !== undefined) {
    if (!Array.isArray(orClauses)) {
      throw new BadRequestException('or must be an array');
    }
    out.or = orClauses
      .map((item) => validateAccessCondition(item, depth + 1))
      .filter((c): c is AccessConditionData => c !== null);
  }

  return out;
}

function sanitizeConditionValue(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === 'function') {
    throw new BadRequestException('Function values are not allowed in access conditions');
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeConditionValue(v));
  }
  if (typeof value === 'object') {
    throw new BadRequestException('Object values are not allowed in access conditions');
  }
  // Reject obvious raw-SQL injection markers. Values are bound as parameters
  // today; this defense-in-depth check prevents regressions if a future code
  // path ever interpolates a policy directly.
  if (typeof value === 'string' && FORBIDDEN_VALUE_MARKERS.test(value)) {
    throw new BadRequestException('Access condition value contains forbidden characters');
  }
  return value;
}

/**
 * PropertyAclRepository
 *
 * Provides data access for property-level (field-level) access rules.
 * Implements field-level security by filtering rules based on
 * user identity, roles, and groups.
 */
@Injectable()
export class PropertyAclRepository implements PropertyAccessRuleRepository {
  constructor(
    @InjectRepository(PropertyAccessRule)
    private readonly ruleRepo: Repository<PropertyAccessRule>,
    @InjectRepository(PropertyDefinition)
    private readonly propertyRepo: Repository<PropertyDefinition>
  ) {}

  /**
   * Find all access rules for a property
   */
  async findByProperty(
    propertyId: string,
    activeOnly = true
  ): Promise<PropertyAccessRuleData[]> {
    const where: Record<string, unknown> = { propertyId };
    if (activeOnly) {
      where['isActive'] = true;
    }

    const rules = await this.ruleRepo.find({
      where,
      order: { priority: 'ASC' },
    });

    return rules.map(this.mapToData);
  }

  /**
   * Find access rules for properties in a collection applicable to a specific user.
   *
   * Canon §28.2 wildcard support: this query returns BOTH explicit field
   * rules (`property_id = ANY(propertyIds)`) AND wildcard field rules
   * (`wildcard_collection_id = :collectionId`). The DB XOR CHECK
   * constraint guarantees each row is exactly one shape, never both.
   * The evaluator distinguishes them by inspecting `propertyId` vs
   * `wildcardCollectionId` and applies the §28.2 precedence matrix
   * (explicit levels 1-2 fire before wildcard levels 3-4).
   */
  async findByCollectionProperties(
    collectionId: string,
    propertyCodes: string[],
    userId: string,
    roleIds: string[],
    groupIds: string[]
  ): Promise<PropertyAccessRuleData[]> {
    // First, get property IDs from codes. Skipped when there are no
    // property codes — but we still must fetch wildcard rules below,
    // so an empty propertyCodes list is NOT an early-return.
    let propertyIds: string[] = [];
    let propertyCodeMap = new Map<string, string>();
    if (propertyCodes.length > 0) {
      const properties = await this.propertyRepo.find({
        where: {
          collectionId,
          code: propertyCodes.length === 1 ? propertyCodes[0] : undefined,
        },
        select: ['id', 'code', 'collectionId'],
      });

      // Filter by codes if more than one
      const filteredProperties =
        propertyCodes.length === 1
          ? properties
          : properties.filter((p) => propertyCodes.includes(p.code));

      if (filteredProperties.length > 0) {
        propertyIds = filteredProperties.map((p) => p.id);
        propertyCodeMap = new Map(filteredProperties.map((p) => [p.id, p.code]));
      }
    }

    // Postgres `ANY(:propertyIds)` requires a non-empty array — use a
    // sentinel zero-UUID when no property IDs were resolved so the
    // explicit-field disjunct contributes no matches without blowing up
    // the query. The wildcard disjunct still fires.
    const safePropertyIds =
      propertyIds.length > 0 ? propertyIds : ['00000000-0000-0000-0000-000000000000'];

    // Query rules for these properties OR wildcard rules on this collection.
    const queryBuilder = this.ruleRepo
      .createQueryBuilder('rule')
      .where(
        '(rule.property_id = ANY(:propertyIds) OR rule.wildcard_collection_id = :collectionId)',
        { propertyIds: safePropertyIds, collectionId }
      )
      .andWhere('rule.is_active = :isActive', { isActive: true })
      .andWhere(
        '(' +
          'rule.user_id = :userId OR ' +
          'rule.role_id = ANY(:roleIds) OR ' +
          'rule.group_id = ANY(:groupIds) OR ' +
          '(rule.user_id IS NULL AND rule.role_id IS NULL AND rule.group_id IS NULL)' +
          ')',
        {
          userId,
          roleIds: roleIds.length > 0 ? roleIds : ['00000000-0000-0000-0000-000000000000'],
          groupIds: groupIds.length > 0 ? groupIds : ['00000000-0000-0000-0000-000000000000'],
        }
      )
      .orderBy('rule.priority', 'ASC');

    const rules = await queryBuilder.getMany();

    return rules.map((rule) => ({
      ...this.mapToData(rule),
      // propertyCode is only meaningful for explicit-field rules; wildcard
      // rules have propertyId=NULL so the lookup returns undefined, which
      // the evaluator detects to route via wildcardCollectionId instead.
      propertyCode: rule.propertyId ? propertyCodeMap.get(rule.propertyId) : undefined,
      collectionId,
    }));
  }

  /**
   * Find access rules by role
   */
  async findByRole(roleId: string, activeOnly = true): Promise<PropertyAccessRuleData[]> {
    const where: Record<string, unknown> = { roleId };
    if (activeOnly) {
      where['isActive'] = true;
    }

    const rules = await this.ruleRepo.find({
      where,
      order: { priority: 'ASC' },
    });

    return rules.map(this.mapToData);
  }

  /**
   * Find access rules by group
   */
  async findByGroup(groupId: string, activeOnly = true): Promise<PropertyAccessRuleData[]> {
    const where: Record<string, unknown> = { groupId };
    if (activeOnly) {
      where['isActive'] = true;
    }

    const rules = await this.ruleRepo.find({
      where,
      order: { priority: 'ASC' },
    });

    return rules.map(this.mapToData);
  }

  /**
   * Find access rules by user
   */
  async findByUser(userId: string, activeOnly = true): Promise<PropertyAccessRuleData[]> {
    const where: Record<string, unknown> = { userId };
    if (activeOnly) {
      where['isActive'] = true;
    }

    const rules = await this.ruleRepo.find({
      where,
      order: { priority: 'ASC' },
    });

    return rules.map(this.mapToData);
  }

  /**
   * Create a new access rule
   */
  async create(data: Omit<PropertyAccessRuleData, 'id'>): Promise<PropertyAccessRuleData> {
    const validatedConditions = data.conditions
      ? validateAccessCondition(data.conditions)
      : null;
    const rule = this.ruleRepo.create({
      // Canon §28.2 wildcard support: forward either the explicit
      // `propertyId` (levels 1-2) or the `wildcardCollectionId` (levels
      // 3-4). The DB CHECK constraint `CHK_property_access_rules_target_xor`
      // rejects rows where both or neither are set, so the caller is
      // responsible for picking one. We pass both through as-given rather
      // than guessing.
      propertyId: data.propertyId ?? null,
      wildcardCollectionId: data.wildcardCollectionId ?? null,
      roleId: data.roleId ?? null,
      groupId: data.groupId ?? null,
      userId: data.userId ?? null,
      canRead: data.canRead,
      canWrite: data.canWrite,
      conditions: validatedConditions as Record<string, unknown> | null,
      priority: data.priority,
      isActive: data.isActive,
      maskingStrategy: data.maskingStrategy ?? 'NONE',
      // F006: forward the caller's effect choice. The DB CHECK constraint
      // enforces ('allow' | 'deny'); if the caller omits the field we let
      // the column DEFAULT (`allow`) take over rather than guessing.
      effect: data.effect ?? 'allow',
    });

    const saved = await this.ruleRepo.save(rule);
    return this.mapToData(saved);
  }

  /**
   * Update an access rule
   */
  async update(
    id: string,
    data: Partial<Omit<PropertyAccessRuleData, 'id'>>
  ): Promise<PropertyAccessRuleData | null> {
    // Pull `conditions` out of the patch so we can run it through the
    // validator. The remaining fields are passed through unchanged but cast
    // to a TypeORM-friendly partial; we intentionally do not let callers
    // reach the relation columns on the entity.
    const { conditions, ...rest } = data;
    const updatePayload: Record<string, unknown> = { ...rest };
    if (conditions !== undefined) {
      updatePayload['conditions'] = conditions
        ? (validateAccessCondition(conditions) as Record<string, unknown> | null)
        : null;
    }
    await this.ruleRepo.update(id, updatePayload as Parameters<typeof this.ruleRepo.update>[1]);

    const updated = await this.ruleRepo.findOne({ where: { id } });
    return updated ? this.mapToData(updated) : null;
  }

  /**
   * Delete an access rule
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.ruleRepo.delete(id);
    return (result.affected ?? 0) > 0;
  }

  /**
   * Check if user can read a property
   */
  async canRead(
    propertyId: string,
    userId: string,
    roleIds: string[],
    groupIds: string[]
  ): Promise<boolean> {
    const rules = await this.findByPropertyAndUser(propertyId, userId, roleIds, groupIds);

    if (rules.length === 0) {
      // No explicit rules - default allow
      return true;
    }

    // Check if any rule grants read permission
    return rules.some((r) => r.canRead);
  }

  /**
   * Check if user can write a property
   */
  async canWrite(
    propertyId: string,
    userId: string,
    roleIds: string[],
    groupIds: string[]
  ): Promise<boolean> {
    const rules = await this.findByPropertyAndUser(propertyId, userId, roleIds, groupIds);

    if (rules.length === 0) {
      // No explicit rules - default allow
      return true;
    }

    // Check if any rule grants write permission
    return rules.some((r) => r.canWrite);
  }

  /**
   * Get aggregated permissions for a user on a property
   */
  async getAggregatedPermissions(
    propertyId: string,
    userId: string,
    roleIds: string[],
    groupIds: string[]
  ): Promise<{ canRead: boolean; canWrite: boolean; maskingStrategy: MaskingStrategy }> {
    const rules = await this.findByPropertyAndUser(propertyId, userId, roleIds, groupIds);

    if (rules.length === 0) {
      // No explicit rules - default allow with no masking
      return { canRead: true, canWrite: true, maskingStrategy: 'NONE' };
    }

    // Aggregate permissions
    const canRead = rules.some((r) => r.canRead);
    const canWrite = rules.some((r) => r.canWrite);

    // Masking strategy: use the most restrictive one from applicable rules
    let maskingStrategy: MaskingStrategy = 'NONE';
    for (const rule of rules) {
      if (rule.maskingStrategy === 'FULL') {
        maskingStrategy = 'FULL';
        break;
      } else if (rule.maskingStrategy === 'PARTIAL') {
        maskingStrategy = 'PARTIAL';
      }
    }

    return { canRead, canWrite, maskingStrategy };
  }

  /**
   * Get permissions for multiple properties at once
   */
  async getPropertyPermissions(
    collectionId: string,
    propertyCodes: string[],
    userId: string,
    roleIds: string[],
    groupIds: string[]
  ): Promise<
    Map<string, { canRead: boolean; canWrite: boolean; maskingStrategy: MaskingStrategy }>
  > {
    const rules = await this.findByCollectionProperties(
      collectionId,
      propertyCodes,
      userId,
      roleIds,
      groupIds
    );

    // Group rules by property code. Wildcard rules (propertyId IS NULL,
    // canon §28.2 levels 3-4) have no per-property code; they belong to
    // EVERY property of the collection, and the evaluator routes them by
    // `wildcardCollectionId`. This helper is per-property-permission
    // aggregation, so wildcard rules are skipped here — callers that
    // need wildcard semantics consume rules directly via
    // `findByCollectionProperties` and call the evaluator.
    const rulesByProperty = new Map<string, PropertyAccessRuleData[]>();
    for (const rule of rules) {
      const code = rule.propertyCode || rule.propertyId;
      if (!code) {
        continue;
      }
      if (!rulesByProperty.has(code)) {
        rulesByProperty.set(code, []);
      }
      rulesByProperty.get(code)!.push(rule);
    }

    // Calculate permissions for each property
    const result = new Map<
      string,
      { canRead: boolean; canWrite: boolean; maskingStrategy: MaskingStrategy }
    >();

    for (const code of propertyCodes) {
      const propertyRules = rulesByProperty.get(code) || [];

      if (propertyRules.length === 0) {
        // No rules - default allow
        result.set(code, { canRead: true, canWrite: true, maskingStrategy: 'NONE' });
      } else {
        const canRead = propertyRules.some((r) => r.canRead);
        const canWrite = propertyRules.some((r) => r.canWrite);

        let maskingStrategy: MaskingStrategy = 'NONE';
        for (const rule of propertyRules) {
          if (rule.maskingStrategy === 'FULL') {
            maskingStrategy = 'FULL';
            break;
          } else if (rule.maskingStrategy === 'PARTIAL') {
            maskingStrategy = 'PARTIAL';
          }
        }

        result.set(code, { canRead, canWrite, maskingStrategy });
      }
    }

    return result;
  }

  /**
   * Find access rules applicable to a specific user for a property
   */
  private async findByPropertyAndUser(
    propertyId: string,
    userId: string,
    roleIds: string[],
    groupIds: string[]
  ): Promise<PropertyAccessRuleData[]> {
    const queryBuilder = this.ruleRepo
      .createQueryBuilder('rule')
      .where('rule.property_id = :propertyId', { propertyId })
      .andWhere('rule.is_active = :isActive', { isActive: true })
      .andWhere(
        '(' +
          'rule.user_id = :userId OR ' +
          'rule.role_id = ANY(:roleIds) OR ' +
          'rule.group_id = ANY(:groupIds) OR ' +
          '(rule.user_id IS NULL AND rule.role_id IS NULL AND rule.group_id IS NULL)' +
          ')',
        {
          userId,
          roleIds: roleIds.length > 0 ? roleIds : ['00000000-0000-0000-0000-000000000000'],
          groupIds: groupIds.length > 0 ? groupIds : ['00000000-0000-0000-0000-000000000000'],
        }
      )
      .orderBy('rule.priority', 'ASC');

    const rules = await queryBuilder.getMany();
    return rules.map(this.mapToData);
  }

  /**
   * Map entity to data transfer object
   */
  private mapToData(rule: PropertyAccessRule): PropertyAccessRuleData {
    return {
      id: rule.id,
      // Canon §28.2 wildcard support: propertyId is nullable since
      // migration 1930200000000-add-property-access-rule-wildcards.ts.
      // A wildcard rule has propertyId=NULL + wildcardCollectionId set,
      // enforced by the DB XOR CHECK constraint.
      propertyId: rule.propertyId ?? null,
      // Canon §28.2 levels 3-4: wildcard field rules apply to every
      // field of the referenced collection. Defensive ?? null covers
      // the entity-without-field case in unit-test stubs; the DB column
      // is nullable so the default is genuinely NULL for explicit rules.
      wildcardCollectionId: rule.wildcardCollectionId ?? null,
      roleId: rule.roleId,
      groupId: rule.groupId,
      userId: rule.userId,
      canRead: rule.canRead,
      canWrite: rule.canWrite,
      conditions: rule.conditions as AccessConditionData | null,
      priority: rule.priority,
      isActive: rule.isActive,
      // F004: pass through the entity's maskingStrategy column (added by
      // migration 1820000000000-access-policy-metadata.ts). Previously
      // hardcoded to 'NONE', which silently downgraded customer-configured
      // PARTIAL/FULL masking — a HIPAA blocker. Defensive ?? 'NONE' covers
      // the entity-without-field case (only reachable in tests; the DB
      // column is NOT NULL DEFAULT 'NONE').
      maskingStrategy: rule.maskingStrategy ?? 'NONE',
      // F006: pass through the entity's effect column (canon §28.2).
      // Migration 1930100000000-add-rule-effect.ts adds it with DEFAULT
      // 'allow' so legacy rows preserve their semantics; the ?? fallback
      // covers the entity-without-field case in unit tests.
      effect: rule.effect ?? 'allow',
    };
  }
}
