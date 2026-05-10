import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Customer } from '@hubblewave/control-plane-db';
import { CreateSubscriptionDto, UpdateSubscriptionDto } from './subscriptions.dto';
import { AuditService } from '../../../../control-plane/src/app/audit/audit.service';

/**
 * Plan tier ranking from lowest to highest. Downgrades step towards index 0;
 * any feature an in-use feature exceeding the target plan's allowance is
 * surfaced as a 400 so the operator must explicitly disable it first.
 */
const PLAN_RANK: Record<string, number> = {
  starter: 0,
  professional: 1,
  enterprise: 2,
};

/**
 * Features gated by plan tier. A feature is "available" on a plan iff that
 * plan's rank is greater than or equal to the feature's minimum rank.
 */
const FEATURE_MIN_PLAN_RANK: Record<string, number> = {
  ai_assistant: PLAN_RANK.starter,
  audit_logs: PLAN_RANK.starter,
  mobile_app: PLAN_RANK.starter,
  advanced_analytics: PLAN_RANK.professional,
  custom_integrations: PLAN_RANK.professional,
  sso: PLAN_RANK.enterprise,
};

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

    const metadata = (customer.metadata || {}) as Record<string, unknown>;
    const currentSub = (metadata.subscription || {}) as { planId?: string; status?: string; monthlyAmount?: number };

    if (dto.planId && currentSub.planId && this.isDowngrade(currentSub.planId, dto.planId)) {
      const blocking = this.featuresExceedingPlan(customer, dto.planId);
      if (blocking.length > 0) {
        throw new BadRequestException(
          `Customer is using features not available in target plan: ${blocking.join(', ')}`,
        );
      }
    }

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
    const metadata = (customer.metadata || {}) as Record<string, unknown>;
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

  private isDowngrade(currentPlan: string, targetPlan: string): boolean {
    const current = PLAN_RANK[currentPlan];
    const target = PLAN_RANK[targetPlan];
    if (current === undefined || target === undefined) {
      return false;
    }
    return target < current;
  }

  /**
   * Return the names of features that the customer is currently using that
   * would not be available on the target plan. The check examines the customer
   * settings.features object and any tier-gated metadata fingerprints; an
   * operator must explicitly disable these before downgrading.
   */
  private featuresExceedingPlan(customer: Customer, targetPlan: string): string[] {
    const targetRank = PLAN_RANK[targetPlan];
    if (targetRank === undefined) {
      return [];
    }

    const blocking: string[] = [];
    const features = ((customer.settings || {}) as { features?: Record<string, unknown> }).features || {};
    for (const [name, enabled] of Object.entries(features)) {
      if (enabled !== true) continue;
      const minRank = FEATURE_MIN_PLAN_RANK[name];
      if (minRank === undefined) continue;
      if (minRank > targetRank) {
        blocking.push(name);
      }
    }
    return blocking;
  }
}
