import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Customer, CustomerSettings } from '@hubblewave/control-plane-db';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryParams } from './customers.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly auditService: AuditService,
  ) {}

  async findAll(params: CustomerQueryParams = {}) {
    const { search, status, tier, page = 1, limit = 50 } = params;

    let query = this.customerRepo.createQueryBuilder('customer')
      .where('customer.deleted_at IS NULL');

    if (search) {
      query = query.andWhere(
        '(customer.name ILIKE :search OR customer.code ILIKE :search OR customer.primary_contact_email ILIKE :search OR customer.primary_contact_name ILIKE :search)',
        { search: `%${search}%` }
      );
    }
    if (status) {
      query = query.andWhere('customer.status = :status', { status });
    }
    if (tier) {
      query = query.andWhere('customer.tier = :tier', { tier });
    }

    const [customers, total] = await query
      .leftJoinAndSelect('customer.instances', 'instances')
      .orderBy('customer.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: customers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['instances', 'licenses'],
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return customer;
  }

  async findByCode(code: string): Promise<Customer | null> {
    return this.customerRepo.findOne({
      where: { code, deletedAt: IsNull() },
      relations: ['instances'],
    });
  }

  async create(dto: CreateCustomerDto, createdBy?: string): Promise<Customer> {
    const defaultSettings: CustomerSettings = {
      features: {
        ai_assistant: true,
        advanced_analytics: false,
        custom_integrations: false,
        mobile_app: true,
        sso: false,
        audit_logs: true,
      },
      security: {
        mfa_required: false,
        ip_whitelist: [],
        session_timeout: 120,
        password_policy: 'standard',
      },
      notifications: {
        email_alerts: true,
        slack_integration: false,
        webhook_url: '',
      },
      backup: {
        frequency: 'daily',
        retention_days: 30,
        cross_region: false,
      },
      api: {
        rate_limit: 2000,
        burst_limit: 100,
      },
      branding: {
        primary_color: '',
        logo_url: '',
        custom_domain: '',
      },
    };

    const customer = this.customerRepo.create({
      ...dto,
      settings: { ...defaultSettings, ...dto.settings },
      createdBy,
    });

    const saved = await this.customerRepo.save(customer);
    await this.auditService.log('customer.created', `Created customer ${saved.name}`, {
      customerId: saved.id,
      actor: createdBy || 'system',
      target: saved.id,
      targetType: 'customer',
      metadata: { code: saved.code, tier: saved.tier, status: saved.status },
    });
    return saved;
  }

  async update(id: string, dto: UpdateCustomerDto, updatedBy?: string): Promise<Customer> {
    const customer = await this.findOne(id);

    if (dto.settings) {
      dto.settings = { ...customer.settings, ...dto.settings } as CustomerSettings;
    }

    Object.assign(customer, dto, { updatedBy });

    const saved = await this.customerRepo.save(customer);
    await this.auditService.log('customer.updated', `Updated customer ${saved.name}`, {
      customerId: saved.id,
      actor: updatedBy || 'system',
      target: saved.id,
      targetType: 'customer',
      metadata: { status: saved.status, tier: saved.tier },
    });
    return saved;
  }

  async updateSettings(id: string, settings: Partial<CustomerSettings>, updatedBy?: string): Promise<Customer> {
    const customer = await this.findOne(id);

    customer.settings = {
      ...customer.settings,
      ...settings,
    } as CustomerSettings;
    customer.updatedBy = updatedBy;

    return this.customerRepo.save(customer);
  }

  async delete(id: string, deletedBy?: string): Promise<void> {
    const customer = await this.findOne(id);
    customer.deletedAt = new Date();
    customer.updatedBy = deletedBy;
    await this.customerRepo.save(customer);
    await this.auditService.log('customer.deleted', `Deleted customer ${customer.name}`, {
      customerId: customer.id,
      actor: deletedBy || 'system',
      target: customer.id,
      targetType: 'customer',
    });
  }

  async getStats() {
    const stats = await this.customerRepo
      .createQueryBuilder('customer')
      .select('customer.status', 'status')
      .addSelect('customer.tier', 'tier')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(customer.mrr)', 'totalMrr')
      .addSelect('SUM(customer.total_users)', 'totalUsers')
      .addSelect('SUM(customer.total_assets)', 'totalAssets')
      .where('customer.deleted_at IS NULL')
      .groupBy('customer.status')
      .addGroupBy('customer.tier')
      .getRawMany();

    const totals = await this.customerRepo
      .createQueryBuilder('customer')
      .select('COUNT(*)', 'totalCustomers')
      .addSelect('SUM(customer.mrr)', 'totalMrr')
      .addSelect('SUM(customer.total_users)', 'totalUsers')
      .addSelect('SUM(customer.total_assets)', 'totalAssets')
      .where('customer.deleted_at IS NULL')
      .getRawOne();

    return {
      byStatus: stats,
      totals: {
        customers: parseInt(totals.totalCustomers) || 0,
        mrr: parseInt(totals.totalMrr) || 0,
        users: parseInt(totals.totalUsers) || 0,
        assets: parseInt(totals.totalAssets) || 0,
      },
    };
  }
}
