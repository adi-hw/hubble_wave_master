import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Job } from 'bullmq';
import { ScheduledJob } from '@hubblewave/instance-db';

import { SchedulerService } from './scheduler.service';
import { ScheduledJobService } from './scheduled-job.service';
import { ActionHandlerService } from './action-handler.service';
import { ScriptSandboxService } from './script-sandbox.service';
import { ExecutionLogService } from './execution-log.service';
import {
  AutomationRateLimiterService,
  RateLimiterDecision,
} from './automation-rate-limiter.service';

interface ScheduledJobPayload {
  jobId: string;
  jobName: string;
  collectionId?: string;
  actionType: string;
  actions?: Array<{ id: string; type: string; config: Record<string, unknown> }>;
  script?: string;
  queryFilter?: Record<string, unknown>;
}

/**
 * Test seam: invoke the private `handleWorkerFailure` method without
 * spinning up a real BullMQ worker. This is the same code path the
 * `worker.on('failed', ...)` listener calls, so exercising it here
 * matches production behavior.
 */
function invokeFailedHandler(
  service: SchedulerService,
  job: Partial<Job<ScheduledJobPayload>> | undefined,
  err: Error,
): Promise<void> {
  return (
    service as unknown as {
      handleWorkerFailure: (
        j: Partial<Job<ScheduledJobPayload>> | undefined,
        e: Error,
      ) => Promise<void>;
    }
  ).handleWorkerFailure(job, err);
}

function buildJob(
  attemptsMade: number,
  attempts = 3,
  overrides: Partial<Job<ScheduledJobPayload>> = {},
): Partial<Job<ScheduledJobPayload>> {
  const data: ScheduledJobPayload = {
    jobId: 'auto-1',
    jobName: 'nightly-export',
    actionType: 'script',
    script: 'noop',
  };
  return {
    id: 'bull-job-1',
    name: 'nightly-export',
    attemptsMade,
    opts: { attempts },
    data,
    toJSON: jest.fn(() => ({
      id: 'bull-job-1',
      name: 'nightly-export',
      data,
      opts: { attempts },
      attemptsMade,
      progress: 0,
      returnvalue: null,
      stacktrace: [],
      timestamp: Date.now(),
    })) as unknown as Job<ScheduledJobPayload>['toJSON'],
    ...overrides,
  };
}

describe('SchedulerService', () => {
  let service: SchedulerService;
  let eventEmitter: EventEmitter2;
  let dlqAdd: jest.Mock;

  const mockScheduledJobService = {
    getDueJobs: jest.fn().mockResolvedValue([]),
    getJob: jest.fn(),
    recordSuccess: jest.fn(),
    recordFailure: jest.fn(),
  };
  const mockActionHandler = { execute: jest.fn() };
  const mockScriptSandbox = { execute: jest.fn() };
  const mockExecutionLogService = { log: jest.fn() };
  const mockRateLimiter = {
    tryAcquire: jest.fn().mockResolvedValue({ allowed: true }),
    release: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(true),
    getConcurrencyCap: jest.fn().mockReturnValue(3),
    getRateMax: jest.fn().mockReturnValue(100),
    getRateDurationMs: jest.fn().mockReturnValue(60_000),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // The mock state is cleared above, so re-prime defaults that the
    // SchedulerService relies on for the happy path.
    mockScheduledJobService.getDueJobs.mockResolvedValue([]);
    mockRateLimiter.tryAcquire.mockResolvedValue({ allowed: true });
    mockRateLimiter.release.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: ScheduledJobService, useValue: mockScheduledJobService },
        { provide: ActionHandlerService, useValue: mockActionHandler },
        { provide: ScriptSandboxService, useValue: mockScriptSandbox },
        { provide: ExecutionLogService, useValue: mockExecutionLogService },
        { provide: AutomationRateLimiterService, useValue: mockRateLimiter },
        EventEmitter2,
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    // Inject a fake DLQ queue so we can assert without a Redis connection.
    dlqAdd = jest.fn().mockResolvedValue(undefined);
    (service as unknown as { dlqQueue: { add: jest.Mock } }).dlqQueue = {
      add: dlqAdd,
    };
  });

  describe('handleWorkerFailure', () => {
    it('moves job to DLQ on final attempt failure', async () => {
      const job = buildJob(3, 3); // attemptsMade === attempts → final
      const err = new Error('malformed query filter');

      await invokeFailedHandler(service, job, err);

      expect(dlqAdd).toHaveBeenCalledTimes(1);
      const [queueName, payload] = dlqAdd.mock.calls[0];
      expect(queueName).toBe('failed-job');
      expect(payload).toMatchObject({
        error: 'malformed query filter',
        failedAt: expect.any(String),
      });
      expect(payload.originalJob).toMatchObject({
        id: 'bull-job-1',
        name: 'nightly-export',
        attemptsMade: 3,
      });
      // ISO-8601 timestamp
      expect(() => new Date(payload.failedAt as string).toISOString()).not.toThrow();
    });

    it('emits scheduled_job.failed event on final failure', async () => {
      const emitSpy = jest.spyOn(eventEmitter, 'emit');
      const job = buildJob(3, 3);
      const err = new Error('automation timeout');

      await invokeFailedHandler(service, job, err);

      expect(emitSpy).toHaveBeenCalledWith('scheduled_job.failed', {
        jobId: 'bull-job-1',
        automationId: 'auto-1',
        error: 'automation timeout',
      });
    });

    it('does NOT add to DLQ on intermediate retry failures', async () => {
      const emitSpy = jest.spyOn(eventEmitter, 'emit');
      const err = new Error('transient redis blip');

      await invokeFailedHandler(service, buildJob(1, 3), err); // 1/3
      await invokeFailedHandler(service, buildJob(2, 3), err); // 2/3

      expect(dlqAdd).not.toHaveBeenCalled();
      expect(emitSpy).not.toHaveBeenCalledWith(
        'scheduled_job.failed',
        expect.anything(),
      );
    });

    it('is a no-op when the job argument is undefined', async () => {
      const emitSpy = jest.spyOn(eventEmitter, 'emit');

      await invokeFailedHandler(service, undefined, new Error('lost job ref'));

      expect(dlqAdd).not.toHaveBeenCalled();
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it('still emits scheduled_job.failed when DLQ enqueue itself fails', async () => {
      // Operators must be alerted even if Redis ate the DLQ write.
      dlqAdd.mockRejectedValueOnce(new Error('redis down'));
      const emitSpy = jest.spyOn(eventEmitter, 'emit');
      const job = buildJob(3, 3);

      await invokeFailedHandler(service, job, new Error('original failure'));

      expect(dlqAdd).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith(
        'scheduled_job.failed',
        expect.objectContaining({ error: 'original failure' }),
      );
    });

    it('treats a job with the default attempts (1) as final on first failure', async () => {
      // BullMQ defaults attempts to 1 when not specified — first failure IS final.
      const job: Partial<Job<ScheduledJobPayload>> = {
        ...buildJob(1, 1),
        opts: {},
      };
      const err = new Error('one-shot job failed');

      await invokeFailedHandler(service, job, err);

      expect(dlqAdd).toHaveBeenCalledTimes(1);
    });
  });
});

/**
 * SchedulerService specifies the integration of the BullMQ worker with the
 * per-automation rate limiter (W7.C / Plan Fix 14). Tests target the
 * observable behaviors:
 *   - enqueueJob carries the automationId on the payload
 *   - processJob defers via job.moveToDelayed when the limiter refuses
 *   - processJob always releases the slot (even on action failure)
 *   - the rate-limiter key is the schedule id so sibling schedules share fairly
 *
 * Spinning up a real BullMQ worker would require Redis; instead the worker
 * callback is exercised directly because that is precisely what BullMQ
 * invokes per job.
 */

type ProcessJob = (job: Partial<Job> & { data: Record<string, unknown> }) => Promise<void>;

describe('SchedulerService — per-automation rate limiting (W7.C)', () => {
  let scheduler: SchedulerService;
  let rateLimiter: jest.Mocked<AutomationRateLimiterService>;
  let scheduledJobService: jest.Mocked<ScheduledJobService>;
  let actionHandler: jest.Mocked<ActionHandlerService>;
  let executionLogService: jest.Mocked<ExecutionLogService>;
  let scriptSandbox: jest.Mocked<ScriptSandboxService>;

  const buildScheduledJob = (overrides: Partial<ScheduledJob> = {}): ScheduledJob =>
    ({
      id: 'sched-runaway',
      name: 'Runaway Schedule',
      collectionId: 'col-1',
      actionType: 'no_code',
      actions: [{ id: 'a1', type: 'noop', config: {} }],
      script: undefined,
      queryFilter: undefined,
      ...overrides,
    }) as unknown as ScheduledJob;

  beforeEach(async () => {
    rateLimiter = {
      tryAcquire: jest.fn(),
      release: jest.fn().mockResolvedValue(undefined),
      isEnabled: jest.fn().mockReturnValue(true),
      getConcurrencyCap: jest.fn().mockReturnValue(3),
      getRateMax: jest.fn().mockReturnValue(100),
      getRateDurationMs: jest.fn().mockReturnValue(60_000),
    } as unknown as jest.Mocked<AutomationRateLimiterService>;

    scheduledJobService = {
      recordSuccess: jest.fn().mockResolvedValue(undefined),
      recordFailure: jest.fn().mockResolvedValue(undefined),
      getDueJobs: jest.fn().mockResolvedValue([]),
      getJob: jest.fn(),
    } as unknown as jest.Mocked<ScheduledJobService>;

    actionHandler = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ActionHandlerService>;

    executionLogService = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ExecutionLogService>;

    scriptSandbox = {
      execute: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ScriptSandboxService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: ScheduledJobService, useValue: scheduledJobService },
        { provide: ActionHandlerService, useValue: actionHandler },
        { provide: ScriptSandboxService, useValue: scriptSandbox },
        { provide: ExecutionLogService, useValue: executionLogService },
        { provide: AutomationRateLimiterService, useValue: rateLimiter },
        EventEmitter2,
      ],
    }).compile();

    scheduler = module.get(SchedulerService);
  });

  /** Reach into the private worker callback so we can drive jobs without Redis. */
  const processJob = (): ProcessJob => {
    return (scheduler as unknown as { processJob: ProcessJob }).processJob.bind(scheduler);
  };

  describe('enqueueJob', () => {
    it('sets automationId to the schedule id on the payload', async () => {
      const direct = (scheduler as unknown as {
        processJobDirect: (payload: Record<string, unknown>) => Promise<void>;
      }).processJobDirect.bind(scheduler);
      const captured: Record<string, unknown>[] = [];
      jest
        .spyOn(scheduler as unknown as { processJobDirect: (p: Record<string, unknown>) => Promise<void> }, 'processJobDirect')
        .mockImplementation(async (payload: Record<string, unknown>) => {
          captured.push(payload);
          await direct(payload);
        });

      const job = buildScheduledJob({ id: 'sched-42' });
      await scheduler.enqueueJob(job);

      expect(captured).toHaveLength(1);
      expect(captured[0]['automationId']).toBe('sched-42');
      expect(captured[0]['jobId']).toBe('sched-42');
    });
  });

  describe('processJob', () => {
    const baseData = {
      jobId: 'sched-A',
      jobName: 'Sched A',
      automationId: 'sched-A',
      collectionId: 'col-1',
      actionType: 'no_code',
      actions: [{ id: 'a1', type: 'noop', config: {} }],
    };

    const allow = (): RateLimiterDecision => ({ allowed: true });
    const refuse = (
      reason: 'concurrency' | 'rate-window',
      retryAfterMs = 1_000,
    ): RateLimiterDecision => ({ allowed: false, reason, retryAfterMs });

    it('processes the job when the rate limiter admits', async () => {
      rateLimiter.tryAcquire.mockResolvedValue(allow());
      const job = {
        id: 'bull-1',
        token: 'tok-1',
        data: baseData,
        moveToDelayed: jest.fn().mockResolvedValue(undefined),
      };

      await processJob()(job as never);

      expect(rateLimiter.tryAcquire).toHaveBeenCalledWith('sched-A');
      expect(actionHandler.execute).toHaveBeenCalledTimes(1);
      expect(job.moveToDelayed).not.toHaveBeenCalled();
      expect(rateLimiter.release).toHaveBeenCalledWith('sched-A');
    });

    it('defers the job via moveToDelayed when concurrency is exceeded', async () => {
      rateLimiter.tryAcquire.mockResolvedValue(refuse('concurrency', 1_500));
      const job = {
        id: 'bull-2',
        token: 'tok-2',
        data: baseData,
        moveToDelayed: jest.fn().mockResolvedValue(undefined),
      };

      const before = Date.now();
      await processJob()(job as never);

      expect(job.moveToDelayed).toHaveBeenCalledTimes(1);
      const [timestamp, token] = job.moveToDelayed.mock.calls[0];
      expect(timestamp).toBeGreaterThanOrEqual(before + 1_500);
      expect(token).toBe('tok-2');

      // Action must NOT run when the job is parked.
      expect(actionHandler.execute).not.toHaveBeenCalled();
      // Rate-limited deferrals must not consume a slot.
      expect(rateLimiter.release).not.toHaveBeenCalled();
    });

    it('defers the job via moveToDelayed when rate window is exceeded', async () => {
      rateLimiter.tryAcquire.mockResolvedValue(refuse('rate-window', 30_000));
      const job = {
        id: 'bull-3',
        token: 'tok-3',
        data: baseData,
        moveToDelayed: jest.fn().mockResolvedValue(undefined),
      };

      await processJob()(job as never);

      expect(job.moveToDelayed).toHaveBeenCalledTimes(1);
      expect(actionHandler.execute).not.toHaveBeenCalled();
    });

    it('releases the slot even when the action throws', async () => {
      rateLimiter.tryAcquire.mockResolvedValue(allow());
      actionHandler.execute.mockRejectedValueOnce(new Error('action exploded'));
      const job = {
        id: 'bull-4',
        token: 'tok-4',
        data: baseData,
        moveToDelayed: jest.fn().mockResolvedValue(undefined),
      };

      await expect(processJob()(job as never)).rejects.toThrow('action exploded');
      expect(rateLimiter.release).toHaveBeenCalledWith('sched-A');
    });

    it('uses jobId as the limiter key when automationId is missing', async () => {
      rateLimiter.tryAcquire.mockResolvedValue(allow());
      const job = {
        id: 'bull-5',
        token: 'tok-5',
        data: { ...baseData, automationId: undefined as unknown as string },
        moveToDelayed: jest.fn().mockResolvedValue(undefined),
      };

      await processJob()(job as never);

      expect(rateLimiter.tryAcquire).toHaveBeenCalledWith('sched-A');
    });
  });
});
