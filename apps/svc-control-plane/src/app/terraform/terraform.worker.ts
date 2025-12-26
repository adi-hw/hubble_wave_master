import { Injectable, Logger } from '@nestjs/common';
import { TerraformService } from './terraform.service';
import { InstancesService } from '../instances/instances.service';
import { TerraformExecutor } from './terraform.executor';

/**
 * In-process worker to execute terraform jobs and stream output to DB.
 * Replace with queue-based worker for production scale.
 */
@Injectable()
export class TerraformWorker {
  private readonly logger = new Logger(TerraformWorker.name);
  private running = false;

  constructor(
    private readonly terraformService: TerraformService,
    private readonly instancesService: InstancesService,
    private readonly executor: TerraformExecutor,
  ) {}

  /**
   * Process pending jobs sequentially.
   */
  async processPendingJobs() {
    if (this.running) return;
    this.running = true;

    try {
      const pending = await this.terraformService.findAll({ status: 'pending', limit: 5 });
      for (const job of pending.data) {
        await this.runJob(job.id);
      }
    } catch (err) {
      const e = err as any;
      this.logger.error('Failed to process terraform jobs', e?.stack || e);
    } finally {
      this.running = false;
    }
  }

  private async streamOutput(jobId: string, lines: { level: any; message: string; time?: string }[]) {
    for (const line of lines) {
      await this.terraformService.appendOutput(jobId, {
        time: line.time || new Date().toISOString(),
        level: line.level as any,
        message: line.message,
      });
    }
  }

  /**
   * Execute a single job with rollback on failure (apply -> destroy).
   */
  async runJob(jobId: string) {
    const job = await this.terraformService.start(jobId);
    this.logger.log(`Started terraform job ${job.id} (${job.operation}) for instance ${job.instanceId}`);

    try {
      let result;
      if (job.operation === 'apply') {
        result = await this.executor.apply(job);
      } else if (job.operation === 'plan') {
        result = await this.executor.plan(job);
      } else if (job.operation === 'destroy') {
        result = await this.executor.destroy(job);
      } else {
        throw new Error(`Unsupported operation ${job.operation}`);
      }

      if (result?.output?.length) {
        await this.streamOutput(jobId, result.output);
      }

      if (job.operation === 'apply') {
        await this.instancesService.update(job.instanceId, {
          status: 'active',
          health: 'healthy',
          provisioningCompletedAt: new Date(),
        });
      }
      if (job.operation === 'destroy') {
        await this.instancesService.update(job.instanceId, { status: 'terminated', health: 'unknown' });
      }

      await this.terraformService.complete(jobId);
      await this.instancesService.update(job.instanceId, { lastDeployedAt: new Date() });
      this.logger.log(`Completed terraform job ${job.id}`);
    } catch (err: any) {
      this.logger.error(`Job ${job.id} failed: ${err?.message || err}`);
      if (err?.output?.length) {
        await this.streamOutput(jobId, err.output);
      }
      // Attempt rollback for failed apply
      if (job.operation === 'apply') {
        try {
          const rollback = await this.executor.destroy(job);
          if (rollback?.output?.length) {
            await this.streamOutput(jobId, rollback.output);
          }
        } catch (rollbackErr: any) {
          this.logger.error(`Rollback failed for job ${job.id}: ${rollbackErr?.message || rollbackErr}`);
        }
      }
      await this.terraformService.fail(jobId, err?.message || 'Unknown error');
      await this.instancesService.update(job.instanceId, { status: 'failed', health: 'degraded' });
    }
  }
}
