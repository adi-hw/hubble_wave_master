import type { Repository } from 'typeorm';
import type { CollectionAccessRule } from '@hubblewave/instance-db';
import { CollectionAclRepository } from './collection-acl.repository';
import type { CollectionAccessRuleData } from './types';

function buildEntity(overrides: Partial<CollectionAccessRule> = {}): CollectionAccessRule {
  return {
    id: 'rule-1',
    collectionId: 'coll-1',
    name: 'viewer-read',
    description: null,
    ruleKey: null,
    metadata: {},
    roleId: null,
    groupId: null,
    userId: null,
    canRead: true,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    conditions: null,
    priority: 100,
    isActive: true,
    // F006: legacy entity rows default to `allow` per migration backfill.
    effect: 'allow',
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CollectionAccessRule;
}

function newRepo(): CollectionAclRepository {
  const ruleRepo: Partial<Repository<CollectionAccessRule>> = {};
  return new CollectionAclRepository(ruleRepo as Repository<CollectionAccessRule>);
}

/**
 * mapToData is private. Tests call it via the `any`-cast escape hatch so we
 * can pin down the entity → DTO contract without spinning up a real TypeORM
 * connection. Mirrors the pattern from property-acl.repository.spec.ts.
 */
function callMapToData(
  repo: CollectionAclRepository,
  entity: CollectionAccessRule,
): CollectionAccessRuleData {
  return (repo as unknown as { mapToData: (e: CollectionAccessRule) => CollectionAccessRuleData })
    .mapToData(entity);
}

describe('CollectionAclRepository — mapToData effect column (F006)', () => {
  // F006: the entity declares `effect` (varchar(10) NOT NULL DEFAULT 'allow')
  // and migration 1930100000000-add-rule-effect.ts adds the column to the
  // DB. mapToData must pass the value through so canon §28.3 deny rules
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

  it('preserves the existing canRead/canCreate/canUpdate/canDelete shape (no regression)', () => {
    const dto = callMapToData(
      newRepo(),
      buildEntity({
        canRead: true,
        canCreate: true,
        canUpdate: false,
        canDelete: false,
      }),
    );
    expect(dto.canRead).toBe(true);
    expect(dto.canCreate).toBe(true);
    expect(dto.canUpdate).toBe(false);
    expect(dto.canDelete).toBe(false);
  });
});
