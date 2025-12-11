import { Injectable } from '@nestjs/common';
import { AbacPolicy } from '@eam-platform/platform-db';
import { TenantDbService } from '@eam-platform/tenant-db';

type Context = Record<string, any>;
type AbacCondition = {
  equals?: Record<string, unknown>;
  in?: Record<string, unknown>;
};

@Injectable()
export class AbacService {
  constructor(
    private readonly tenantDbService: TenantDbService,
  ) {}

  async isAllowed(
    tenantId: string | null,
    resource: string,
    action: string,
    context: Context,
    resourceType: 'table' | 'field' | 'action' = 'action',
  ) {
    const normalizedAction = action === 'write' ? 'update' : action;
    if (!tenantId) {
      // no tenant context -> allow (nothing to evaluate)
      return true;
    }

    const policyRepo = await this.tenantDbService.getRepository(tenantId, AbacPolicy);
    const policies = await policyRepo.find({
      where: [
        { tenantId, resource, action: normalizedAction, resourceType, isEnabled: true },
        { tenantId: null as any, resource, action: normalizedAction, resourceType, isEnabled: true },
      ],
      order: { priority: 'ASC' },
    });

    // Default allow if no policy exists
    if (!policies.length) return true;

    for (const policy of policies) {
      if (!policy.isEnabled) continue;

      const subjectContext = {
        subject: context?.user || context?.subject || {},
        ...context,
      };

      const subjectMatch = this.matches(policy.subjectFilter as any, subjectContext);
      const conditionMatch = this.matches(policy.condition as any, context);

      if (subjectMatch && conditionMatch) {
        if (policy.effect === 'ALLOW') return true;
        if (policy.effect === 'DENY') return false;
      }
    }

    return false;
  }

  private matches(conditions: AbacCondition | undefined, context: Context) {
    if (!conditions) return true;
    if (conditions.equals) {
      for (const [key, expected] of Object.entries(conditions.equals)) {
        const actual = this.readContext(context, key);
        if (actual !== expected) return false;
      }
    }
    if (conditions.in) {
      for (const [key, expectedList] of Object.entries(conditions.in)) {
        const actual = this.readContext(context, key);
        const values = Array.isArray(expectedList) ? expectedList : [expectedList];
        if (!values.includes(actual as never)) return false;
      }
    }
    return true;
  }

  private readContext(ctx: Context, path: string): unknown {
    return path.split('.').reduce((acc, segment) => (acc ? acc[segment] : undefined), ctx);
  }
}
