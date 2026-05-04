import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PropertyDefinition, AuditLog } from '@hubblewave/instance-db';

import { PropertyService } from './property.service';
import { PropertyReferenceScanner, PropertyReferenceReport } from './reference-scanner.service';

interface QueryBuilderStub {
  where: jest.Mock;
  andWhere: jest.Mock;
  leftJoinAndSelect: jest.Mock;
  orderBy: jest.Mock;
  select: jest.Mock;
  getOne: jest.Mock;
  getManyAndCount: jest.Mock;
  getRawOne: jest.Mock;
}

function makeQb(): QueryBuilderStub {
  const qb: QueryBuilderStub = {
    where: jest.fn(),
    andWhere: jest.fn(),
    leftJoinAndSelect: jest.fn(),
    orderBy: jest.fn(),
    select: jest.fn(),
    getOne: jest.fn(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawOne: jest.fn().mockResolvedValue({ maxPosition: 0 }),
  };
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.leftJoinAndSelect.mockReturnValue(qb);
  qb.orderBy.mockReturnValue(qb);
  qb.select.mockReturnValue(qb);
  return qb;
}

const emptyRefs = (): PropertyReferenceReport => ({
  formulas: [],
  views: [],
  automations: [],
  forms: [],
  validationRules: [],
  displayRules: [],
  total: 0,
});

describe('PropertyService', () => {
  let service: PropertyService;
  let propertyRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    find: jest.Mock;
  };
  let auditRepo: { create: jest.Mock; save: jest.Mock };
  let referenceScanner: { findReferences: jest.Mock };
  let qb: QueryBuilderStub;

  beforeEach(async () => {
    qb = makeQb();
    propertyRepo = {
      createQueryBuilder: jest.fn(() => qb),
      findOne: jest.fn(),
      create: jest.fn((data) => ({ id: 'new-prop', ...data })),
      save: jest.fn((data) => Promise.resolve(data)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      find: jest.fn().mockResolvedValue([]),
    };
    auditRepo = {
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve(data)),
    };
    referenceScanner = {
      findReferences: jest.fn().mockResolvedValue(emptyRefs()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertyService,
        { provide: getRepositoryToken(PropertyDefinition), useValue: propertyRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: PropertyReferenceScanner, useValue: referenceScanner },
      ],
    }).compile();

    service = module.get(PropertyService);
  });

  describe('createProperty — column-name collision (W2.C)', () => {
    it('rejects a property whose generated column name collides with an existing active property', async () => {
      // First isCodeAvailable check — code is free.
      // Second assertColumnNameAvailable check — column collides.
      // We use mockImplementation so a single instance covers both expect calls below.
      let call = 0;
      qb.getOne.mockImplementation(() => {
        call++;
        if (call % 2 === 1) return Promise.resolve(null);
        return Promise.resolve({
          id: 'existing-id',
          code: 'verylongprefix_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_one',
        });
      });

      // Two codes that share their first 63 chars after lowercasing → same column.
      const longCode = 'verylongprefix_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_two';

      await expect(
        service.createProperty('col-1', {
          code: longCode,
          propertyTypeId: 'type-1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        service.createProperty('col-1', {
          code: longCode,
          propertyTypeId: 'type-1',
        }),
      ).rejects.toMatchObject({
        message: expect.stringContaining('collides with property "verylongprefix_'),
      });
    });

    it('accepts a property whose column name is unique', async () => {
      qb.getOne.mockResolvedValue(null);

      const created = await service.createProperty('col-1', {
        code: 'short_one',
        propertyTypeId: 'type-1',
      });

      expect(created).toMatchObject({
        code: 'short_one',
        columnName: 'short_one',
        collectionId: 'col-1',
      });
      expect(propertyRepo.save).toHaveBeenCalled();
    });

    it('preserves the existing in-request dedupe behaviour for bulk create', async () => {
      qb.getOne.mockResolvedValue(null);
      propertyRepo.find.mockResolvedValue([]);

      const longCode1 = 'sharedprefix_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_one';
      const longCode2 = 'sharedprefix_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_two';

      const result = await service.bulkCreateProperties(
        'col-1',
        [
          { code: longCode1, propertyTypeId: 'type-1' },
          { code: longCode2, propertyTypeId: 'type-1' },
        ],
        undefined,
        false,
      );

      expect(result.created).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toContain('collides with property');
    });
  });

  describe('updateProperty — column-name collision', () => {
    it('rejects when an explicit columnName change would collide with another active property', async () => {
      const existing: Partial<PropertyDefinition> = {
        id: 'prop-1',
        collectionId: 'col-1',
        code: 'mycode',
        columnName: 'mycode',
        isSystem: false,
        metadata: { status: 'draft' },
      };
      propertyRepo.findOne.mockResolvedValueOnce(existing);
      qb.getOne.mockResolvedValueOnce({ id: 'other', code: 'collider' });

      await expect(
        service.updateProperty('prop-1', { columnName: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('deleteProperty — reference checking (W2.A)', () => {
    const baseProperty: Partial<PropertyDefinition> = {
      id: 'prop-1',
      collectionId: 'col-1',
      code: 'priority',
      columnName: 'priority',
      isSystem: false,
      isActive: true,
      metadata: {},
    };

    it('blocks delete when property is referenced', async () => {
      propertyRepo.findOne.mockResolvedValueOnce(baseProperty);
      referenceScanner.findReferences.mockResolvedValueOnce({
        ...emptyRefs(),
        formulas: [
          { propertyCode: 'urgency', collectionCode: 'incidents', expression: 'priority * 10' },
        ],
        total: 1,
      });

      await expect(service.deleteProperty('prop-1')).rejects.toMatchObject({
        response: expect.objectContaining({ kind: 'in-use' }),
      });
      expect(propertyRepo.update).not.toHaveBeenCalled();
      expect(propertyRepo.delete).not.toHaveBeenCalled();
    });

    it('force-delete proceeds despite references', async () => {
      propertyRepo.findOne.mockResolvedValueOnce(baseProperty);
      referenceScanner.findReferences.mockResolvedValue({
        ...emptyRefs(),
        formulas: [
          { propertyCode: 'urgency', collectionCode: 'incidents', expression: 'priority * 10' },
        ],
        total: 1,
      });

      const result = await service.deleteProperty('prop-1', true);
      expect(result).toEqual({ id: 'prop-1', deleted: true });
      expect(propertyRepo.delete).toHaveBeenCalledWith('prop-1');
      // Scanner should NOT have been consulted for force-delete.
      expect(referenceScanner.findReferences).not.toHaveBeenCalled();
    });

    it('delete succeeds when no references exist', async () => {
      propertyRepo.findOne.mockResolvedValueOnce(baseProperty);
      referenceScanner.findReferences.mockResolvedValueOnce(emptyRefs());

      const result = await service.deleteProperty('prop-1');
      expect(result).toEqual({ id: 'prop-1', deleted: true });
      expect(propertyRepo.update).toHaveBeenCalledWith('prop-1', { isActive: false });
    });
  });

  describe('findReferences — controller backing', () => {
    it('delegates to the scanner with the resolved property', async () => {
      const property: Partial<PropertyDefinition> = {
        id: 'prop-9',
        collectionId: 'col-1',
        code: 'status',
        columnName: 'status',
        metadata: {},
      };
      propertyRepo.findOne.mockResolvedValueOnce(property);
      const expected = {
        ...emptyRefs(),
        views: [{ viewCode: 'v1', viewName: 'View 1' }],
        total: 1,
      };
      referenceScanner.findReferences.mockResolvedValueOnce(expected);

      const result = await service.findReferences('prop-9');
      expect(result).toBe(expected);
      expect(referenceScanner.findReferences).toHaveBeenCalledWith(property);
    });
  });
});
