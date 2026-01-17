import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { Repository } from 'typeorm';
import {
  AlertDefinition,
  AuditLog,
  MetricDefinition,
  MetricPoint,
  buildAuditLogHash,
  buildAuditLogHashPayload,
} from '@hubblewave/instance-db';

type IntegrityResult = {
  valid: boolean;
  checked: number;
  failureId?: string;
  failureReason?: 'previous_hash_mismatch' | 'hash_mismatch';
};

@Injectable()
export class AuditIntegrityService implements OnModuleInit {
  private readonly logger = new Logger(AuditIntegrityService.name);
  private readonly cronSchedule: string;
  private readonly metricCode = 'audit_integrity_status';
  private readonly alertCode = 'audit_integrity_failure';

  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(MetricDefinition)
    private readonly metricRepo: Repository<MetricDefinition>,
    @InjectRepository(MetricPoint)
    private readonly pointRepo: Repository<MetricPoint>,
    @InjectRepository(AlertDefinition)
    private readonly alertRepo: Repository<AlertDefinition>,
  ) {
    this.cronSchedule = this.configService.get<string>('AUDIT_INTEGRITY_CRON') || '0 * * * *';
  }

  async onModuleInit(): Promise<void> {
    if (this.schedulerRegistry.doesExist('cron', 'audit-integrity-check')) {
      this.schedulerRegistry.deleteCronJob('audit-integrity-check');
    }
    const job = new CronJob(this.cronSchedule, () => {
      void this.runIntegrityCheck('scheduled').catch((error) => {
        this.logger.error(`Audit integrity check failed: ${(error as Error).message}`);
      });
    });
    this.schedulerRegistry.addCronJob('audit-integrity-check', job);
    job.start();

    if (this.configService.get<string>('AUDIT_INTEGRITY_RUN_ON_STARTUP') === 'true') {
      void this.runIntegrityCheck('startup').catch((error) => {
        this.logger.error(`Audit integrity startup check failed: ${(error as Error).message}`);
      });
    }
  }

  async runIntegrityCheck(triggeredBy: 'scheduled' | 'startup' | 'manual'): Promise<IntegrityResult> {
    const startedAt = Date.now();
    const result = await this.verifyAuditChain();
    await this.ensureMetricDefinition();
    await this.ensureAlertDefinition();

    const now = new Date();
    await this.pointRepo.save(
      this.pointRepo.create({
        metricCode: this.metricCode,
        periodStart: now,
        periodEnd: now,
        value: result.valid ? 1 : 0,
        dimensions: {
          status: result.valid ? 'valid' : 'invalid',
          checked: String(result.checked),
          triggeredBy,
        },
      }),
    );

    await this.auditRepo.save(
      this.auditRepo.create({
        userId: null,
        collectionCode: 'audit_log',
        recordId: result.failureId || null,
        action: result.valid ? 'audit.integrity.verified' : 'audit.integrity.failed',
        newValues: {
          valid: result.valid,
          checked: result.checked,
          failureId: result.failureId || null,
          failureReason: result.failureReason || null,
          durationMs: Date.now() - startedAt,
          triggeredBy,
        },
      }),
    );

    return result;
  }

  private async verifyAuditChain(): Promise<IntegrityResult> {
    const entries = await this.auditRepo.find({
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    let previousHash: string | null = null;
    let checked = 0;

    for (const entry of entries) {
      checked += 1;
      if (entry.previousHash !== previousHash) {
        return {
          valid: false,
          checked,
          failureId: entry.id,
          failureReason: 'previous_hash_mismatch',
        };
      }

      const expected = buildAuditLogHash(
        buildAuditLogHashPayload(entry, previousHash),
      );
      if (entry.hash !== expected) {
        return {
          valid: false,
          checked,
          failureId: entry.id,
          failureReason: 'hash_mismatch',
        };
      }

      previousHash = entry.hash ?? null;
    }

    return { valid: true, checked };
  }

  private async ensureMetricDefinition(): Promise<void> {
    const existing = await this.metricRepo.findOne({ where: { code: this.metricCode } });
    if (existing) {
      return;
    }
    await this.metricRepo.save(
      this.metricRepo.create({
        code: this.metricCode,
        name: 'Audit Integrity Status',
        description: 'Verification status for audit log hash chain integrity.',
        sourceType: 'analytics_event',
        sourceConfig: {},
        aggregation: 'min',
        cadence: 'hourly',
        retentionDays: parseInt(this.configService.get<string>('AUDIT_INTEGRITY_RETENTION_DAYS') || '30', 10),
        metadata: { system: true },
        isActive: true,
        createdBy: null,
      }),
    );
  }

  private async ensureAlertDefinition(): Promise<void> {
    const existing = await this.alertRepo.findOne({ where: { code: this.alertCode } });
    if (existing) {
      return;
    }

    const recipients = (this.configService.get<string>('AUDIT_INTEGRITY_ALERT_RECIPIENTS') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const templateCode = this.configService.get<string>('AUDIT_INTEGRITY_ALERT_TEMPLATE_CODE');
    const workflowCode = this.configService.get<string>('AUDIT_INTEGRITY_WORKFLOW_CODE');

    const actions: Record<string, unknown> = {};
    if (recipients.length && templateCode) {
      actions.notify = {
        recipients,
        template_code: templateCode,
      };
    }
    if (workflowCode) {
      actions.workflow = {
        workflow_code: workflowCode,
      };
    }

    await this.alertRepo.save(
      this.alertRepo.create({
        code: this.alertCode,
        name: 'Audit Integrity Failure',
        description: 'Triggers when audit log hash chain verification fails.',
        conditions: {
          metric_code: this.metricCode,
          operator: 'lt',
          threshold: 1,
          cooldown_minutes: 60,
        },
        actions,
        metadata: {
          system: true,
          severity: 'critical',
        },
        isActive: true,
        createdBy: null,
      }),
    );
  }
}
