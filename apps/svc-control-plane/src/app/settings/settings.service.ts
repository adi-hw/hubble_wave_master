import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GlobalSettings } from '@hubblewave/control-plane-db';
import { UpdateGlobalSettingsDto } from './settings.dto';
import { AuditService } from '../audit/audit.service';

const DEFAULT_SETTINGS = {
  platformName: 'HubbleWave Control Plane',
  maintenanceMode: false,
  publicSignup: false,
  defaultTrialDays: 14,
  supportEmail: 'support@hubblewave.com',
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(GlobalSettings)
    private readonly settingsRepo: Repository<GlobalSettings>,
    private readonly auditService: AuditService,
  ) {}

  async getGlobalSettings(): Promise<GlobalSettings> {
    const existing = await this.settingsRepo.findOne({
      where: { scope: 'global' },
    });
    if (existing) {
      return existing;
    }

    const created = this.settingsRepo.create({
      scope: 'global',
      ...DEFAULT_SETTINGS,
      metadata: {},
    });
    return this.settingsRepo.save(created);
  }

  async updateGlobalSettings(
    dto: UpdateGlobalSettingsDto,
    actor?: string,
  ): Promise<GlobalSettings> {
    const settings = await this.getGlobalSettings();
    Object.assign(settings, dto);

    const saved = await this.settingsRepo.save(settings);
    await this.auditService.log('settings.updated', 'Updated global settings', {
      actor: actor || 'system',
      actorType: actor ? 'user' : 'system',
      target: saved.id,
      targetType: 'config',
      metadata: { scope: saved.scope },
    });
    return saved;
  }
}
