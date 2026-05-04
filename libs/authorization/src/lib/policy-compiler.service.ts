import { Injectable } from '@nestjs/common';
import type { AccessConditionData, UserAccessContext } from './types';
import { SPECIAL_VALUES } from './types';
import type { LeafPredicate, SafePredicate } from './abac.service';

@Injectable()
export class PolicyCompilerService {
  compile(condition: AccessConditionData, user: UserAccessContext): SafePredicate[] {
    const predicates: SafePredicate[] = [];

    if (condition.and) {
      for (const item of condition.and) {
        predicates.push(...this.compile(item, user));
      }
    }

    if (condition.or && condition.or.length > 0) {
      if (condition.or.length === 1) {
        predicates.push(...this.compile(condition.or[0], user));
      } else {
        const branches = condition.or.map((c) => this.compile(c, user));
        if (branches.some((b) => b.length === 0)) {
          throw new Error('OR branch compiled to empty predicate set; refusing to fail-open');
        }
        predicates.push({ kind: 'or', branches });
      }
    }

    if (condition.property && condition.operator) {
      const safe = this.conditionToSafePredicate(condition, user);
      if (safe) {
        predicates.push(safe);
      }
    }

    return predicates;
  }

  private conditionToSafePredicate(
    condition: AccessConditionData,
    user: UserAccessContext,
  ): LeafPredicate | null {
    if (!condition.property || !condition.operator) {
      return null;
    }

    const operatorMap: Record<string, LeafPredicate['operator']> = {
      equals: 'eq',
      not_equals: 'neq',
      greater_than: 'gt',
      greater_than_or_equals: 'gte',
      less_than: 'lt',
      less_than_or_equals: 'lte',
      in: 'in',
      not_in: 'not_in',
      is_null: 'is_null',
      is_not_null: 'is_not_null',
    };

    const safeOperator = operatorMap[condition.operator];
    if (!safeOperator) {
      return null;
    }

    const value = condition.value;
    if (typeof value === 'string' && value.startsWith('@')) {
      const contextRefMap: Record<string, string> = {
        '@currentUser': 'userId',
        '@currentUser.id': 'userId',
        '@roles': 'roles',
        '@groups': 'groups',
        '@teams': 'groups',
        '@sites': 'sites',
      };

      const contextRef = contextRefMap[value];
      if (contextRef) {
        return {
          kind: 'leaf',
          field: condition.property,
          operator: safeOperator,
          contextRef,
        };
      }

      const resolvedValue = this.resolveValue(value, user);
      return {
        kind: 'leaf',
        field: condition.property,
        operator: safeOperator,
        value: resolvedValue as string | number | boolean | null,
      };
    }

    return {
      kind: 'leaf',
      field: condition.property,
      operator: safeOperator,
      value: value as string | number | boolean | null,
    };
  }

  private resolveValue(value: unknown, user: UserAccessContext): unknown {
    if (typeof value === 'string' && value.startsWith('@')) {
      const resolver = SPECIAL_VALUES[value];
      if (resolver) {
        return resolver(user);
      }
    }
    return value;
  }
}
