import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InstanceCustomization, ConfigChangeHistory } from '@hubblewave/instance-db';

export interface ConfigValue {
  configType: string;
  resourceKey: string;
  value: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Instance Configuration Service
 *
 * Provides persistent configuration storage for the customer instance.
 * Uses InstanceCustomization entity for storage and tracks changes in ConfigChangeHistory.
 */
@Injectable()
export class ConfigServiceLocal {
  private readonly logger = new Logger(ConfigServiceLocal.name);

  constructor(
    @InjectRepository(InstanceCustomization)
    private readonly customizationRepo: Repository<InstanceCustomization>,
    @InjectRepository(ConfigChangeHistory)
    private readonly historyRepo: Repository<ConfigChangeHistory>,
  ) {}

  /**
   * Get a configuration value
   */
  async get(configType: string, resourceKey: string): Promise<ConfigValue> {
    const config = await this.customizationRepo.findOne({
      where: { configType, resourceKey, isActive: true },
    });

    if (!config) {
      throw new NotFoundException(
        `Configuration not found: ${configType}/${resourceKey}`
      );
    }

    return {
      configType: config.configType,
      resourceKey: config.resourceKey,
      value: config.value,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Get a configuration value or return default
   */
  async getOrDefault<T>(
    configType: string,
    resourceKey: string,
    defaultValue: T
  ): Promise<T> {
    try {
      const config = await this.get(configType, resourceKey);
      return config.value as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Set a configuration value
   */
  async set(
    configType: string,
    resourceKey: string,
    value: unknown,
    userId?: string
  ): Promise<ConfigValue> {
    const existing = await this.customizationRepo.findOne({
      where: { configType, resourceKey },
    });

    const previousValue = existing?.value;

    if (existing) {
      await this.customizationRepo.update(existing.id, {
        value: value as any,
        isActive: true,
        updatedBy: userId,
      });
    } else {
      const newConfig = this.customizationRepo.create({
        configType,
        resourceKey,
        value,
        isActive: true,
        createdBy: userId,
        updatedBy: userId,
      });
      await this.customizationRepo.save(newConfig);
    }

    // Record change in history
    await this.historyRepo.save(
      this.historyRepo.create({
        configType,
        code: resourceKey,
        changeType: existing ? 'update' : 'create',
        details: {
          previousValue,
          newValue: value,
        },
        userId,
      })
    );

    this.logger.log(
      `Configuration ${existing ? 'updated' : 'created'}: ${configType}/${resourceKey}`
    );

    return this.get(configType, resourceKey);
  }

  /**
   * Delete a configuration value
   */
  async delete(
    configType: string,
    resourceKey: string,
    userId?: string
  ): Promise<void> {
    const existing = await this.customizationRepo.findOne({
      where: { configType, resourceKey },
    });

    if (!existing) {
      throw new NotFoundException(
        `Configuration not found: ${configType}/${resourceKey}`
      );
    }

    await this.customizationRepo.update(existing.id, {
      isActive: false,
      updatedBy: userId,
    });

    await this.historyRepo.save(
      this.historyRepo.create({
        configType,
        code: resourceKey,
        changeType: 'delete',
        details: { previousValue: existing.value },
        userId,
      })
    );

    this.logger.log(`Configuration deleted: ${configType}/${resourceKey}`);
  }

  /**
   * List all configurations by type
   */
  async list(configType?: string): Promise<ConfigValue[]> {
    const where = configType ? { configType, isActive: true } : { isActive: true };

    const configs = await this.customizationRepo.find({ where });

    return configs.map((config) => ({
      configType: config.configType,
      resourceKey: config.resourceKey,
      value: config.value,
      isActive: config.isActive,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }));
  }

  /**
   * Get configuration change history
   */
  async getHistory(
    configType?: string,
    resourceKey?: string,
    limit = 100
  ): Promise<ConfigChangeHistory[]> {
    const qb = this.historyRepo.createQueryBuilder('history');

    if (configType) {
      qb.andWhere('history.configType = :configType', { configType });
    }
    if (resourceKey) {
      qb.andWhere('history.code = :resourceKey', { resourceKey });
    }

    return qb
      .orderBy('history.changedAt', 'DESC')
      .take(limit)
      .getMany();
  }
}
