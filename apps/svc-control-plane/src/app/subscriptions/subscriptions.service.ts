import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Customer } from '@hubblewave/control-plane-db';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from './subscriptions.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    return this.customerRepo.find({
      where: { deletedAt: IsNull() },
      select: ['id', 'code', 'name', 'tier', 'status', 'mrr', 'metadata'],
      order: { name: 'ASC' },
    });
  }

  async updateSubscription(customerId: string, dto: UpdateSubscriptionDto, actor?: string) {
    const customer = await this.customerRepo.findOne({ where: { id: customerId, deletedAt: IsNull() } });
    if (!customer) throw new NotFoundException('Customer not found');

    const metadata = (customer.metadata || {}) as any;
    const currentSub = (metadata.subscription || {}) as any;
    metadata.subscription = {
      ...currentSub,
      status: dto.status || currentSub.status || 'active',
      planId: dto.planId || currentSub.planId,
      monthlyAmount: dto.monthlyAmount ?? currentSub.monthlyAmount,
    };
    customer.metadata = metadata;
    if (dto.monthlyAmount !== undefined) {
      customer.mrr = Math.round(dto.monthlyAmount);
    }
    const saved = await this.customerRepo.save(customer);
    await this.auditService.log('subscription.updated', `Updated subscription for customer ${customer.id}`, {
      customerId: customer.id,
      actor: actor || 'system',
      target: customer.id,
      targetType: 'customer',
      metadata: { subscription: metadata.subscription },
    });
    return saved;
  }

  async createSubscription(dto: CreateSubscriptionDto, actor?: string) {
    const customer = await this.customerRepo.findOne({ where: { id: dto.customerId, deletedAt: IsNull() } });
    if (!customer) throw new NotFoundException('Customer not found');
    const metadata = (customer.metadata || {}) as any;
    metadata.subscription = {
      status: 'active',
      planId: dto.planId,
      billingCycle: dto.billingCycle,
      monthlyAmount: dto.monthlyAmount,
      externalId: dto.externalId,
    };
    customer.metadata = metadata;
    customer.mrr = Math.round(dto.monthlyAmount);
    const saved = await this.customerRepo.save(customer);
    await this.auditService.log('subscription.created', `Created subscription for customer ${customer.id}`, {
      customerId: customer.id,
      actor: actor || 'system',
      target: customer.id,
      targetType: 'customer',
      metadata: { subscription: metadata.subscription },
    });
    return saved;
  }
}
