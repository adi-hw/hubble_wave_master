/**
 * ProcessFlowsListPage
 * HubbleWave Platform - Phase 4
 *
 * Process flow management list page.
 */

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  GitBranch,
  Play,
  Pause,
  Copy,
  Trash2,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../../components/ui/glass/GlassCard';
import { GlassButton } from '../../components/ui/glass/GlassButton';
import { GlassInput } from '../../components/ui/glass/GlassInput';
import { GlassModal } from '../../components/ui/glass/GlassModal';
import { Badge } from '../../components/ui/Badge';
import { processFlowsService } from '../../services/process-flows.service';

interface ProcessFlowDefinition {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  triggerType:
    | 'record_created'
    | 'record_updated'
    | 'property_changed'
    | 'scheduled'
    | 'manual'
    | 'ava_initiated'
    | 'metric_threshold'
    | 'service_catalog'
    | 'webhook';
  collectionId?: string;
  collectionCode?: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  lastExecutedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const triggerTypeLabels: Record<string, { label: string; color: string }> = {
  record_created: { label: 'On Create', color: 'bg-success-subtle text-success-text' },
  record_updated: { label: 'On Update', color: 'bg-info-subtle text-info-text' },
  property_changed: { label: 'Property Change', color: 'bg-accent text-accent-foreground' },
  scheduled: { label: 'Scheduled', color: 'bg-warning-subtle text-warning-text' },
  manual: { label: 'Manual', color: 'bg-muted text-muted-foreground' },
  ava_initiated: { label: 'AVA', color: 'bg-purple-100 text-purple-800' },
  metric_threshold: { label: 'Metric', color: 'bg-cyan-100 text-cyan-800' },
  service_catalog: { label: 'Catalog', color: 'bg-emerald-100 text-emerald-800' },
  webhook: { label: 'Webhook', color: 'bg-amber-100 text-amber-800' },
};

export const ProcessFlowsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [processFlows, setProcessFlows] = useState<ProcessFlowDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedProcessFlow, setSelectedProcessFlow] = useState<ProcessFlowDefinition | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchProcessFlows();
  }, [activeFilter]);

  const fetchProcessFlows = async () => {
    setLoading(true);
    try {
      const filters: { active?: boolean } = {};
      if (activeFilter !== 'all') {
        filters.active = activeFilter === 'active';
      }

      // The service-side type omits a few list-only stat fields the
      // server still returns (executionCount, lastExecutedAt, etc.); a
      // narrow cast bridges the typed list call without redefining
      // the entire shape here.
      const data = (await processFlowsService.list(filters)) as unknown as ProcessFlowDefinition[];
      setProcessFlows(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load process flows';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (processFlow: ProcessFlowDefinition) => {
    try {
      if (processFlow.isActive) {
        await processFlowsService.deactivate(processFlow.id);
      } else {
        await processFlowsService.activate(processFlow.id);
      }
      setProcessFlows(
        processFlows.map((pf) =>
          pf.id === processFlow.id ? { ...pf, isActive: !pf.isActive } : pf
        )
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle process flow';
      setError(msg);
    }
  };

  const handleDuplicate = async (processFlow: ProcessFlowDefinition) => {
    try {
      const newCode = `${processFlow.code}_copy_${Date.now()}`;
      const created = (await processFlowsService.duplicate(processFlow.id, newCode)) as unknown as ProcessFlowDefinition;
      setProcessFlows([...processFlows, created]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to duplicate process flow';
      setError(msg);
    }
  };

  const handleDelete = async () => {
    if (!selectedProcessFlow) return;

    try {
      await processFlowsService.delete(selectedProcessFlow.id);
      setProcessFlows(processFlows.filter((pf) => pf.id !== selectedProcessFlow.id));
      setShowDeleteModal(false);
      setSelectedProcessFlow(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete process flow';
      setError(msg);
    }
  };

  const filteredProcessFlows = processFlows.filter((processFlow) =>
    processFlow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    processFlow.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {error ? (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive-text"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-destructive-text hover:opacity-80"
            aria-label="Dismiss error"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Process Flows
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Model multi-step business processes as executable flows
          </p>
        </div>
        <GlassButton
          onClick={() => navigate('/process-flows/new')}
          variant="solid"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Process Flow
        </GlassButton>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 max-w-md">
          <GlassInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search process flows..."
            leftAddon={<Search className="h-4 w-4" />}
          />
        </div>

        <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
          {(['all', 'active', 'inactive'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeFilter === filter
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Process Flows Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : filteredProcessFlows.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <GitBranch className="h-12 w-12 text-muted-foreground/70 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchQuery ? 'No process flows found' : 'Create your first process flow'}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {searchQuery
              ? 'Try adjusting your search criteria'
              : 'Process Flows model structured, multi-step business processes — create one to get started.'}
          </p>
          {!searchQuery && (
            <GlassButton
              onClick={() => navigate('/process-flows/new')}
              variant="solid"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Process Flow
            </GlassButton>
          )}
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProcessFlows.map((processFlow) => (
            <GlassCard
              key={processFlow.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/process-flows/${processFlow.id}`)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-lg ${
                      processFlow.isActive
                        ? 'bg-success-subtle'
                        : 'bg-muted'
                    }`}
                  >
                    <GitBranch
                      className={`h-5 w-5 ${
                        processFlow.isActive
                          ? 'text-success-text'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">
                      {processFlow.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {processFlow.code}
                    </p>
                  </div>
                </div>
                <Badge
                  className={triggerTypeLabels[processFlow.triggerType]?.color || ''}
                >
                  {triggerTypeLabels[processFlow.triggerType]?.label || processFlow.triggerType}
                </Badge>
              </div>

              {/* Description */}
              {processFlow.description && (
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {processFlow.description}
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <BarChart3 className="h-4 w-4" />
                  <span>{processFlow.executionCount}</span>
                </div>
                <div className="flex items-center gap-1 text-success-text">
                  <CheckCircle className="h-4 w-4" />
                  <span>{processFlow.successCount}</span>
                </div>
                {processFlow.failureCount > 0 && (
                  <div className="flex items-center gap-1 text-danger-text">
                    <XCircle className="h-4 w-4" />
                    <span>{processFlow.failureCount}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Last run: {formatDate(processFlow.lastExecutedAt)}</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleActive(processFlow);
                    }}
                    className={`p-1.5 rounded-md transition-colors ${
                      processFlow.isActive
                        ? 'text-warning-text hover:bg-warning-subtle'
                        : 'text-success-text hover:bg-success-subtle'
                    }`}
                    title={processFlow.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {processFlow.isActive ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDuplicate(processFlow);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-hover rounded-md transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedProcessFlow(processFlow);
                      setShowDeleteModal(true);
                    }}
                    className="p-1.5 text-muted-foreground hover:text-danger-text hover:bg-danger-subtle rounded-md transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      <GlassModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Process Flow"
      >
        <div className="p-4">
          <div className="flex items-center gap-3 p-4 bg-danger-subtle rounded-lg mb-4">
            <AlertTriangle className="h-5 w-5 text-danger-text" />
            <p className="text-sm text-danger-text">
              This action cannot be undone. All execution history and logs will be permanently removed.
            </p>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Are you sure you want to delete the process flow{' '}
            <strong>{selectedProcessFlow?.name}</strong>?
          </p>
          <div className="flex justify-end gap-3">
            <GlassButton variant="ghost" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </GlassButton>
            <GlassButton variant="danger" onClick={handleDelete}>
              Delete Process Flow
            </GlassButton>
          </div>
        </div>
      </GlassModal>
    </div>
  );
};

export default ProcessFlowsListPage;
