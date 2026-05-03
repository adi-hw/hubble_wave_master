import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Job } from 'bullmq';

import { SchedulerService } from './scheduler.service';
import { ScheduledJobService } from './scheduled-job.service';
import { ActionHandlerService } from './action-handler.service';
import { ScriptSandboxService } from './script-sandbox.service';
import { ExecutionLogService } from './execution-log.service';

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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        { provide: ScheduledJobService, useValue: mockScheduledJobService },
        { provide: ActionHandlerService, useValue: mockActionHandler },
        { provide: ScriptSandboxService, useValue: mockScriptSandbox },
        { provide: ExecutionLogService, useValue: mockExecutionLogService },
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
