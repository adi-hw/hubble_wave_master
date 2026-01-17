import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  TerraformJob,
  TerraformOperation,
  TerraformJobStatus,
  TerraformOutputLine,
} from '@hubblewave/control-plane-db';

export interface CreateTerraformJobDto {
  instanceId: string;
  customerCode: string;
  environment: string;
  operation: TerraformOperation;
  workspace?: string;
}

export interface TerraformJobQueryParams {
  instanceId?: string;
  customerCode?: string;
  environment?: string;
  status?: TerraformJobStatus;
  operation?: TerraformOperation;
  page?: number;
  limit?: number;
}

@Injectable()
export class TerraformService {
  constructor(
    @InjectRepository(TerraformJob)
    private readonly jobRepo: Repository<TerraformJob>,
  ) {}

  async findAll(params: TerraformJobQueryParams = {}) {
    const {
      instanceId,
      customerCode,
      environment,
      status,
      operation,
      page = 1,
      limit = 50,
    } = params;

    let query = this.jobRepo.createQueryBuilder('job');

    if (instanceId) {
      query = query.andWhere('job.instance_id = :instanceId', { instanceId });
    }
    if (customerCode) {
      query = query.andWhere('job.customer_code = :customerCode', { customerCode });
    }
    if (environment) {
      query = query.andWhere('job.environment = :environment', { environment });
    }
    if (status) {
      query = query.andWhere('job.status = :status', { status });
    }
    if (operation) {
      query = query.andWhere('job.operation = :operation', { operation });
    }

    const [jobs, total] = await query
      .orderBy('job.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<TerraformJob> {
    const job = await this.jobRepo.findOne({
      where: { id },
      relations: ['instance'],
    });

    if (!job) {
      throw new NotFoundException(`Terraform job with ID ${id} not found`);
    }

    return job;
  }

  async getRunningJobs(): Promise<TerraformJob[]> {
    return this.jobRepo.find({
      where: { status: 'running' },
      relations: ['instance'],
      order: { startedAt: 'ASC' },
    });
  }

  async create(dto: CreateTerraformJobDto, triggeredBy?: string): Promise<TerraformJob> {
    const job = this.jobRepo.create({
      ...dto,
      status: 'pending',
      plan: { add: 0, change: 0, destroy: 0 },
      output: [],
      triggeredBy,
    });

    return this.jobRepo.save(job);
  }

  async start(id: string): Promise<TerraformJob> {
    const job = await this.findOne(id);
    job.status = 'running';
    job.startedAt = new Date();
    return this.jobRepo.save(job);
  }

  async assignWorkspace(id: string, workspace: string): Promise<TerraformJob> {
    const job = await this.findOne(id);
    job.workspace = workspace;
    return this.jobRepo.save(job);
  }

  async appendOutput(id: string, line: TerraformOutputLine): Promise<TerraformJob> {
    const job = await this.findOne(id);
    job.output = [...job.output, line];
    return this.jobRepo.save(job);
  }

  async updatePlan(id: string, plan: TerraformJob['plan']): Promise<TerraformJob> {
    const job = await this.findOne(id);
    job.plan = plan;
    return this.jobRepo.save(job);
  }

  async complete(id: string): Promise<TerraformJob> {
    const job = await this.findOne(id);
    job.status = 'completed';
    job.completedAt = new Date();
    if (job.startedAt) {
      job.duration = Math.floor((job.completedAt.getTime() - job.startedAt.getTime()) / 1000);
    }
    return this.jobRepo.save(job);
  }

  async fail(id: string, errorMessage: string): Promise<TerraformJob> {
    const job = await this.findOne(id);
    job.status = 'failed';
    job.completedAt = new Date();
    job.errorMessage = errorMessage;
    if (job.startedAt) {
      job.duration = Math.floor((job.completedAt.getTime() - job.startedAt.getTime()) / 1000);
    }
    return this.jobRepo.save(job);
  }

  async cancel(id: string, cancelledBy?: string): Promise<TerraformJob> {
    const job = await this.findOne(id);
    job.status = 'cancelled';
    job.cancelledAt = new Date();
    job.cancelledBy = cancelledBy;
    if (job.startedAt) {
      job.duration = Math.floor((job.cancelledAt.getTime() - job.startedAt.getTime()) / 1000);
    }
    return this.jobRepo.save(job);
  }

  async getStats() {
    const stats = await this.jobRepo
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('job.operation', 'operation')
      .addSelect('COUNT(*)', 'count')
      .groupBy('job.status')
      .addGroupBy('job.operation')
      .getRawMany();

    const running = await this.jobRepo.count({ where: { status: 'running' } });
    const pending = await this.jobRepo.count({ where: { status: 'pending' } });

    return {
      byStatusAndOperation: stats,
      running,
      pending,
    };
  }
}
