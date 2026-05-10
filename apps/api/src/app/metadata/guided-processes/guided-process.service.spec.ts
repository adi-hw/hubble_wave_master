import { BadRequestException } from '@nestjs/common';
import { GuidedProcessService } from './guided-process.service';
import type {
  GuidedProcessDefinition,
  GuidedActivityKind,
} from '@hubblewave/instance-db';

interface FixtureActivity {
  name: string;
  kind: GuidedActivityKind;
  processFlowCode?: string | null;
}

const buildProcess = (
  activities: FixtureActivity[],
): GuidedProcessDefinition => ({
  id: 'gp-1',
  code: 'onboarding',
  name: 'Onboarding',
  collectionId: 'col-1',
  status: 'draft',
  isActive: true,
  stages: [
    {
      id: 's1',
      processId: 'gp-1',
      name: 'Setup',
      position: 0,
      activities: activities.map((a, idx) => ({
        id: `a${idx + 1}`,
        stageId: 's1',
        name: a.name,
        position: idx,
        kind: a.kind,
        processFlowCode: a.processFlowCode ?? null,
      })),
    },
  ],
} as unknown as GuidedProcessDefinition);

const buildService = (overrides: {
  process: GuidedProcessDefinition;
  flows?: Array<{ code: string; status: string }>;
  decisions?: Array<{ code: string; status: string }>;
}) => {
  const defRepo = {
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(overrides.process),
    })),
    save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
  };
  const flowRepo = {
    find: jest.fn().mockResolvedValue(overrides.flows ?? []),
  };
  const decisionRepo = {
    find: jest.fn().mockResolvedValue(overrides.decisions ?? []),
  };
  const stageRepo = {};
  const activityRepo = {};
  const collectionRepo = {};
  const dataSource = {};
  return new GuidedProcessService(
    defRepo as never,
    stageRepo as never,
    activityRepo as never,
    collectionRepo as never,
    flowRepo as never,
    decisionRepo as never,
    dataSource as never,
  );
};

describe('GuidedProcessService.publish — dependency validation', () => {
  it('publishes when every flow and decision dependency exists and is published', async () => {
    const svc = buildService({
      process: buildProcess([
        { name: 'Run intake', kind: 'flow', processFlowCode: 'intake_flow' },
        { name: 'Score risk', kind: 'decision', processFlowCode: 'risk_table' },
        { name: 'Confirm', kind: 'manual_task' },
      ]),
      flows: [{ code: 'intake_flow', status: 'published' }],
      decisions: [{ code: 'risk_table', status: 'published' }],
    });
    await expect(svc.publish('gp-1', 'user-1')).resolves.toBeDefined();
  });

  it('rejects publish when a flow dependency does not exist', async () => {
    const svc = buildService({
      process: buildProcess([
        { name: 'Run intake', kind: 'flow', processFlowCode: 'missing_flow' },
      ]),
      flows: [],
    });
    await expect(svc.publish('gp-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects publish when a flow dependency is in draft', async () => {
    const svc = buildService({
      process: buildProcess([
        { name: 'Run intake', kind: 'flow', processFlowCode: 'intake_flow' },
      ]),
      flows: [{ code: 'intake_flow', status: 'draft' }],
    });
    const error = await svc.publish('gp-1').catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    const response = error.getResponse() as { errors: string[] };
    expect(response.errors[0]).toContain('intake_flow');
    expect(response.errors[0]).toContain('draft');
  });

  it('rejects publish when a decision dependency does not exist', async () => {
    const svc = buildService({
      process: buildProcess([
        { name: 'Score', kind: 'decision', processFlowCode: 'ghost_table' },
      ]),
      decisions: [],
    });
    const error = await svc.publish('gp-1').catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    const response = error.getResponse() as { errors: string[] };
    expect(response.errors.some((m) => m.includes('ghost_table'))).toBe(true);
  });

  it('reports every unresolved dependency in a single error', async () => {
    const svc = buildService({
      process: buildProcess([
        { name: 'Flow A', kind: 'flow', processFlowCode: 'flow_a' },
        { name: 'Flow B', kind: 'flow', processFlowCode: 'flow_b' },
        { name: 'Table A', kind: 'decision', processFlowCode: 'table_a' },
      ]),
      flows: [{ code: 'flow_a', status: 'published' }],
      decisions: [{ code: 'table_a', status: 'draft' }],
    });
    const error = await svc.publish('gp-1').catch((e) => e);
    const response = error.getResponse() as { errors: string[] };
    expect(response.errors).toHaveLength(2);
    expect(response.errors.some((m) => m.includes('flow_b'))).toBe(true);
    expect(response.errors.some((m) => m.includes('table_a'))).toBe(true);
  });

  it('ignores manual_task activities (no dependency required)', async () => {
    const svc = buildService({
      process: buildProcess([
        { name: 'Confirm', kind: 'manual_task' },
        { name: 'Sign-off', kind: 'manual_task' },
      ]),
    });
    await expect(svc.publish('gp-1')).resolves.toBeDefined();
  });

  it('rejects flow activities missing processFlowCode entirely', async () => {
    const svc = buildService({
      process: buildProcess([
        { name: 'Orphan flow', kind: 'flow', processFlowCode: null },
      ]),
    });
    const error = await svc.publish('gp-1').catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    const response = error.getResponse() as { errors: string[] };
    expect(response.errors[0]).toContain('Orphan flow');
  });
});
