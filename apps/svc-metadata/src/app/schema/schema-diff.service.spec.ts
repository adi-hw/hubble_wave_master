import { Repository, DataSource } from 'typeorm';
import {
  CollectionDefinition,
  PropertyDefinition,
  PropertyType,
} from '@hubblewave/instance-db';
import { SchemaDiffService } from './schema-diff.service';
import type { CollectionStorageService } from '../../../../api/src/app/metadata/collection/collection-storage.service';

/**
 * Construct a SchemaDiffService with stubbed repos. Only the
 * collection.find and property-revision createQueryBuilder paths
 * matter for inheritance chain tests; the buildPlan loop's storage
 * inspection is exercised separately via the storage service mock.
 */
const makeService = (
  collections: Partial<CollectionDefinition>[],
  publishedProperties: Partial<PropertyDefinition>[],
): SchemaDiffService => {
  const collectionRepo = {
    find: jest.fn().mockResolvedValue(collections as CollectionDefinition[]),
    createQueryBuilder: jest.fn(),
  } as unknown as Repository<CollectionDefinition>;

  // loadPublishedProperties calls a query builder. Stub the chain to
  // return any property whose collection_id is in the requested set.
  const propertyRepo = {
    createQueryBuilder: jest.fn().mockImplementation(() => {
      let collectionIds: string[] = [];
      const qb = {
        where: jest.fn().mockImplementation((_clause: string, params: { collectionIds: string[] }) => {
          collectionIds = params.collectionIds ?? [];
          return qb;
        }),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockImplementation(async () =>
          publishedProperties.filter((p) => collectionIds.includes(p.collectionId as string)),
        ),
      };
      return qb;
    }),
  } as unknown as Repository<PropertyDefinition>;

  const propertyTypeRepo = {} as unknown as Repository<PropertyType>;
  const dataSource = {} as unknown as DataSource;
  const storage = {} as unknown as CollectionStorageService;
  return new SchemaDiffService(
    collectionRepo,
    propertyRepo,
    propertyTypeRepo,
    dataSource,
    storage,
  );
};

const propertyOf = (
  collectionId: string,
  code: string,
  columnName?: string,
): Partial<PropertyDefinition> => ({
  id: `prop-${collectionId}-${code}`,
  collectionId,
  code,
  columnName: columnName ?? code,
});

const accessPrivate = (svc: SchemaDiffService) =>
  svc as unknown as {
    loadEffectivePropertiesByCollection: (
      collections: CollectionDefinition[],
    ) => Promise<Map<string, PropertyDefinition[]>>;
  };

describe('SchemaDiffService.loadEffectivePropertiesByCollection', () => {
  it('returns own properties for a collection with no parent', async () => {
    const collections = [{ id: 'col-a', code: 'a' }];
    const properties = [propertyOf('col-a', 'name'), propertyOf('col-a', 'priority')];
    const service = makeService(collections, properties);

    const result = await accessPrivate(service).loadEffectivePropertiesByCollection(
      collections as CollectionDefinition[],
    );

    expect(result.get('col-a')?.map((p) => p.code).sort()).toEqual(['name', 'priority']);
  });

  it('inherits parent properties into child (one level)', async () => {
    const parent = { id: 'col-parent', code: 'parent' };
    const child = { id: 'col-child', code: 'child', extendsCollectionId: 'col-parent' };
    const properties = [
      propertyOf('col-parent', 'name'),
      propertyOf('col-parent', 'priority'),
      propertyOf('col-child', 'severity'),
    ];
    const service = makeService([parent, child], properties);

    const result = await accessPrivate(service).loadEffectivePropertiesByCollection([
      child,
    ] as CollectionDefinition[]);

    const childProps = result.get('col-child')?.map((p) => p.code).sort();
    expect(childProps).toEqual(['name', 'priority', 'severity']);
  });

  it('walks two-level chain and accumulates ancestor properties', async () => {
    const grandparent = { id: 'col-gp', code: 'gp' };
    const parent = { id: 'col-p', code: 'p', extendsCollectionId: 'col-gp' };
    const child = { id: 'col-c', code: 'c', extendsCollectionId: 'col-p' };
    const properties = [
      propertyOf('col-gp', 'gp_field'),
      propertyOf('col-p', 'p_field'),
      propertyOf('col-c', 'c_field'),
    ];
    const service = makeService([grandparent, parent, child], properties);

    const result = await accessPrivate(service).loadEffectivePropertiesByCollection([
      child,
    ] as CollectionDefinition[]);

    expect(result.get('col-c')?.map((p) => p.code).sort()).toEqual([
      'c_field',
      'gp_field',
      'p_field',
    ]);
  });

  it("dedupes by columnName so a child override masks the parent's column", async () => {
    const parent = { id: 'col-parent', code: 'parent' };
    const child = { id: 'col-child', code: 'child', extendsCollectionId: 'col-parent' };
    const properties = [
      // Parent has `priority` with a default column name
      propertyOf('col-parent', 'priority', 'priority'),
      // Child overrides `priority` — same column name; expect the child's row to win
      { ...propertyOf('col-child', 'priority', 'priority'), id: 'prop-child-priority' },
    ];
    const service = makeService([parent, child], properties);

    const result = await accessPrivate(service).loadEffectivePropertiesByCollection([
      child,
    ] as CollectionDefinition[]);

    const childRows = result.get('col-child') ?? [];
    expect(childRows).toHaveLength(1);
    // The dedupe walks the chain own-first, so the child's row keeps the slot.
    expect(childRows[0].id).toBe('prop-child-priority');
  });

  it('terminates on a corrupted self-referential parent without infinite loop', async () => {
    const broken = { id: 'col-broken', code: 'broken', extendsCollectionId: 'col-broken' };
    const properties = [propertyOf('col-broken', 'a')];
    const service = makeService([broken], properties);

    const result = await accessPrivate(service).loadEffectivePropertiesByCollection([
      broken,
    ] as CollectionDefinition[]);

    expect(result.get('col-broken')?.map((p) => p.code)).toEqual(['a']);
  });

  it('returns empty list for a collection with no properties anywhere in the chain', async () => {
    const parent = { id: 'col-parent', code: 'parent' };
    const child = { id: 'col-child', code: 'child', extendsCollectionId: 'col-parent' };
    const service = makeService([parent, child], []);

    const result = await accessPrivate(service).loadEffectivePropertiesByCollection([
      child,
    ] as CollectionDefinition[]);

    expect(result.get('col-child')).toEqual([]);
  });

  it('handles parent reference to a missing collection gracefully', async () => {
    // Parent id points at a collection that doesn't exist — the chain walk
    // should stop after the child without throwing.
    const orphan = {
      id: 'col-orphan',
      code: 'orphan',
      extendsCollectionId: 'col-missing',
    };
    const properties = [propertyOf('col-orphan', 'own_field')];
    const service = makeService([orphan], properties);

    const result = await accessPrivate(service).loadEffectivePropertiesByCollection([
      orphan,
    ] as CollectionDefinition[]);

    expect(result.get('col-orphan')?.map((p) => p.code)).toEqual(['own_field']);
  });

  it('produces independent maps per requested collection', async () => {
    const parent = { id: 'col-parent', code: 'parent' };
    const child1 = { id: 'col-child1', code: 'c1', extendsCollectionId: 'col-parent' };
    const child2 = { id: 'col-child2', code: 'c2', extendsCollectionId: 'col-parent' };
    const properties = [
      propertyOf('col-parent', 'shared'),
      propertyOf('col-child1', 'c1_only'),
      propertyOf('col-child2', 'c2_only'),
    ];
    const service = makeService([parent, child1, child2], properties);

    const result = await accessPrivate(service).loadEffectivePropertiesByCollection([
      child1,
      child2,
    ] as CollectionDefinition[]);

    expect(result.get('col-child1')?.map((p) => p.code).sort()).toEqual(['c1_only', 'shared']);
    expect(result.get('col-child2')?.map((p) => p.code).sort()).toEqual(['c2_only', 'shared']);
  });
});
