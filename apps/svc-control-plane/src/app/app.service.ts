import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { TerraformWorker } from '../../../control-plane/src/app/terraform/terraform.worker';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../../control-plane/src/app/audit/audit.service';

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);
  private intervalHandle?: NodeJS.Timeout;
  private auditPruneHandle?: NodeJS.Timeout;

  constructor(
    private readonly terraformWorker: TerraformWorker,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  onModuleInit() {
    const workerEnabled = this.configService.get<string>('TERRAFORM_WORKER_ENABLED', 'false') === 'true';
    if (workerEnabled) {
      this.intervalHandle = setInterval(() => {
        this.terraformWorker.processPendingJobs();
      }, 5000);
      this.logger.log('Terraform worker polling started (5s interval)');
    } else {
      this.logger.log('Terraform worker polling disabled');
    }

    const auditEnabled = this.configService.get<string>('AUDIT_PRUNE_ENABLED', 'true') === 'true';
    if (auditEnabled) {
      const retentionDays = this.configService.get<number>('AUDIT_RETENTION_DAYS', 180);
      this.auditPruneHandle = setInterval(() => {
        this.auditService
          .purgeOlderThan(retentionDays)
          .catch((err: unknown) => this.logger.warn(`Audit purge failed: ${(err as { message?: string })?.message || String(err)}`));
      }, 24 * 60 * 60 * 1000);
      this.logger.log(`Audit retention set to ${retentionDays} days`);
    } else {
      this.logger.log('Audit pruning disabled');
    }
  }

  onModuleDestroy() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }
    if (this.auditPruneHandle) {
      clearInterval(this.auditPruneHandle);
    }
  }

  getData(): { message: string } {
    return { message: 'Hello API' };
  }
}
