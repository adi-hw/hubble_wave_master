/**
 * AutomationsListPage
 * HubbleWave Platform - Phase 3
 *
 * Page displaying a list of automation rules for a collection or globally.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, History, Loader2 } from 'lucide-react';
import { automationApi, Automation } from '../../services/automationApi';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: () => void;
  label: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange, label }) => (
  <label className="inline-flex items-center gap-2 cursor-pointer">
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`toggle-track h-5 w-9 ${checked ? 'toggle-track-on' : ''}`}
    >
      <span
        className={`toggle-thumb inline-block h-4 w-4 transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
    <span className="text-sm text-foreground">
      {label}
    </span>
  </label>
);

const getStatusBadgeClass = (status: string): string => {
  if (status === 'success') {
    return 'bg-success-subtle text-success-text';
  }
  return 'bg-danger-subtle text-danger-text';
};

export const AutomationsListPage: React.FC = () => {
  const { id: collectionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  const isGlobalView = !collectionId;

  useEffect(() => {
    loadAutomations();
  }, [collectionId]);

  const loadAutomations = async () => {
    try {
      const data = await automationApi.getAutomations(collectionId, true);
      setAutomations(data);
    } catch (error) {
      console.error('Failed to load automations', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (automation: Automation) => {
    try {
      await automationApi.toggleActive(automation.id);
      loadAutomations();
    } catch (error) {
      console.error('Failed to toggle automation', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this automation?')) return;
    try {
      await automationApi.deleteAutomation(id);
      loadAutomations();
    } catch (error) {
      console.error('Failed to delete automation', error);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto mt-8 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-muted-foreground">Loading automation rules...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-foreground">
          Automation Rules
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              navigate(
                isGlobalView ? '/automation/logs' : `/studio/collections/${collectionId}/automation-logs`
              )
            }
            className="flex items-center gap-2 px-4 py-2 rounded border border-border text-foreground transition-colors hover:bg-hover"
          >
            <History className="w-4 h-4" />
            <span>Logs</span>
          </button>
          {!isGlobalView && (
            <button
              type="button"
              onClick={() => navigate(`/studio/collections/${collectionId}/automations/new`)}
              className="flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground transition-colors hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              <span>New Automation</span>
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="p-3 text-left text-sm font-semibold text-muted-foreground">
                Name
              </th>
              {isGlobalView && (
                <th className="p-3 text-left text-sm font-semibold text-muted-foreground">
                  Collection
                </th>
              )}
              <th className="p-3 text-left text-sm font-semibold text-muted-foreground">
                Trigger
              </th>
              <th className="p-3 text-left text-sm font-semibold text-muted-foreground">
                Status
              </th>
              <th className="p-3 text-left text-sm font-semibold text-muted-foreground">
                Last Run
              </th>
              <th className="p-3 text-right text-sm font-semibold text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {automations.map((automation) => (
              <tr
                key={automation.id}
                className="border-b border-border transition-colors hover:bg-hover"
              >
                <td className="p-3">
                  <div className="font-medium text-sm text-foreground">
                    {automation.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {automation.actionType}
                  </div>
                </td>
                {isGlobalView && (
                  <td className="p-3 text-sm text-muted-foreground">
                    {automation.collectionId?.slice(0, 8) || '-'}
                  </td>
                )}
                <td className="p-3">
                  <span className="px-2 py-1 text-xs font-medium border border-primary text-primary rounded">
                    {automation.triggerTiming.replace('_', ' ').toUpperCase()}
                  </span>
                  {automation.executionOrder > 0 && (
                    <div className="text-xs mt-1 text-muted-foreground">
                      Order: {automation.executionOrder}
                    </div>
                  )}
                </td>
                <td className="p-3">
                  <ToggleSwitch
                    checked={automation.isActive}
                    onChange={() => handleToggleActive(automation)}
                    label={automation.isActive ? 'Active' : 'Inactive'}
                  />
                </td>
                <td className="p-3">
                  {automation.lastRunAt ? (
                    <div>
                      <div className="text-sm text-foreground">
                        {new Date(automation.lastRunAt).toLocaleString()}
                      </div>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full mt-1 inline-block ${getStatusBadgeClass(automation.lastRunStatus || '')}`}
                      >
                        {automation.lastRunStatus}
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          isGlobalView
                            ? `/automation/${automation.id}`
                            : `/studio/collections/${collectionId}/automations/${automation.id}`
                        )
                      }
                      className="p-2 rounded text-muted-foreground transition-colors hover:bg-hover"
                      aria-label="Edit automation"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(automation.id)}
                      className="p-2 rounded text-danger-text transition-colors hover:bg-danger-subtle"
                      aria-label="Delete automation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {automations.length === 0 && (
              <tr>
                <td
                  colSpan={isGlobalView ? 6 : 5}
                  className="p-8 text-center text-sm text-muted-foreground"
                >
                  {isGlobalView
                    ? 'No automation rules found. To create an automation, go to Studio \u2192 Collections and select a collection.'
                    : 'No automation rules found. Create one to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
