import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  ToggleLeft,
  ToggleRight,
  Edit,
  Trash2,
  FileCode,
  Zap,
  Shield,
  Calculator,
  Database,
  GitBranch,
  RefreshCw,
  Loader2,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '../components/Breadcrumb';
import { SourceIndicator } from '../components/CustomizationBadge';
import { useBusinessRulesList, useBusinessRuleMutations } from '../hooks';
import { Button } from '../../../components/ui';

type RuleType = 'validation' | 'default_value' | 'calculated_field' | 'data_policy' | 'cascade';

const ruleTypeIcons: Record<RuleType, React.FC<{ className?: string }>> = {
  validation: Shield,
  default_value: FileCode,
  calculated_field: Calculator,
  data_policy: Database,
  cascade: GitBranch,
};

const ruleTypeLabels: Record<RuleType, string> = {
  validation: 'Validation',
  default_value: 'Default Value',
  calculated_field: 'Calculated Field',
  data_policy: 'Data Policy',
  cascade: 'Cascade',
};

const ruleTypeColors: Record<RuleType, string> = {
  validation: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
  default_value: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400',
  calculated_field: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 dark:text-purple-400',
  data_policy: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
  cascade: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
};

export const BusinessRulesListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<RuleType | ''>('');
  const [filterTable, setFilterTable] = useState<string>('');

  // Fetch business rules from API
  const { rules, total, loading, error, refetch } = useBusinessRulesList({
    ruleType: filterType || undefined,
    targetTable: filterTable || undefined,
  });

  const { deleteRule, toggleRule, deleteState, toggleState } = useBusinessRuleMutations();

  // Client-side search filter
  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules;
    const lowerQuery = searchQuery.toLowerCase();
    return rules.filter(
      (rule) =>
        rule.name.toLowerCase().includes(lowerQuery) ||
        rule.code.toLowerCase().includes(lowerQuery) ||
        rule.targetTable.toLowerCase().includes(lowerQuery)
    );
  }, [rules, searchQuery]);

  // Get unique tables for filter dropdown
  const uniqueTables = useMemo(() => {
    return [...new Set(rules.map((r) => r.targetTable))].sort();
  }, [rules]);

  const handleToggle = async (ruleId: string) => {
    const result = await toggleRule(ruleId);
    if (result) {
      refetch();
    }
  };

  const handleDelete = async (ruleId: string, ruleName: string) => {
    if (!confirm(`Are you sure you want to delete the rule "${ruleName}"?`)) {
      return;
    }
    const success = await deleteRule(ruleId);
    if (success) {
      refetch();
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Business Rules"
        description="Configure validation, defaults, calculations, and data policies"
        breadcrumbs={[
          { label: 'Studio', href: '/studio' },
          { label: 'Business Rules' },
        ]}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: 'var(--hw-text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              style={{
                backgroundColor: 'var(--hw-surface)',
                borderColor: 'var(--hw-border)',
                color: 'var(--hw-text)',
              }}
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as RuleType | '')}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{
              backgroundColor: 'var(--hw-surface)',
              borderColor: 'var(--hw-border)',
              color: 'var(--hw-text)',
            }}
          >
            <option value="">All Types</option>
            {Object.entries(ruleTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={filterTable}
            onChange={(e) => setFilterTable(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{
              backgroundColor: 'var(--hw-surface)',
              borderColor: 'var(--hw-border)',
              color: 'var(--hw-text)',
            }}
          >
            <option value="">All Tables</option>
            {uniqueTables.map((table) => (
              <option key={table} value={table}>
                {table}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/studio/business-rules/new')}
          >
            <Plus className="h-4 w-4 mr-1" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          className="mb-6 p-4 rounded-xl border flex items-center gap-3"
          style={{
            backgroundColor: 'var(--hw-danger-subtle)',
            borderColor: 'var(--hw-danger)',
            color: 'var(--hw-danger)',
          }}
        >
          <XCircle className="h-5 w-5 flex-shrink-0" />
          <div>
            <div className="font-medium">Failed to load business rules</div>
            <div className="text-sm opacity-80">{error}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="ml-auto">
            Retry
          </Button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div
          className="rounded-xl border p-12 text-center"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <Loader2
            className="h-8 w-8 mx-auto mb-3 animate-spin"
            style={{ color: 'var(--hw-text-muted)' }}
          />
          <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
            Loading business rules...
          </p>
        </div>
      )}

      {/* Rules List */}
      {!loading && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <table className="w-full">
            <thead>
              <tr
                className="border-b"
                style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-bg-subtle)' }}
              >
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Rule
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Type
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Table
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Events
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Order
                </th>
                <th
                  className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Status
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--hw-text-muted)' }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map((rule, index) => {
                const ruleType = (rule as any).ruleType as RuleType;
                const TypeIcon = ruleTypeIcons[ruleType] || Zap;
                const triggerEvents = (rule as any).triggerEvents || [];
                return (
                  <tr
                    key={rule.id}
                    className={`transition-colors ${index !== filteredRules.length - 1 ? 'border-b' : ''}`}
                    style={{ borderColor: 'var(--hw-border)' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.backgroundColor = 'var(--hw-bg-subtle)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: 'var(--hw-text)' }}>
                              {rule.name}
                            </span>
                            <SourceIndicator source={rule.source} />
                            {rule.isSystem && (
                              <span
                                className="px-1.5 py-0.5 text-xs font-medium rounded"
                                style={{
                                  backgroundColor: 'var(--hw-bg-subtle)',
                                  color: 'var(--hw-text-muted)',
                                }}
                              >
                                System
                              </span>
                            )}
                          </div>
                          <span className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                            {rule.code}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-sm ${
                          ruleTypeColors[ruleType] || ''
                        }`}
                      >
                        <TypeIcon className="h-3.5 w-3.5" />
                        {ruleTypeLabels[ruleType] || ruleType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <code
                        className="px-2 py-1 text-sm rounded"
                        style={{
                          backgroundColor: 'var(--hw-bg-subtle)',
                          color: 'var(--hw-text)',
                        }}
                      >
                        {rule.targetTable}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {triggerEvents.map((event: string) => (
                          <span
                            key={event}
                            className="px-2 py-0.5 text-xs rounded"
                            style={{
                              backgroundColor: 'var(--hw-bg-subtle)',
                              color: 'var(--hw-text-muted)',
                            }}
                          >
                            {event}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--hw-text-secondary)' }}>
                      {rule.executionOrder}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggle(rule.id)}
                        disabled={toggleState.loading || rule.isSystem}
                        className={`transition-colors ${rule.isSystem ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        title={rule.isSystem ? 'System rules cannot be toggled' : 'Toggle active status'}
                      >
                        {rule.isActive ? (
                          <ToggleRight className="h-6 w-6 text-green-600 dark:text-green-400" />
                        ) : (
                          <ToggleLeft className="h-6 w-6" style={{ color: 'var(--hw-text-muted)' }} />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/studio/business-rules/${rule.id}`)}
                          className="p-1.5 rounded transition-colors hover:bg-primary-50 dark:hover:bg-primary-900/20"
                          style={{ color: 'var(--hw-text-muted)' }}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        {!rule.isSystem && (
                          <button
                            onClick={() => handleDelete(rule.id, rule.name)}
                            disabled={deleteState.loading}
                            className="p-1.5 rounded transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
                            style={{ color: 'var(--hw-text-muted)' }}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredRules.length === 0 && !loading && (
            <div className="text-center py-12">
              <Zap
                className="h-12 w-12 mx-auto mb-3 opacity-50"
                style={{ color: 'var(--hw-text-muted)' }}
              />
              <p className="text-lg font-medium" style={{ color: 'var(--hw-text)' }}>
                No business rules found
              </p>
              <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                {searchQuery || filterType || filterTable
                  ? 'Try adjusting your filters'
                  : 'Create your first business rule'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pagination info */}
      {!loading && filteredRules.length > 0 && (
        <div className="mt-4 text-sm" style={{ color: 'var(--hw-text-muted)' }}>
          Showing {filteredRules.length} of {total} rule{total !== 1 ? 's' : ''}
        </div>
      )}

      {/* Rule Types Legend */}
      <div
        className="mt-6 p-4 rounded-lg"
        style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
      >
        <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--hw-text)' }}>
          Rule Types
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span style={{ color: 'var(--hw-text-muted)' }}>Validation - Enforce data integrity</span>
          </div>
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span style={{ color: 'var(--hw-text-muted)' }}>Default Value - Auto-populate fields</span>
          </div>
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span style={{ color: 'var(--hw-text-muted)' }}>Calculated - Compute values</span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span style={{ color: 'var(--hw-text-muted)' }}>Data Policy - Security rules</span>
          </div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-green-600 dark:text-green-400" />
            <span style={{ color: 'var(--hw-text-muted)' }}>Cascade - Propagate changes</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessRulesListPage;
