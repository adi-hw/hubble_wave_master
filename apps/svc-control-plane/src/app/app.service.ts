import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { TerraformWorker } from './terraform/terraform.worker';
import { ConfigService } from '@nestjs/config';
import { AuditService } from './audit/audit.service';

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
    // Simple polling loop; replace with queue/cron in production.
    this.intervalHandle = setInterval(() => {
      this.terraformWorker.processPendingJobs();
    }, 5000);
    this.logger.log('Terraform worker polling started (5s interval)');

    const retentionDays = this.configService.get<number>('AUDIT_RETENTION_DAYS', 180);
    this.auditPruneHandle = setInterval(() => {
      this.auditService
        .purgeOlderThan(retentionDays)
        .catch((err) => this.logger.warn(`Audit purge failed: ${err?.message || err}`));
    }, 24 * 60 * 60 * 1000);
    this.logger.log(`Audit retention set to ${retentionDays} days`);
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
