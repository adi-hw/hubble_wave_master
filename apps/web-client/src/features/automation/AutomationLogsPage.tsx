/**
 * AutomationLogsPage
 * HubbleWave Platform - Phase 3
 *
 * Page displaying execution logs for automation rules within a collection.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowLeft, Loader2 } from 'lucide-react';
import { automationApi, AutomationExecutionLog } from '../../services/automationApi';

interface LogRowProps {
  log: AutomationExecutionLog;
}

const getStatusBadgeClasses = (status: string): string => {
  switch (status) {
    case 'success':
      return 'bg-success-subtle text-success-text';
    case 'error':
      return 'bg-danger-subtle text-danger-text';
    default:
      return 'bg-warning-subtle text-warning-text';
  }
};

const LogRow: React.FC<LogRowProps> = ({ log }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className="border-b border-border transition-colors hover:bg-hover">
        <td className="p-3 text-sm text-foreground">
          {new Date(log.startedAt).toLocaleString()}
        </td>
        <td className="p-3 text-sm text-foreground">
          {log.automationName || 'Unknown'}
        </td>
        <td className="p-3">
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClasses(log.status)}`}
          >
            {log.status}
          </span>
        </td>
        <td className="p-3 text-sm text-muted-foreground">
          {log.durationMs}ms
        </td>
        <td className="p-3">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm text-primary transition-colors hover:opacity-80"
          >
            <span>View Output</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted">
          <td colSpan={5} className="p-4">
            {log.errorMessage && (
              <p className="text-sm mb-2 text-destructive">
                Error: {log.errorMessage}
              </p>
            )}
            <pre className="text-xs p-2 rounded overflow-x-auto bg-card text-muted-foreground">
              {JSON.stringify(log.actionsExecuted, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
};

export const AutomationLogsPage: React.FC = () => {
  const { id: collectionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AutomationExecutionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [collectionId]);

  const loadLogs = async () => {
    if (!collectionId) return;
    try {
      const data = await automationApi.getLogs(collectionId);
      setLogs(data);
    } catch (error) {
      console.error('Failed to load logs', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto mt-8 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-muted-foreground">Loading logs...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto mt-8 px-4">
      <div className="flex items-center mb-6 gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-3 py-2 rounded border border-border text-foreground transition-colors hover:bg-hover"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <h1 className="text-2xl font-semibold text-foreground">
          Execution logs
        </h1>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                Time
              </th>
              <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                Automation
              </th>
              <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                Status
              </th>
              <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                Duration
              </th>
              <th className="p-3 text-left text-sm font-medium text-muted-foreground">
                Details
              </th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
            {logs.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="p-8 text-center text-sm text-muted-foreground"
                >
                  No logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
