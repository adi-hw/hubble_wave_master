import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RuntimeAnomaly } from '../entities/runtime-anomaly.entity';
import { RuntimeAnomalyService } from './runtime-anomaly.service';

describe('RuntimeAnomalyService', () => {
  let service: RuntimeAnomalyService;
  let createSpy: jest.Mock;
  let saveSpy: jest.Mock;

  beforeEach(async () => {
    createSpy = jest.fn((entity: Partial<RuntimeAnomaly>) => entity as RuntimeAnomaly);
    saveSpy = jest.fn(async (entity: Partial<RuntimeAnomaly>) => entity as RuntimeAnomaly);

    const repoStub = {
      create: createSpy,
      save: saveSpy,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuntimeAnomalyService,
        {
          provide: getRepositoryToken(RuntimeAnomaly),
          useValue: repoStub,
        },
      ],
    }).compile();

    service = module.get<RuntimeAnomalyService>(RuntimeAnomalyService);
  });

  it('persists an anomaly with all fields', async () => {
    await service.record({
      kind: 'bulk_partial_failure',
      serviceCode: 'svc-data',
      message: 'Skipped row abc-123 during bulk update: timeout',
      collectionCode: 'work_orders',
      recordId: 'abc-123',
      context: { operation: 'bulk_update', userId: 'user-9' },
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledTimes(1);

    const saved = saveSpy.mock.calls[0][0] as RuntimeAnomaly;
    expect(saved.kind).toBe('bulk_partial_failure');
    expect(saved.serviceCode).toBe('svc-data');
    expect(saved.message).toBe('Skipped row abc-123 during bulk update: timeout');
    expect(saved.collectionCode).toBe('work_orders');
    expect(saved.recordId).toBe('abc-123');
    expect(saved.context).toEqual({ operation: 'bulk_update', userId: 'user-9' });
    expect(saved.errorPayload).toBeNull();
    expect(saved.occurredAt).toBeInstanceOf(Date);
  });

  it('coerces optional fields to null when omitted', async () => {
    await service.record({
      kind: 'outbox_terminal_drop',
      serviceCode: 'svc-automation',
      message: 'minimal',
    });

    const saved = saveSpy.mock.calls[0][0] as RuntimeAnomaly;
    expect(saved.collectionCode).toBeNull();
    expect(saved.recordId).toBeNull();
    expect(saved.context).toBeNull();
    expect(saved.errorPayload).toBeNull();
  });

  it('serializes Error name + message + stack into errorPayload', async () => {
    const err = new TypeError('payload missing collectionCode');
    err.stack = 'TypeError: payload missing collectionCode\n    at line:1';

    await service.record({
      kind: 'outbox_terminal_drop',
      serviceCode: 'svc-notify',
      message: 'Notification outbox entry abc terminally failed',
      error: err,
    });

    const saved = saveSpy.mock.calls[0][0] as RuntimeAnomaly;
    expect(saved.errorPayload).toEqual({
      name: 'TypeError',
      message: 'payload missing collectionCode',
      stack: 'TypeError: payload missing collectionCode\n    at line:1',
    });
  });

  it('tolerates write failure (does not throw)', async () => {
    saveSpy.mockRejectedValueOnce(new Error('table runtime_anomaly does not exist'));

    await expect(
      service.record({
        kind: 'after_automation_swallowed',
        serviceCode: 'svc-automation',
        message: 'Automation X failed',
      }),
    ).resolves.toBeUndefined();
  });

  it('does not re-throw when save fails so the original runtime decision is preserved', async () => {
    saveSpy.mockRejectedValueOnce(new Error('connection lost'));

    let threw = false;
    try {
      await service.record({
        kind: 'bulk_partial_failure',
        serviceCode: 'svc-data',
        message: 'anomaly write boom',
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  it('records null stack when the Error has no stack', async () => {
    const err = new Error('no stack');
    err.stack = undefined;

    await service.record({
      kind: 'after_automation_swallowed',
      serviceCode: 'svc-automation',
      message: 'no stack case',
      error: err,
    });

    const saved = saveSpy.mock.calls[0][0] as RuntimeAnomaly;
    expect((saved.errorPayload as Record<string, unknown>).stack).toBeNull();
  });
});
