import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  PropertyDefinition,
  ViewDefinitionRevision,
  AutomationRule,
  ClientScript,
  FormDefinition,
} from '@hubblewave/instance-db';

import { PropertyReferenceScanner } from './reference-scanner.service';

interface QueryBuilderStub {
  leftJoin: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  select: jest.Mock;
  addSelect: jest.Mock;
  getMany: jest.Mock;
  getRawMany: jest.Mock;
}

function makeQueryBuilder(): QueryBuilderStub {
  const qb: QueryBuilderStub = {
    leftJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    select: jest.fn(),
    addSelect: jest.fn(),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  qb.leftJoin.mockReturnValue(qb);
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);
  qb.select.mockReturnValue(qb);
  qb.addSelect.mockReturnValue(qb);
  return qb;
}

describe('PropertyReferenceScanner', () => {
  let scanner: PropertyReferenceScanner;
  let propertyQb: QueryBuilderStub;
  let viewQb: QueryBuilderStub;
  let automationQb: QueryBuilderStub;
  let formQb: QueryBuilderStub;
  let clientScriptQb: QueryBuilderStub;
  let propertyValidationQb: QueryBuilderStub;

  const target: PropertyDefinition = {
    id: 'prop-target',
    collectionId: 'col-1',
    code: 'priority',
    columnName: 'priority',
  } as PropertyDefinition;

  beforeEach(async () => {
    propertyQb = makeQueryBuilder();
    viewQb = makeQueryBuilder();
    automationQb = makeQueryBuilder();
    formQb = makeQueryBuilder();
    clientScriptQb = makeQueryBuilder();
    propertyValidationQb = makeQueryBuilder();

    let propertyCallCount = 0;
    const propertyRepo = {
      createQueryBuilder: jest.fn(() => {
        propertyCallCount++;
        // First call: formula scan. Second call: validation rule scan.
        return propertyCallCount === 1 ? propertyQb : propertyValidationQb;
      }),
    };

    const viewRevisionRepo = {
      createQueryBuilder: jest.fn(() => viewQb),
    };

    const automationRepo = {
      createQueryBuilder: jest.fn(() => automationQb),
    };

    const clientScriptRepo = {
      createQueryBuilder: jest.fn(() => clientScriptQb),
    };

    const formRepo = {
      createQueryBuilder: jest.fn(() => formQb),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertyReferenceScanner,
        { provide: getRepositoryToken(PropertyDefinition), useValue: propertyRepo },
        { provide: getRepositoryToken(ViewDefinitionRevision), useValue: viewRevisionRepo },
        { provide: getRepositoryToken(AutomationRule), useValue: automationRepo },
        { provide: getRepositoryToken(ClientScript), useValue: clientScriptRepo },
        { provide: getRepositoryToken(FormDefinition), useValue: formRepo },
      ],
    }).compile();

    scanner = module.get(PropertyReferenceScanner);
  });

  it('finds formula references via expression text', async () => {
    propertyQb.getRawMany.mockResolvedValueOnce([
      {
        p_code: 'urgency_score',
        p_config: { formula: 'priority * 10' },
        collectionCode: 'incidents',
      },
    ]);

    const refs = await scanner.findReferences(target);

    expect(refs.formulas).toHaveLength(1);
    expect(refs.formulas[0]).toEqual({
      propertyCode: 'urgency_score',
      collectionCode: 'incidents',
      expression: 'priority * 10',
    });
    expect(refs.total).toBe(1);
  });

  it('does not match a substring of another property name', async () => {
    propertyQb.getRawMany.mockResolvedValueOnce([
      {
        p_code: 'foo',
        p_config: { formula: 'highpriority + 1' },
        collectionCode: 'incidents',
      },
    ]);

    const refs = await scanner.findReferences(target);
    expect(refs.formulas).toHaveLength(0);
  });

  it('finds view references via display config', async () => {
    viewQb.getRawMany.mockResolvedValueOnce([
      {
        rev_layout: { columns: [{ propertyCode: 'priority' }] },
        rev_widget_bindings: {},
        rev_actions: {},
        viewCode: 'incidents-grid',
        viewName: 'Incidents Grid',
      },
    ]);

    const refs = await scanner.findReferences(target);
    expect(refs.views).toEqual([
      { viewCode: 'incidents-grid', viewName: 'Incidents Grid' },
    ]);
    expect(refs.total).toBe(1);
  });

  it('finds automation references via condition', async () => {
    automationQb.getMany.mockResolvedValueOnce([
      {
        id: 'auto-1',
        name: 'Escalate high priority',
        condition: { field: 'priority', op: 'gt', value: 5 },
        actions: null,
        watchProperties: null,
      },
    ]);

    const refs = await scanner.findReferences(target);
    expect(refs.automations).toEqual([
      { automationCode: 'auto-1', automationName: 'Escalate high priority', matchedIn: 'condition' },
    ]);
    expect(refs.total).toBe(1);
  });

  it('finds form references via layout JSONB', async () => {
    formQb.getMany.mockResolvedValueOnce([
      {
        id: 'form-1',
        name: 'Incident form',
        layout: { sections: [{ fields: [{ propertyCode: 'priority' }] }] },
      },
    ]);

    const refs = await scanner.findReferences(target);
    expect(refs.forms).toEqual([
      { formCode: 'form-1', formName: 'Incident form' },
    ]);
  });

  it('finds display rule references via watch property', async () => {
    clientScriptQb.getMany.mockResolvedValueOnce([
      {
        id: 'cs-1',
        watchProperty: 'priority',
        actions: [],
        condition: null,
      },
    ]);

    const refs = await scanner.findReferences(target);
    expect(refs.displayRules).toEqual([{ ruleCode: 'cs-1' }]);
  });

  it('finds validation rule references on a sibling property', async () => {
    propertyValidationQb.getMany.mockResolvedValueOnce([
      {
        code: 'sla_breach_at',
        validationRules: { mustBeAfter: 'priority' },
      },
    ]);

    const refs = await scanner.findReferences(target);
    expect(refs.validationRules).toHaveLength(1);
    expect(refs.validationRules[0].ruleCode).toBe('sla_breach_at');
  });

  it('returns zero references for an unused property', async () => {
    const refs = await scanner.findReferences(target);
    expect(refs.total).toBe(0);
    expect(refs.formulas).toEqual([]);
    expect(refs.views).toEqual([]);
    expect(refs.automations).toEqual([]);
    expect(refs.forms).toEqual([]);
    expect(refs.validationRules).toEqual([]);
    expect(refs.displayRules).toEqual([]);
  });

  it('total reflects sum of all categories', async () => {
    propertyQb.getRawMany.mockResolvedValueOnce([
      {
        p_code: 'urgency_score',
        p_config: { formula: 'priority * 10' },
        collectionCode: 'incidents',
      },
    ]);
    viewQb.getRawMany.mockResolvedValueOnce([
      {
        rev_layout: { columns: [{ propertyCode: 'priority' }] },
        rev_widget_bindings: {},
        rev_actions: {},
        viewCode: 'incidents-grid',
        viewName: 'Incidents Grid',
      },
    ]);
    automationQb.getMany.mockResolvedValueOnce([
      {
        id: 'auto-1',
        name: 'Escalate',
        condition: { field: 'priority' },
        actions: null,
        watchProperties: null,
      },
    ]);
    formQb.getMany.mockResolvedValueOnce([
      {
        id: 'form-1',
        name: 'Incident form',
        layout: { sections: [{ fields: [{ propertyCode: 'priority' }] }] },
      },
    ]);
    clientScriptQb.getMany.mockResolvedValueOnce([
      { id: 'cs-1', watchProperty: 'priority', actions: [], condition: null },
    ]);
    propertyValidationQb.getMany.mockResolvedValueOnce([
      { code: 'sla', validationRules: { mustBeAfter: 'priority' } },
    ]);

    const refs = await scanner.findReferences(target);

    expect(refs.total).toBe(
      refs.formulas.length +
        refs.views.length +
        refs.automations.length +
        refs.forms.length +
        refs.validationRules.length +
        refs.displayRules.length,
    );
    expect(refs.total).toBe(6);
  });
});
