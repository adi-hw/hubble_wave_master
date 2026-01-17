import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer, Instance } from '@hubblewave/control-plane-db';

export interface PlatformMetrics {
  customers: {
    total: number;
    active: number;
    trial: number;
    byTier: Record<string, number>;
    totalUsers: number;
    totalAssets: number;
  };
  instances: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
    provisioning: number;
    byEnvironment: Record<string, number>;
    byRegion: Record<string, number>;
  };
  revenue: {
    totalMrr: number;
    avgMrr: number;
  };
  resources: {
    avgCpu: number;
    avgMemory: number;
    avgDisk: number;
    avgNetwork: number;
  };
}

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    @InjectRepository(Instance)
    private readonly instanceRepo: Repository<Instance>,
  ) {}

  async getPlatformMetrics(): Promise<PlatformMetrics> {
    // Customer metrics
    const customerStats = await this.customerRepo
      .createQueryBuilder('customer')
      .select('customer.status', 'status')
      .addSelect('customer.tier', 'tier')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(customer.mrr)', 'totalMrr')
      .where('customer.deleted_at IS NULL')
      .groupBy('customer.status')
      .addGroupBy('customer.tier')
      .getRawMany();

    const totalCustomers = await this.customerRepo.count({ where: { deletedAt: undefined } });
    const activeCustomers = await this.customerRepo.count({ where: { status: 'active', deletedAt: undefined } });
    const trialCustomers = await this.customerRepo.count({ where: { status: 'trial', deletedAt: undefined } });

    const customerTotals = await this.customerRepo
      .createQueryBuilder('customer')
      .select('SUM(customer.total_users)', 'totalUsers')
      .addSelect('SUM(customer.total_assets)', 'totalAssets')
      .where('customer.deleted_at IS NULL')
      .getRawOne();

    const byTier = customerStats.reduce((acc, s) => {
      acc[s.tier] = (acc[s.tier] || 0) + parseInt(s.count);
      return acc;
    }, {} as Record<string, number>);

    const totalMrr = customerStats.reduce((sum, s) => sum + (parseInt(s.totalMrr) || 0), 0);

    // Instance metrics
    const instanceStats = await this.instanceRepo
      .createQueryBuilder('instance')
      .select('instance.health', 'health')
      .addSelect('instance.environment', 'environment')
      .addSelect('instance.region', 'region')
      .addSelect('COUNT(*)', 'count')
      .where('instance.deleted_at IS NULL')
      .groupBy('instance.health')
      .addGroupBy('instance.environment')
      .addGroupBy('instance.region')
      .getRawMany();

    const totalInstances = await this.instanceRepo.count({ where: { deletedAt: undefined } });
    const healthyInstances = await this.instanceRepo.count({ where: { health: 'healthy', deletedAt: undefined } });
    const degradedInstances = await this.instanceRepo.count({ where: { health: 'degraded', deletedAt: undefined } });
    const unhealthyInstances = await this.instanceRepo.count({ where: { health: 'unhealthy', deletedAt: undefined } });
    const unknownInstances = await this.instanceRepo.count({ where: { health: 'unknown', deletedAt: undefined } });
    const provisioningInstances = await this.instanceRepo.count({ where: { status: 'provisioning', deletedAt: undefined } });

    const byEnvironment = instanceStats.reduce((acc, s) => {
      acc[s.environment] = (acc[s.environment] || 0) + parseInt(s.count);
      return acc;
    }, {} as Record<string, number>);

    const byRegion = instanceStats.reduce((acc, s) => {
      acc[s.region] = (acc[s.region] || 0) + parseInt(s.count);
      return acc;
    }, {} as Record<string, number>);

    // Resource metrics (averaged from instances with metrics)
    const resourceAverages = await this.instanceRepo
      .createQueryBuilder('instance')
      .select("AVG((instance.resource_metrics->>'cpu_usage')::float)", 'avgCpu')
      .addSelect("AVG((instance.resource_metrics->>'memory_usage')::float)", 'avgMemory')
      .addSelect("AVG((instance.resource_metrics->>'disk_usage')::float)", 'avgDisk')
      .addSelect("AVG((instance.resource_metrics->>'network_io')::float)", 'avgNetwork')
      .where('instance.deleted_at IS NULL')
      .andWhere("instance.resource_metrics->>'cpu_usage' IS NOT NULL")
      .getRawOne();

    return {
      customers: {
        total: totalCustomers,
        active: activeCustomers,
        trial: trialCustomers,
        byTier,
        totalUsers: parseInt(customerTotals?.totalUsers) || 0,
        totalAssets: parseInt(customerTotals?.totalAssets) || 0,
      },
      instances: {
        total: totalInstances,
        healthy: healthyInstances,
        degraded: degradedInstances,
        unhealthy: unhealthyInstances,
        unknown: unknownInstances,
        provisioning: provisioningInstances,
        byEnvironment,
        byRegion,
      },
      revenue: {
        totalMrr,
        avgMrr: totalCustomers > 0 ? Math.round(totalMrr / totalCustomers) : 0,
      },
      resources: {
        avgCpu: parseFloat(resourceAverages?.avgCpu) || 0,
        avgMemory: parseFloat(resourceAverages?.avgMemory) || 0,
        avgDisk: parseFloat(resourceAverages?.avgDisk) || 0,
        avgNetwork: parseFloat(resourceAverages?.avgNetwork) || 0,
      },
    };
  }

  async getTopInstancesByLoad(limit = 10) {
    return this.instanceRepo
      .createQueryBuilder('instance')
      .leftJoinAndSelect('instance.customer', 'customer')
      .where('instance.deleted_at IS NULL')
      .andWhere("instance.resource_metrics->>'cpu_usage' IS NOT NULL")
      .orderBy("(instance.resource_metrics->>'cpu_usage')::float", 'DESC')
      .limit(limit)
      .getMany();
  }

  async getRecentActivity(limit = 20) {
    const recentInstances = await this.instanceRepo
      .createQueryBuilder('instance')
      .leftJoinAndSelect('instance.customer', 'customer')
      .where('instance.deleted_at IS NULL')
      .orderBy('instance.updated_at', 'DESC')
      .limit(limit)
      .getMany();

    return recentInstances.map((i) => ({
      type: i.status === 'provisioning' ? 'provisioning' : 'update',
      instanceId: i.id,
      customerName: i.customer?.name,
      environment: i.environment,
      timestamp: i.updatedAt,
    }));
  }
}
