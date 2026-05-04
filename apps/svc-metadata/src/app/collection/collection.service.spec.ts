import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CollectionDefinition, PropertyDefinition, PropertyType } from '@hubblewave/instance-db';

import { CollectionService } from './collection.service';
import { CollectionStorageService } from './collection-storage.service';
import { CollectionAvaService } from './collection-ava.service';

describe('CollectionService.createCollection (W1.4 atomicity)', () => {
  let service: CollectionService;
  let storageService: { createStorageTable: jest.Mock };
  let queryRunner: {
    query: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: { create: jest.Mock; save: jest.Mock; find: jest.Mock };
  };
  let collectionRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    queryRunner = {
      query: jest.fn().mockResolvedValue(undefined),
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
        find: jest.fn().mockResolvedValue([]),
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

    const propertyRepo = { find: jest.fn(), createQueryBuilder: jest.fn() };
    const propertyTypeRepo = { find: jest.fn() };
    const avaService = {
      getNamingSuggestions: jest.fn(),
      analyzeImportStructure: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionService,
        { provide: getRepositoryToken(CollectionDefinition), useValue: collectionRepo },
        { provide: getRepositoryToken(PropertyDefinition), useValue: propertyRepo },
        { provide: getRepositoryToken(PropertyType), useValue: propertyTypeRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: CollectionStorageService, useValue: storageService },
        { provide: CollectionAvaService, useValue: avaService },
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
