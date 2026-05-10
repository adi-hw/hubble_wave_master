import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Instance } from '@hubblewave/control-plane-db';
import { AuditService } from '../audit/audit.service';
import { BackupTriggerDto, RestoreTriggerDto } from './recovery.dto';

@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    @InjectRepository(Instance)
    private readonly instanceRepo: Repository<Instance>,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly auditService: AuditService,
  ) {}

  async triggerBackup(dto: BackupTriggerDto, actorId?: string) {
    const instance = await this.findInstance(dto.instanceId);
    this.assertActive(instance);

    await this.postToInstance(instance, '/api/backup/run', {});

    await this.auditService.log('instance.backup.triggered', `Triggered backup for ${instance.id}`, {
      actor: actorId || 'system',
      actorType: actorId ? 'user' : 'system',
      target: instance.id,
      targetType: 'instance',
      metadata: { instanceId: instance.id },
    });

    return { triggered: true };
  }

  async triggerRestore(dto: RestoreTriggerDto, actorId?: string) {
    const instance = await this.findInstance(dto.instanceId);
    this.assertActive(instance);
    if (!dto.backupId || !dto.backupId.trim()) {
      throw new BadRequestException('backupId is required');
    }

    await this.postToInstance(instance, '/api/backup/restore', {
      backupId: dto.backupId.trim(),
    });

    await this.auditService.log('instance.restore.triggered', `Triggered restore for ${instance.id}`, {
      actor: actorId || 'system',
      actorType: actorId ? 'user' : 'system',
      target: instance.id,
      targetType: 'instance',
      metadata: { instanceId: instance.id, backupId: dto.backupId.trim() },
    });

    return { triggered: true };
  }

  private async findInstance(id: string): Promise<Instance> {
    const instance = await this.instanceRepo.findOne({ where: { id } });
    if (!instance) {
      throw new NotFoundException(`Instance ${id} not found`);
    }
    return instance;
  }

  private assertActive(instance: Instance): void {
    if (instance.status !== 'active') {
      throw new BadRequestException(`Instance ${instance.id} is not active`);
    }
  }

  private resolveInstanceBaseUrl(instance: Instance): string {
    const domain = instance.customDomain || instance.domain;
    if (!domain) {
      throw new BadRequestException('Instance domain is not configured');
    }
    if (domain.startsWith('http://') || domain.startsWith('https://')) {
      return domain;
    }
    const scheme = this.configService.get<string>('CONTROL_PLANE_INSTANCE_SCHEME') || 'https';
    return `${scheme}://${domain}`;
  }

  private resolveInstanceToken(instance: Instance): string {
    const config = (instance.config || {}) as Record<string, unknown>;
    const tokenFromConfig = typeof config['packInstallToken'] === 'string'
      ? (config['packInstallToken'] as string)
      : undefined;
    const token = tokenFromConfig || this.configService.get<string>('CONTROL_PLANE_INSTANCE_TOKEN');
    if (!token) {
      throw new BadRequestException('Instance token is not configured');
    }
    return token;
  }

  private async postToInstance(instance: Instance, path: string, payload: Record<string, unknown>) {
    const baseUrl = this.resolveInstanceBaseUrl(instance);
    const token = this.resolveInstanceToken(instance);

    try {
      await firstValueFrom(
        this.httpService.post(`${baseUrl}${path}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
        }),
      );
    } catch (error: unknown) {
      const message = (error as { message?: string }).message || 'Failed to trigger recovery action';
      this.logger.error(message);
      throw new BadRequestException(message);
    }
  }
}
