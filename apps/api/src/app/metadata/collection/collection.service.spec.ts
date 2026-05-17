import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  CollectionDefinition,
  CollectionDefinitionRevision,
  PropertyDefinition,
  PropertyType,
} from '@hubblewave/instance-db';

import { CollectionService } from './collection.service';
import { CollectionStorageService } from './collection-storage.service';
import { CollectionAvaService } from './collection-ava.service';
import { PublishImpactService } from '../publish-impact/publish-impact.service';
import { DependentReviewQueueService } from '../publish-impact/dependent-review-queue.service';

describe('CollectionService.createCollection (W1.4 atomicity)', () => {
  let service: CollectionService;
  let storageService: { createStorageTable: jest.Mock };
  let queryRunner: {
    query: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      create: jest.Mock;
      save: jest.Mock;
      find: jest.Mock;
      createQueryBuilder: jest.Mock;
    };
  };
  let collectionRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    queryRunner = {
      // resolveApplicationId reads the applications table; the seeded
      // 'default' Application row is non-null so createCollection can
      // proceed through resolveApplicationId. Other queries (the
      // pg_advisory_xact_lock call) take no result.
      query: jest.fn(async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('FROM applications')) {
          return [{ id: 'app-default' }];
        }
        return undefined;
      }),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        create: jest.fn((_entity: unknown, payload: Record<string, unknown>) => ({
          id: 'collection-1',
          ...payload,
        })),
        save: jest.fn((_entity: unknown, payload: Record<string, unknown>) => Promise.resolve(payload)),
        // createDefaultProperties looks up PropertyType rows by code; return
        // a stub for each system code so the happy path completes.
        find: jest.fn(async (entity: unknown) => {
          if (entity === PropertyType) {
            return [
              { id: 'pt-uuid', code: 'uuid' },
              { id: 'pt-datetime', code: 'datetime' },
              { id: 'pt-user', code: 'user' },
            ];
          }
          return [];
        }),
        // nextCollectionRevisionNumber issues a query through createQueryBuilder.
        createQueryBuilder: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getRawOne: jest.fn().mockResolvedValue({ max: 0 }),
        })),
      },
    };

    const dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    };

    storageService = {
      createStorageTable: jest.fn().mockResolvedValue(undefined),
    };

    collectionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const collectionRevisionRepo = { findOne: jest.fn(), find: jest.fn() };
    const propertyRepo = { find: jest.fn(), createQueryBuilder: jest.fn() };
    const propertyTypeRepo = { find: jest.fn() };
    const avaService = {
      getNamingSuggestions: jest.fn(),
      analyzeImportStructure: jest.fn(),
    };
    // PublishImpactService and DependentReviewQueueService are dependencies of
    // the SUT but createCollection does not invoke them; minimal stubs satisfy
    // Nest's DI graph.
    const publishImpactService = {};
    const dependentQueueService = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionService,
        { provide: getRepositoryToken(CollectionDefinition), useValue: collectionRepo },
        {
          provide: getRepositoryToken(CollectionDefinitionRevision),
          useValue: collectionRevisionRepo,
        },
        { provide: getRepositoryToken(PropertyDefinition), useValue: propertyRepo },
        { provide: getRepositoryToken(PropertyType), useValue: propertyTypeRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: CollectionStorageService, useValue: storageService },
        { provide: CollectionAvaService, useValue: avaService },
        { provide: PublishImpactService, useValue: publishImpactService },
        { provide: DependentReviewQueueService, useValue: dependentQueueService },
      ],
    }).compile();

    service = module.get<CollectionService>(CollectionService);
  });

  it('rolls back the metadata transaction when storage creation fails', async () => {
    const ddlError = new Error('relation "u_widget" already exists');
    storageService.createStorageTable.mockRejectedValueOnce(ddlError);

    await expect(
      service.createCollection({
        code: 'widget',
        label: 'Widget',
        storageTable: 'u_widget',
      }),
    ).rejects.toThrow('relation "u_widget" already exists');

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();

    const collectionSaves = queryRunner.manager.save.mock.calls.filter(
      ([entity]) => entity === CollectionDefinition,
    );
    expect(collectionSaves).toHaveLength(0);

    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('creates collection and storage atomically on the happy path', async () => {
    const result = await service.createCollection({
      code: 'widget',
      label: 'Widget',
      storageTable: 'u_widget',
    });

    expect(storageService.createStorageTable).toHaveBeenCalledWith(
      queryRunner,
      'public',
      'u_widget',
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(result.storageCreated).toBe(true);
    expect(result.collection).toBeDefined();
  });

  it('sets secureFieldsByDefault: true on new collections (canon §28.2 / W2 Stream 2 PR4)', async () => {
    // New collections default to canon §28.2 level-7 default-deny: a field
    // with no matching rule resolves to canRead=false / canWrite=false /
    // mask='FULL'. Customers explicitly opt-out per-collection (entity
    // field flips to false) when they need the legacy default-allow
    // posture.
    await service.createCollection({
      code: 'widget',
      label: 'Widget',
      storageTable: 'u_widget',
    });

    // The first `manager.create` call is for CollectionDefinition; subsequent
    // calls are revisions + properties. Find the CollectionDefinition payload.
    const createCalls = queryRunner.manager.create.mock.calls;
    const collectionPayload = createCalls.find(
      (call: unknown[]) => call[0] === CollectionDefinition,
    )?.[1] as Record<string, unknown> | undefined;
    expect(collectionPayload).toBeDefined();
    expect(collectionPayload?.['secureFieldsByDefault']).toBe(true);
  });

  it('takes a transaction-scoped advisory lock keyed by collection code before DDL', async () => {
    await service.createCollection({
      code: 'widget',
      label: 'Widget',
      storageTable: 'u_widget',
    });

    const lockCalls = queryRunner.query.mock.calls.filter(([sql]) =>
      typeof sql === 'string' && sql.includes('pg_advisory_xact_lock'),
    );
    expect(lockCalls).toHaveLength(1);
    expect(lockCalls[0][1]).toEqual(['collection-schema:widget']);

    const lockInvocationOrder = queryRunner.query.mock.invocationCallOrder[
      queryRunner.query.mock.calls.findIndex(([sql]) =>
        typeof sql === 'string' && sql.includes('pg_advisory_xact_lock'),
      )
    ];
    const storageInvocationOrder =
      storageService.createStorageTable.mock.invocationCallOrder[0];
    expect(lockInvocationOrder).toBeLessThan(storageInvocationOrder);
  });

  it('skips storage creation and the advisory lock when createStorage is false', async () => {
    const result = await service.createCollection({
      code: 'widget',
      label: 'Widget',
      storageTable: 'u_widget',
      createStorage: false,
    });

    expect(storageService.createStorageTable).not.toHaveBeenCalled();
    const lockCalls = queryRunner.query.mock.calls.filter(([sql]) =>
      typeof sql === 'string' && sql.includes('pg_advisory_xact_lock'),
    );
    expect(lockCalls).toHaveLength(0);
    expect(result.storageCreated).toBe(false);
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
  });
});
