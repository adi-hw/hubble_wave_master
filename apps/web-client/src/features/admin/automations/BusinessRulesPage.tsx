import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/ui/EmptyState';
import metadataApi from '../../../services/metadataApi';

interface BusinessRule {
  id: string;
  code: string;
  name: string;
  description?: string;
  targetTable: string;
  trigger: string;
  conditionType: string;
  actionType: string;
  executionOrder: number;
  isActive: boolean;
  isSystem: boolean;
  source: string;
  createdAt: string;
}

const TRIGGER_LABELS: Record<string, string> = {
  before_insert: 'Before Insert',
  after_insert: 'After Insert',
  before_update: 'Before Update',
  after_update: 'After Update',
  before_delete: 'Before Delete',
  after_delete: 'After Delete',
  async: 'Async',
};

const ACTION_LABELS: Record<string, string> = {
  set_value: 'Set Value',
  validate: 'Validate',
  abort: 'Abort',
  script: 'Script',
  workflow: 'Workflow',
  notification: 'Notification',
  api_call: 'API Call',
};

export function BusinessRulesPage() {
  const navigate = useNavigate();
  const [rules, setRules] = useState<BusinessRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTable, setFilterTable] = useState<string>('');
  const [filterTrigger, setFilterTrigger] = useState<string>('');

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await metadataApi.get<BusinessRule[] | { data: BusinessRule[] }>('/admin/business-rules');
      // Handle both array response and wrapped { data: [...] } response
      const data = Array.isArray(response.data) ? response.data : (response.data?.data ?? []);
      setRules(data);
    } catch (error) {
      console.error('Failed to fetch business rules:', error);
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (rule: BusinessRule) => {
    try {
      await metadataApi.patch(`/admin/business-rules/${rule.id}`, { isActive: !rule.isActive });
      setRules(rules.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const filteredRules = rules.filter(rule => {
    const matchesSearch = !search ||
      rule.name.toLowerCase().includes(search.toLowerCase()) ||
      rule.code.toLowerCase().includes(search.toLowerCase()) ||
      rule.targetTable.toLowerCase().includes(search.toLowerCase());
    const matchesTable = !filterTable || rule.targetTable === filterTable;
    const matchesTrigger = !filterTrigger || rule.trigger === filterTrigger;
    return matchesSearch && matchesTable && matchesTrigger;
  });

  const tables = [...new Set(rules.map(r => r.targetTable))].sort();

  // Group rules by table
  const rulesByTable = filteredRules.reduce((acc, rule) => {
    if (!acc[rule.targetTable]) {
      acc[rule.targetTable] = [];
    }
    acc[rule.targetTable].push(rule);
    return acc;
  }, {} as Record<string, BusinessRule[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Business Rules
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure automated logic that runs on record events
          </p>
        </div>
        <button
          onClick={() => navigate('/studio/business-rules/new')}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Rule
        </button>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Search rules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
          <select
            value={filterTable}
            onChange={(e) => setFilterTable(e.target.value)}
            className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All Tables</option>
            {tables.map(table => (
              <option key={table} value={table}>{table}</option>
            ))}
          </select>
          <select
            value={filterTrigger}
            onChange={(e) => setFilterTrigger(e.target.value)}
            className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All Triggers</option>
            {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Rules List */}
      {filteredRules.length === 0 ? (
        <EmptyState
          title="No business rules found"
          description={search || filterTable || filterTrigger
            ? "Try adjusting your filters"
            : "Create your first business rule to automate record operations"}
          actionLabel="Create Rule"
          onAction={() => navigate('/studio/business-rules/new')}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(rulesByTable).sort(([a], [b]) => a.localeCompare(b)).map(([tableName, tableRules]) => (
            <Card key={tableName}>
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {tableName}
                  <span className="ml-2 text-xs text-gray-500">({tableRules.length} rules)</span>
                </h3>
              </div>
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {tableRules.sort((a, b) => a.executionOrder - b.executionOrder).map(rule => (
                  <li
                    key={rule.id}
                    className="px-4 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
                    onClick={() => navigate(`/studio/business-rules/${rule.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <span className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${
                            rule.isActive
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                          }`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {rule.name}
                            </span>
                            {rule.isSystem && (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                                System
                              </span>
                            )}
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              rule.source === 'platform'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                : rule.source === 'module'
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}>
                              {rule.source}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {rule.code}
                            {rule.description && ` - ${rule.description}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex flex-col items-end space-y-1">
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                            {TRIGGER_LABELS[rule.trigger] || rule.trigger}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                            {ACTION_LABELS[rule.actionType] || rule.actionType}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            #{rule.executionOrder}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleActive(rule);
                            }}
                            disabled={rule.isSystem}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                              rule.isActive ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                            } ${rule.isSystem ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              rule.isActive ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
