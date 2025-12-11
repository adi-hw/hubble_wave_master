import { useState, useEffect, useCallback } from 'react';
import { businessRulesApi } from '../services/admin-config.service';
import type { BusinessRule, ListResponse } from '../types';

interface UseBusinessRulesListOptions {
  targetTable?: string;
  ruleType?: string;
  active?: boolean;
  enabled?: boolean;
}

interface UseBusinessRulesListReturn {
  rules: BusinessRule[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to list business rules with optional filters
 */
export function useBusinessRulesList(
  options: UseBusinessRulesListOptions = {}
): UseBusinessRulesListReturn {
  const { targetTable, ruleType, active, enabled = true } = options;
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRules = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);
      const response: ListResponse<BusinessRule> = await businessRulesApi.list({
        targetTable,
        ruleType,
        active,
      });
      setRules(response.data);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load business rules');
    } finally {
      setLoading(false);
    }
  }, [targetTable, ruleType, active, enabled]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  return {
    rules,
    total,
    loading,
    error,
    refetch: fetchRules,
  };
}

interface UseBusinessRuleOptions {
  enabled?: boolean;
}

interface UseBusinessRuleReturn {
  rule: BusinessRule | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get a single business rule by ID
 */
export function useBusinessRule(
  id: string | null,
  options: UseBusinessRuleOptions = {}
): UseBusinessRuleReturn {
  const { enabled = true } = options;
  const [rule, setRule] = useState<BusinessRule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRule = useCallback(async () => {
    if (!enabled || !id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await businessRulesApi.get(id);
      setRule(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load business rule');
    } finally {
      setLoading(false);
    }
  }, [id, enabled]);

  useEffect(() => {
    fetchRule();
  }, [fetchRule]);

  return {
    rule,
    loading,
    error,
    refetch: fetchRule,
  };
}

type CreateBusinessRuleDto = Omit<BusinessRule, 'id' | 'createdAt' | 'updatedAt'>;
type UpdateBusinessRuleDto = Partial<BusinessRule>;

interface MutationState {
  loading: boolean;
  error: string | null;
}

interface TestResult {
  passed: boolean;
  result: any;
  error?: string;
}

interface UseBusinessRuleMutationsReturn {
  createRule: (data: CreateBusinessRuleDto) => Promise<BusinessRule | null>;
  updateRule: (id: string, data: UpdateBusinessRuleDto) => Promise<BusinessRule | null>;
  deleteRule: (id: string) => Promise<boolean>;
  toggleRule: (id: string) => Promise<{ id: string; isActive: boolean } | null>;
  testRule: (id: string, testData: Record<string, any>) => Promise<TestResult | null>;
  createState: MutationState;
  updateState: MutationState;
  deleteState: MutationState;
  toggleState: MutationState;
  testState: MutationState;
}

/**
 * Hook for business rule mutations (create, update, delete, test)
 */
export function useBusinessRuleMutations(): UseBusinessRuleMutationsReturn {
  const [createState, setCreateState] = useState<MutationState>({ loading: false, error: null });
  const [updateState, setUpdateState] = useState<MutationState>({ loading: false, error: null });
  const [deleteState, setDeleteState] = useState<MutationState>({ loading: false, error: null });
  const [toggleState, setToggleState] = useState<MutationState>({ loading: false, error: null });
  const [testState, setTestState] = useState<MutationState>({ loading: false, error: null });

  const createRule = useCallback(
    async (data: CreateBusinessRuleDto): Promise<BusinessRule | null> => {
      try {
        setCreateState({ loading: true, error: null });
        const result = await businessRulesApi.create(data);
        setCreateState({ loading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to create business rule';
        setCreateState({ loading: false, error });
        return null;
      }
    },
    []
  );

  const updateRule = useCallback(
    async (id: string, data: UpdateBusinessRuleDto): Promise<BusinessRule | null> => {
      try {
        setUpdateState({ loading: true, error: null });
        const result = await businessRulesApi.update(id, data);
        setUpdateState({ loading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to update business rule';
        setUpdateState({ loading: false, error });
        return null;
      }
    },
    []
  );

  const deleteRule = useCallback(async (id: string): Promise<boolean> => {
    try {
      setDeleteState({ loading: true, error: null });
      const result = await businessRulesApi.delete(id);
      setDeleteState({ loading: false, error: null });
      return result.success;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to delete business rule';
      setDeleteState({ loading: false, error });
      return false;
    }
  }, []);

  const toggleRule = useCallback(async (id: string): Promise<{ id: string; isActive: boolean } | null> => {
    try {
      setToggleState({ loading: true, error: null });
      const result = await businessRulesApi.toggle(id);
      setToggleState({ loading: false, error: null });
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to toggle business rule';
      setToggleState({ loading: false, error });
      return null;
    }
  }, []);

  const testRule = useCallback(
    async (id: string, testData: Record<string, any>): Promise<TestResult | null> => {
      try {
        setTestState({ loading: true, error: null });
        const result = await businessRulesApi.test(id, testData);
        setTestState({ loading: false, error: null });
        return result;
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Failed to test business rule';
        setTestState({ loading: false, error });
        return null;
      }
    },
    []
  );

  return {
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    testRule,
    createState,
    updateState,
    deleteState,
    toggleState,
    testState,
  };
}

/**
 * Hook to get rules grouped by rule type
 */
export function useBusinessRulesGroupedByType(
  options: Omit<UseBusinessRulesListOptions, 'ruleType'> = {}
): {
  groupedRules: Map<string, BusinessRule[]>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const { rules, loading, error, refetch } = useBusinessRulesList(options);

  const groupedRules = rules.reduce((groups, rule) => {
    const trigger = rule.trigger;
    const existing = groups.get(trigger) || [];
    groups.set(trigger, [...existing, rule]);
    return groups;
  }, new Map<string, BusinessRule[]>());

  return {
    groupedRules,
    loading,
    error,
    refetch,
  };
}

/**
 * Hook to get rules for a specific table
 */
export function useTableBusinessRules(
  tableCode: string,
  options: Omit<UseBusinessRulesListOptions, 'targetTable'> = {}
): UseBusinessRulesListReturn {
  return useBusinessRulesList({
    ...options,
    targetTable: tableCode,
  });
}
