import { BadRequestException } from '@nestjs/common';
import { DecisionTableService } from './decision-table.service';
import type {
  DecisionInput,
  DecisionRow,
  DecisionRowCondition,
  DecisionTable,
} from '@hubblewave/instance-db';

interface FixtureInput {
  id: string;
  name: string;
  defaultValue?: unknown;
}

interface FixtureRow {
  id: string;
  position: number;
  isActive: boolean;
  conditions: DecisionRowCondition[];
  answerLiteral?: unknown;
  answerRecordId?: string | null;
}

interface BuildOpts {
  hitPolicy?: 'first_match' | 'all_matches';
  status?: 'draft' | 'published' | 'deprecated';
  inputs: FixtureInput[];
  rows: FixtureRow[];
  answerCollectionCode?: string | null;
}

const buildTable = (opts: BuildOpts): DecisionTable => {
  const inputs = opts.inputs.map<DecisionInput>((i) => ({
    id: i.id,
    tableId: 'table-1',
    name: i.name,
    inputType: 'string',
    config: null,
    defaultValue: i.defaultValue ?? null,
    position: 0,
  }) as unknown as DecisionInput);
  const rows = opts.rows.map<DecisionRow>((r) => ({
    id: r.id,
    tableId: 'table-1',
    position: r.position,
    isActive: r.isActive,
    conditions: r.conditions,
    answerLiteral: r.answerLiteral ?? null,
    answerRecordId: r.answerRecordId ?? null,
    description: null,
  }) as unknown as DecisionRow);
  return {
    id: 'table-1',
    code: 'test-table',
    name: 'Test',
    collectionId: 'col-1',
    answerCollectionCode: opts.answerCollectionCode ?? null,
    hitPolicy: opts.hitPolicy ?? 'first_match',
    status: opts.status ?? 'published',
    isActive: true,
    inputs,
    rows,
  } as unknown as DecisionTable;
};

const buildService = (table: DecisionTable): DecisionTableService => {
  const tableRepo = {
    findOne: jest.fn().mockResolvedValue(table),
  };
  const rowRepo = {};
  const inputRepo = {};
  const collectionRepo = {};
  const dataSource = {};
  return new DecisionTableService(
    tableRepo as never,
    inputRepo as never,
    rowRepo as never,
    collectionRepo as never,
    dataSource as never,
  );
};

describe('DecisionTableService.evaluate', () => {
  it('returns matched=false when no row matches', async () => {
    const table = buildTable({
      inputs: [{ id: 'i1', name: 'tier' }],
      rows: [
        {
          id: 'r1',
          position: 0,
          isActive: true,
          conditions: [{ inputId: 'i1', operator: 'equals', value: 'gold' }],
          answerLiteral: 'A',
        },
      ],
    });
    const svc = buildService(table);
    const result = await svc.evaluate('table-1', { inputs: { tier: 'silver' } });
    expect(result.matched).toBe(false);
  });

  it('returns the first matching row under first_match policy', async () => {
    const table = buildTable({
      hitPolicy: 'first_match',
      inputs: [{ id: 'i1', name: 'tier' }],
      rows: [
        {
          id: 'r1',
          position: 0,
          isActive: true,
          conditions: [{ inputId: 'i1', operator: 'equals', value: 'gold' }],
          answerLiteral: 'A',
        },
        {
          id: 'r2',
          position: 1,
          isActive: true,
          conditions: [{ inputId: 'i1', operator: 'equals', value: 'gold' }],
          answerLiteral: 'B',
        },
      ],
    });
    const svc = buildService(table);
    const result = await svc.evaluate('table-1', { inputs: { tier: 'gold' } });
    expect(result).toMatchObject({
      matched: true,
      rowId: 'r1',
      answer: 'A',
    });
    expect(result.matches).toBeUndefined();
  });

  it('returns every matching row under all_matches policy', async () => {
    const table = buildTable({
      hitPolicy: 'all_matches',
      inputs: [{ id: 'i1', name: 'tier' }],
      rows: [
        {
          id: 'r1',
          position: 0,
          isActive: true,
          conditions: [{ inputId: 'i1', operator: 'equals', value: 'gold' }],
          answerLiteral: 'A',
        },
        {
          id: 'r2',
          position: 1,
          isActive: true,
          conditions: [{ inputId: 'i1', operator: 'equals', value: 'gold' }],
          answerLiteral: 'B',
        },
      ],
    });
    const svc = buildService(table);
    const result = await svc.evaluate('table-1', { inputs: { tier: 'gold' } });
    expect(result.matched).toBe(true);
    expect(result.matches).toHaveLength(2);
    expect(result.answer).toEqual(['A', 'B']);
  });

  it('skips inactive rows during evaluation', async () => {
    const table = buildTable({
      hitPolicy: 'first_match',
      inputs: [{ id: 'i1', name: 'tier' }],
      rows: [
        {
          id: 'r1',
          position: 0,
          isActive: false,
          conditions: [{ inputId: 'i1', operator: 'equals', value: 'gold' }],
          answerLiteral: 'A',
        },
        {
          id: 'r2',
          position: 1,
          isActive: true,
          conditions: [{ inputId: 'i1', operator: 'equals', value: 'gold' }],
          answerLiteral: 'B',
        },
      ],
    });
    const svc = buildService(table);
    const result = await svc.evaluate('table-1', { inputs: { tier: 'gold' } });
    expect(result.rowId).toBe('r2');
    expect(result.answer).toBe('B');
  });

  it('AND-combines multi-condition rows', async () => {
    const table = buildTable({
      inputs: [
        { id: 'i1', name: 'tier' },
        { id: 'i2', name: 'region' },
      ],
      rows: [
        {
          id: 'r1',
          position: 0,
          isActive: true,
          conditions: [
            { inputId: 'i1', operator: 'equals', value: 'gold' },
            { inputId: 'i2', operator: 'equals', value: 'us' },
          ],
          answerLiteral: 'gold-us',
        },
      ],
    });
    const svc = buildService(table);
    const matched = await svc.evaluate('table-1', {
      inputs: { tier: 'gold', region: 'us' },
    });
    expect(matched.matched).toBe(true);
    const partial = await svc.evaluate('table-1', {
      inputs: { tier: 'gold', region: 'eu' },
    });
    expect(partial.matched).toBe(false);
  });

  it('falls back to defaultValue for missing inputs', async () => {
    const table = buildTable({
      inputs: [{ id: 'i1', name: 'tier', defaultValue: 'silver' }],
      rows: [
        {
          id: 'r1',
          position: 0,
          isActive: true,
          conditions: [{ inputId: 'i1', operator: 'equals', value: 'silver' }],
          answerLiteral: 'matched-default',
        },
      ],
    });
    const svc = buildService(table);
    const result = await svc.evaluate('table-1', { inputs: {} });
    expect(result.matched).toBe(true);
    expect(result.answer).toBe('matched-default');
  });

  it('honors numeric comparison operators', async () => {
    const table = buildTable({
      inputs: [{ id: 'i1', name: 'amount' }],
      rows: [
        {
          id: 'r1',
          position: 0,
          isActive: true,
          conditions: [{ inputId: 'i1', operator: 'greater_than_or_equals', value: 100 }],
          answerLiteral: 'large',
        },
      ],
    });
    const svc = buildService(table);
    expect((await svc.evaluate('table-1', { inputs: { amount: 100 } })).matched).toBe(true);
    expect((await svc.evaluate('table-1', { inputs: { amount: 99 } })).matched).toBe(false);
    // String coercion for numeric inputs (data may flow as string from forms).
    expect((await svc.evaluate('table-1', { inputs: { amount: '150' } })).matched).toBe(true);
  });

  it('resolves answer to recordId reference when answerLiteral is absent', async () => {
    const table = buildTable({
      answerCollectionCode: 'pricing_tiers',
      inputs: [{ id: 'i1', name: 'tier' }],
      rows: [
        {
          id: 'r1',
          position: 0,
          isActive: true,
          conditions: [{ inputId: 'i1', operator: 'equals', value: 'gold' }],
          answerLiteral: null,
          answerRecordId: 'rec-123',
        },
      ],
    });
    const svc = buildService(table);
    const result = await svc.evaluate('table-1', { inputs: { tier: 'gold' } });
    expect(result.answer).toEqual({
      recordId: 'rec-123',
      collectionCode: 'pricing_tiers',
    });
  });

  it('rejects evaluation against an unpublished table', async () => {
    const table = buildTable({
      status: 'draft',
      inputs: [{ id: 'i1', name: 'tier' }],
      rows: [],
    });
    const svc = buildService(table);
    await expect(
      svc.evaluate('table-1', { inputs: { tier: 'gold' } }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
