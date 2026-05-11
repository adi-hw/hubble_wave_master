import type { Repository } from 'typeorm';
import type { PropertyAccessRule, PropertyDefinition } from '@hubblewave/instance-db';
import { PropertyAclRepository } from './property-acl.repository';
import type { PropertyAccessRuleData } from './types';

function buildEntity(overrides: Partial<PropertyAccessRule> = {}): PropertyAccessRule {
  return {
    id: 'rule-1',
    propertyId: 'prop-1',
    roleId: null,
    groupId: null,
    userId: null,
    canRead: true,
    canWrite: true,
    maskingStrategy: 'NONE',
    conditions: null,
    priority: 100,
    isActive: true,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ruleKey: null,
    metadata: {},
    // F006: legacy entity rows default to `allow` per migration backfill.
    effect: 'allow',
    ...overrides,
  } as PropertyAccessRule;
}

function newRepo(): PropertyAclRepository {
  const ruleRepo: Partial<Repository<PropertyAccessRule>> = {};
  const propertyRepo: Partial<Repository<PropertyDefinition>> = {};
  return new PropertyAclRepository(
    ruleRepo as Repository<PropertyAccessRule>,
    propertyRepo as Repository<PropertyDefinition>,
  );
}

/**
 * mapToData is private. Tests call it via the `any`-cast escape hatch so we
 * can pin down the entity → DTO contract without spinning up a real TypeORM
 * connection.
 */
function callMapToData(
  repo: PropertyAclRepository,
  entity: PropertyAccessRule,
): PropertyAccessRuleData {
  return (repo as unknown as { mapToData: (e: PropertyAccessRule) => PropertyAccessRuleData })
    .mapToData(entity);
}

describe('PropertyAclRepository — mapToData (F004)', () => {
  // F004: the entity declares masking_strategy (varchar(20) NOT NULL DEFAULT 'NONE')
  // and migration 1820000000000-access-policy-metadata.ts adds the column to the
  // DB. But mapToData previously hardcoded 'NONE', so customer-configured
  // PARTIAL or FULL masking was silently downgraded to NONE — a HIPAA blocker.

  it('preserves maskingStrategy "NONE" from entity to DTO', () => {
    const dto = callMapToData(newRepo(), buildEntity({ maskingStrategy: 'NONE' }));
    expect(dto.maskingStrategy).toBe('NONE');
  });

  it('preserves maskingStrategy "PARTIAL" from entity to DTO (F004)', () => {
    const dto = callMapToData(newRepo(), buildEntity({ maskingStrategy: 'PARTIAL' }));
    expect(dto.maskingStrategy).toBe('PARTIAL');
  });

  it('preserves maskingStrategy "FULL" from entity to DTO (F004)', () => {
    const dto = callMapToData(newRepo(), buildEntity({ maskingStrategy: 'FULL' }));
    expect(dto.maskingStrategy).toBe('FULL');
  });

  it('falls back to "NONE" if the entity value is undefined (defensive)', () => {
    const entity = buildEntity();
    delete (entity as unknown as Record<string, unknown>)['maskingStrategy'];
    const dto = callMapToData(newRepo(), entity);
    expect(dto.maskingStrategy).toBe('NONE');
  });
});

describe('PropertyAclRepository — mapToData effect column (F006)', () => {
  // F006: the entity declares `effect` (varchar(10) NOT NULL DEFAULT 'allow')
  // and migration 1930100000000-add-rule-effect.ts adds the column to the
  // DB. mapToData must pass the value through so canon §28.2 deny rules
  // reach the evaluator unchanged.

  it('passes through effect="allow" (default)', () => {
    const dto = callMapToData(newRepo(), buildEntity({ effect: 'allow' }));
    expect(dto.effect).toBe('allow');
  });

  it('passes through effect="deny" (F006)', () => {
    const dto = callMapToData(newRepo(), buildEntity({ effect: 'deny' }));
    expect(dto.effect).toBe('deny');
  });

  it('falls back to "allow" if the entity value is undefined (defensive)', () => {
    const entity = buildEntity();
    delete (entity as unknown as Record<string, unknown>)['effect'];
    const dto = callMapToData(newRepo(), entity);
    expect(dto.effect).toBe('allow');
  });
});

describe('PropertyAclRepository — mapToData wildcard columns (canon §28.2 levels 3-4)', () => {
  // Migration 1930200000000-add-property-access-rule-wildcards.ts adds two
  // related columns:
  //   - property_id is now nullable (was NOT NULL)
  //   - wildcard_collection_id is the new nullable uuid FK
  // The DB XOR CHECK constraint guarantees exactly one of the two is set.
  // mapToData must pass both through so the evaluator can route on them.

  it('passes through propertyId=null for a wildcard rule', () => {
    const dto = callMapToData(
      newRepo(),
      buildEntity({
        propertyId: null,
        wildcardCollectionId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      }),
    );
    expect(dto.propertyId).toBeNull();
  });

  it('passes through wildcardCollectionId="uuid-x" for a wildcard rule', () => {
    const dto = callMapToData(
      newRepo(),
      buildEntity({
        propertyId: null,
        wildcardCollectionId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      }),
    );
    expect(dto.wildcardCollectionId).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
  });

  it('passes through wildcardCollectionId=null for an explicit field rule (defensive default)', () => {
    const dto = callMapToData(
      newRepo(),
      buildEntity({
        propertyId: 'prop-1',
        // Explicitly leave wildcardCollectionId undefined to exercise the
        // defensive `?? null` fallback in mapToData. The DB column is
        // genuinely nullable, but unit-test entities can omit the field.
      }),
    );
    expect(dto.wildcardCollectionId).toBeNull();
    expect(dto.propertyId).toBe('prop-1');
  });
});
