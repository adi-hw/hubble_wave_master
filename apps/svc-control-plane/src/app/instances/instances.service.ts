import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import {
  TenantInstance,
  InstanceHealth,
} from '@hubblewave/control-plane-db';
import { AuditService } from '../audit/audit.service';
import { CreateInstanceDto, UpdateInstanceDto, InstanceQueryParams } from './instances.dto';
import { TerraformService } from '../terraform/terraform.service';
import { LicensesService } from '../licenses/licenses.service';

@Injectable()
export class InstancesService {
  constructor(
    @InjectRepository(TenantInstance)
    private readonly instanceRepo: Repository<TenantInstance>,
    private readonly auditService: AuditService,
    private readonly terraformService: TerraformService,
    private readonly licensesService: LicensesService,
  ) {}

  async findAll(params: InstanceQueryParams = {}) {
    // ... existing implementation
    const { customerId, environment, status, health, region, page = 1, limit = 50 } = params;

    let query = this.instanceRepo.createQueryBuilder('instance')
      .leftJoinAndSelect('instance.customer', 'customer')
      .where('instance.deletedAt IS NULL');

    if (customerId) {
      query = query.andWhere('instance.customerId = :customerId', { customerId });
    }
    if (environment) {
      query = query.andWhere('instance.environment = :environment', { environment });
    }
    if (status) {
      query = query.andWhere('instance.status = :status', { status });
    }
    if (health) {
      query = query.andWhere('instance.health = :health', { health });
    }
    if (region) {
      query = query.andWhere('instance.region = :region', { region });
    }

    const [instances, total] = await query
      .orderBy('instance.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: instances,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<TenantInstance> {
    const instance = await this.instanceRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['customer'],
    });

    if (!instance) {
      throw new NotFoundException(`Instance with ID ${id} not found`);
    }

    return instance;
  }

  async findByCustomer(customerId: string): Promise<TenantInstance[]> {
    return this.instanceRepo.find({
      where: { customerId, deletedAt: IsNull() },
      order: { environment: 'ASC' },
    });
  }

  async create(dto: CreateInstanceDto, createdBy?: string): Promise<TenantInstance> {
    // Check if instance already exists for this customer/environment
    const existing = await this.instanceRepo.findOne({
      where: {
        customerId: dto.customerId,
        environment: dto.environment,
        deletedAt: IsNull(),
      },
    });

    if (existing) {
      throw new BadRequestException(
        `Instance already exists for this customer in ${dto.environment} environment`
      );
    }

    const instance = this.instanceRepo.create({
      ...dto,
      status: 'provisioning',
      health: 'unknown',
      resourceTier: dto.resourceTier || 'standard',
      databaseName: `eam_tenant_${dto.customerId.split('-')[0]}`,
      provisioningStartedAt: new Date(),
      createdBy,
    });

    const savedInstance = await this.instanceRepo.save(instance);

    await this.auditService.log(
      'instance.created',
      `Created instance ${savedInstance.databaseName} for customer ${dto.customerId}`,
      {
        customerId: dto.customerId,
        actor: createdBy,
        target: savedInstance.id,
        targetType: 'instance',
        metadata: { ...dto },
      }
    );

    return savedInstance;
  }

  /**
   * Trigger provisioning by creating a Terraform job and marking instance as provisioning.
   */
  async provision(id: string, triggeredBy?: string) {
    const instance = await this.findOne(id);
    const customerCode = instance.customer?.code;
    if (!customerCode) {
      throw new BadRequestException('Instance missing customer context');
    }

    const job = await this.terraformService.create(
      {
        instanceId: instance.id,
        customerCode,
        environment: instance.environment,
        operation: 'apply',
        workspace: instance.terraformWorkspace || `${customerCode}-${instance.environment}`,
      },
      triggeredBy,
    );

    instance.status = 'provisioning';
    instance.health = 'unknown';
    instance.provisioningStartedAt = new Date();
    instance.terraformWorkspace = job.workspace || instance.terraformWorkspace;
    await this.instanceRepo.save(instance);

    await this.auditService.log('instance.provision.started', `Provisioning started for ${instance.id}`, {
      customerId: instance.customerId,
      actor: triggeredBy || 'system',
      target: instance.id,
      targetType: 'instance',
      metadata: { jobId: job.id, environment: instance.environment, region: instance.region },
    });

    return { instance, jobId: job.id };
  }

  async update(id: string, dto: UpdateInstanceDto, updatedBy?: string): Promise<TenantInstance> {
    const instance = await this.findOne(id);

    Object.assign(instance, dto, { updatedBy });

    if (dto.status === 'active') {
      await this.licensesService.ensureActiveLicenseForCustomer(instance.customerId);
      if (!instance.provisioningCompletedAt) {
        instance.provisioningCompletedAt = new Date();
      }
    }

    const saved = await this.instanceRepo.save(instance);
    await this.auditService.log('instance.updated', `Updated instance ${saved.id}`, {
      customerId: saved.customerId,
      actor: updatedBy || 'system',
      target: saved.id,
      targetType: 'instance',
      metadata: { status: saved.status, version: saved.version, resourceTier: saved.resourceTier },
    });
    return saved;
  }

  async updateHealth(id: string, health: InstanceHealth, details?: Record<string, unknown>): Promise<TenantInstance> {
    const instance = await this.findOne(id);

    instance.health = health;
    instance.lastHealthCheck = new Date();
    if (details) {
      instance.healthDetails = details;
    }

    const saved = await this.instanceRepo.save(instance);
    await this.auditService.log('instance.health.updated', `Health ${health} for instance ${saved.id}`, {
      customerId: saved.customerId,
      actor: 'system',
      target: saved.id,
      targetType: 'instance',
      metadata: { health, details },
    });
    return saved;
  }

  async updateMetrics(id: string, metrics: TenantInstance['resourceMetrics']): Promise<TenantInstance> {
    const instance = await this.findOne(id);
    instance.resourceMetrics = metrics;
    return this.instanceRepo.save(instance);
  }

  async setDomain(id: string, domain: string, updatedBy?: string): Promise<TenantInstance> {
    const instance = await this.findOne(id);
    instance.domain = domain;
    instance.updatedBy = updatedBy;
    return this.instanceRepo.save(instance);
  }

  async terminate(id: string, deletedBy?: string): Promise<void> {
    const instance = await this.findOne(id);
    instance.status = 'terminated';
    instance.deletedAt = new Date();
    instance.updatedBy = deletedBy;
    await this.instanceRepo.save(instance);
    await this.auditService.log('instance.terminated', `Terminated instance ${instance.id}`, {
      customerId: instance.customerId,
      actor: deletedBy || 'system',
      target: instance.id,
      targetType: 'instance',
    });
  }

  async getStats() {
    const stats = await this.instanceRepo
      .createQueryBuilder('instance')
      .select('instance.status', 'status')
      .addSelect('instance.health', 'health')
      .addSelect('instance.environment', 'environment')
      .addSelect('COUNT(*)', 'count')
      .where('instance.deleted_at IS NULL')
      .groupBy('instance.status')
      .addGroupBy('instance.health')
      .addGroupBy('instance.environment')
      .getRawMany();

    const healthCounts = await this.instanceRepo
      .createQueryBuilder('instance')
      .select('instance.health', 'health')
      .addSelect('COUNT(*)', 'count')
      .where('instance.deleted_at IS NULL')
      .groupBy('instance.health')
      .getRawMany();

    return {
      byStatus: stats,
      health: healthCounts.reduce((acc, h) => {
        acc[h.health] = parseInt(h.count);
        return acc;
      }, {} as Record<string, number>),
    };
  }
}
