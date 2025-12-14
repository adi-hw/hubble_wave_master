import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { EmptyState } from '../../../components/ui/EmptyState';

interface WorkflowDefinition {
  id: string;
  code?: string;
  name: string;
  slug: string;
  description?: string;
  category?: string;
  triggerType: string;
  executionMode: string;
  timeoutMinutes: number;
  source: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

const TRIGGER_LABELS: Record<string, { label: string; icon: string }> = {
  record_event: { label: 'Record Event', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4' },
  schedule: { label: 'Schedule', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  manual: { label: 'Manual', icon: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122' },
  api: { label: 'API', icon: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4' },
  approval_response: { label: 'Approval', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
};

const CATEGORY_COLORS: Record<string, string> = {
  approval: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  automation: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  notification: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  integration: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
};

export function WorkflowsPage() {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterTrigger, setFilterTrigger] = useState<string>('');

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const response = await fetch('/api/metadata/workflows');
      if (response.ok) {
        const data = await response.json();
        setWorkflows(data);
      }
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (workflow: WorkflowDefinition) => {
    try {
      const response = await fetch(`/api/metadata/workflows/${workflow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !workflow.isActive }),
      });
      if (response.ok) {
        setWorkflows(workflows.map(w => w.id === workflow.id ? { ...w, isActive: !w.isActive } : w));
      }
    } catch (error) {
      console.error('Failed to toggle workflow:', error);
    }
  };

  const filteredWorkflows = workflows.filter(workflow => {
    const matchesSearch = !search ||
      workflow.name.toLowerCase().includes(search.toLowerCase()) ||
      workflow.code?.toLowerCase().includes(search.toLowerCase()) ||
      workflow.slug.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !filterCategory || workflow.category === filterCategory;
    const matchesTrigger = !filterTrigger || workflow.triggerType === filterTrigger;
    return matchesSearch && matchesCategory && matchesTrigger;
  });

  const categories = [...new Set(workflows.filter(w => w.category).map(w => w.category!))].sort();

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
            Workflows
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Design and manage automated multi-step processes
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/automations/workflows/new')}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Workflow
        </button>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
            ))}
          </select>
          <select
            value={filterTrigger}
            onChange={(e) => setFilterTrigger(e.target.value)}
            className="block w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All Triggers</option>
            {Object.entries(TRIGGER_LABELS).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Workflows Grid */}
      {filteredWorkflows.length === 0 ? (
        <EmptyState
          title="No workflows found"
          description={search || filterCategory || filterTrigger
            ? "Try adjusting your filters"
            : "Create your first workflow to automate processes"}
          actionLabel="Create Workflow"
          onAction={() => navigate('/admin/automations/workflows/new')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWorkflows.map(workflow => {
            const trigger = TRIGGER_LABELS[workflow.triggerType] || { label: workflow.triggerType, icon: 'M13 10V3L4 14h7v7l9-11h-7z' };

            return (
              <Card
                key={workflow.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/admin/automations/workflows/${workflow.id}`)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className={`flex-shrink-0 p-2.5 rounded-lg ${
                      workflow.isActive
                        ? 'bg-indigo-100 dark:bg-indigo-900/30'
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      <svg
                        className={`w-5 h-5 ${
                          workflow.isActive
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-400'
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={trigger.icon} />
                      </svg>
                    </div>
                    <div className="flex items-center space-x-2">
                      {workflow.isSystem && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          System
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActive(workflow);
                        }}
                        disabled={workflow.isSystem}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          workflow.isActive ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'
                        } ${workflow.isSystem ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          workflow.isActive ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-base font-medium text-gray-900 dark:text-white">
                      {workflow.name}
                    </h3>
                    {workflow.description && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                        {workflow.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={trigger.icon} />
                      </svg>
                      {trigger.label}
                    </span>
                    {workflow.category && (
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${CATEGORY_COLORS[workflow.category] || 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>
                        {workflow.category}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      workflow.executionMode === 'sync'
                        ? 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    }`}>
                      {workflow.executionMode}
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{workflow.code || workflow.slug}</span>
                    <span>{workflow.timeoutMinutes}m timeout</span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
