import React, { useState } from 'react';
import {
  Cable,
  Plus,
  Settings,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  ExternalLink,
  Lock,
  Key,
  Globe,
  Database,
  Webhook,
  Server,
  ToggleLeft,
  ToggleRight,
  Clock,
  Activity,
} from 'lucide-react';

type ConnectionType = 'rest_api' | 'graphql' | 'database' | 'oauth2' | 'webhook' | 'sftp';
type ConnectionStatus = 'active' | 'inactive' | 'error';
type AuthType = 'none' | 'basic' | 'api_key' | 'bearer' | 'oauth2' | 'certificate';

interface Connection {
  id: string;
  name: string;
  code: string;
  type: ConnectionType;
  status: ConnectionStatus;
  baseUrl?: string;
  authType: AuthType;
  lastTestedAt?: string;
  testSuccess: boolean;
  lastError?: string;
  isActive: boolean;
}

interface Webhook {
  id: string;
  name: string;
  code: string;
  direction: 'inbound' | 'outbound';
  targetUrl?: string;
  triggerEvents?: string[];
  collectionCode?: string;
  isActive: boolean;
  lastTriggeredAt?: string;
  successRate?: number;
}

const mockConnections: Connection[] = [
  {
    id: '1',
    name: 'Salesforce API',
    code: 'salesforce',
    type: 'oauth2',
    status: 'active',
    baseUrl: 'https://api.salesforce.com/v52.0',
    authType: 'oauth2',
    lastTestedAt: '2024-01-15T10:00:00Z',
    testSuccess: true,
    isActive: true,
  },
  {
    id: '2',
    name: 'Jira Integration',
    code: 'jira',
    type: 'rest_api',
    status: 'active',
    baseUrl: 'https://company.atlassian.net/rest/api/3',
    authType: 'bearer',
    lastTestedAt: '2024-01-15T09:30:00Z',
    testSuccess: true,
    isActive: true,
  },
  {
    id: '3',
    name: 'Data Warehouse',
    code: 'warehouse_db',
    type: 'database',
    status: 'error',
    authType: 'basic',
    lastTestedAt: '2024-01-14T15:00:00Z',
    testSuccess: false,
    lastError: 'Connection timeout after 30s',
    isActive: true,
  },
  {
    id: '4',
    name: 'Backup SFTP',
    code: 'backup_sftp',
    type: 'sftp',
    status: 'inactive',
    baseUrl: 'sftp://backup.company.com',
    authType: 'certificate',
    isActive: false,
    testSuccess: false,
  },
];

const mockWebhooks: Webhook[] = [
  {
    id: '1',
    name: 'Incident Created',
    code: 'incident_created',
    direction: 'outbound',
    targetUrl: 'https://slack.com/api/webhook/...',
    triggerEvents: ['incident.created'],
    collectionCode: 'incident',
    isActive: true,
    lastTriggeredAt: '2024-01-15T10:30:00Z',
    successRate: 98.5,
  },
  {
    id: '2',
    name: 'External Ticket Sync',
    code: 'ticket_sync',
    direction: 'inbound',
    collectionCode: 'incident',
    isActive: true,
    lastTriggeredAt: '2024-01-15T10:15:00Z',
    successRate: 100,
  },
  {
    id: '3',
    name: 'Asset Update Notify',
    code: 'asset_notify',
    direction: 'outbound',
    targetUrl: 'https://api.pagerduty.com/...',
    triggerEvents: ['asset.updated', 'asset.retired'],
    collectionCode: 'asset',
    isActive: false,
    successRate: 95.2,
  },
];

const typeConfig: Record<ConnectionType, { icon: React.ElementType; label: string; color: string }> = {
  rest_api: { icon: Globe, label: 'REST API', color: 'text-blue-500 bg-blue-100' },
  graphql: { icon: Activity, label: 'GraphQL', color: 'text-purple-500 bg-purple-100' },
  database: { icon: Database, label: 'Database', color: 'text-green-500 bg-green-100' },
  oauth2: { icon: Lock, label: 'OAuth 2.0', color: 'text-amber-500 bg-amber-100' },
  webhook: { icon: Webhook, label: 'Webhook', color: 'text-indigo-500 bg-indigo-100' },
  sftp: { icon: Server, label: 'SFTP', color: 'text-slate-500 bg-slate-100' },
};

const statusConfig: Record<ConnectionStatus, { icon: React.ElementType; color: string; label: string }> = {
  active: { icon: CheckCircle, color: 'text-green-500', label: 'Connected' },
  inactive: { icon: ToggleLeft, color: 'text-slate-400', label: 'Inactive' },
  error: { icon: AlertTriangle, color: 'text-red-500', label: 'Error' },
};

const authLabels: Record<AuthType, string> = {
  none: 'None',
  basic: 'Basic Auth',
  api_key: 'API Key',
  bearer: 'Bearer Token',
  oauth2: 'OAuth 2.0',
  certificate: 'Certificate',
};

export const ConnectionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'connections' | 'webhooks'>('connections');
  const [showNewConnection, setShowNewConnection] = useState(false);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            Connections Hub
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage external integrations and webhooks
          </p>
        </div>
        <button
          onClick={() => setShowNewConnection(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Connection
        </button>
      </div>

      {/* New Connection Modal */}
      {showNewConnection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              New Connection
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Connection Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(typeConfig) as [ConnectionType, typeof typeConfig[ConnectionType]][]).map(([type, config]) => {
                    const Icon = config.icon;
                    return (
                      <button
                        key={type}
                        className="flex flex-col items-center gap-2 p-3 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <div className={`p-2 rounded-lg ${config.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          {config.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Production API"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Code (unique identifier)
                </label>
                <input
                  type="text"
                  placeholder="e.g., prod_api"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewConnection(false)}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit mb-6">
        <button
          onClick={() => setActiveTab('connections')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'connections'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <span className="flex items-center gap-2">
            <Cable className="h-4 w-4" />
            Connections
          </span>
        </button>
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'webhooks'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <span className="flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Webhooks
          </span>
        </button>
      </div>

      {/* Connections Tab */}
      {activeTab === 'connections' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockConnections.map((conn) => {
            const TypeConfig = typeConfig[conn.type];
            const StatusConfig = statusConfig[conn.status];
            const TypeIcon = TypeConfig.icon;
            const StatusIcon = StatusConfig.icon;

            return (
              <div
                key={conn.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2.5 rounded-lg ${TypeConfig.color}`}>
                      <TypeIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-900 dark:text-white">
                          {conn.name}
                        </h3>
                        <StatusIcon className={`h-4 w-4 ${StatusConfig.color}`} />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {conn.code}
                      </p>
                      {conn.baseUrl && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate max-w-[250px]">
                          {conn.baseUrl}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    className={`p-1.5 rounded-lg transition-colors ${
                      conn.isActive
                        ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                        : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {conn.isActive ? (
                      <ToggleRight className="h-5 w-5" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-3 mt-4 text-xs text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    {authLabels[conn.authType]}
                  </span>
                  {conn.lastTestedAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Tested {new Date(conn.lastTestedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {conn.status === 'error' && conn.lastError && (
                  <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-xs text-red-600 dark:text-red-400">{conn.lastError}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg">
                    <Play className="h-4 w-4" />
                    Test
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                    <Settings className="h-4 w-4" />
                    Configure
                  </button>
                  <button className="ml-auto p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          {mockWebhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-lg ${
                    webhook.direction === 'inbound'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}>
                    <Webhook className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        {webhook.name}
                      </h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        webhook.direction === 'inbound'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {webhook.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                      </span>
                      {webhook.isActive ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {webhook.code} • {webhook.collectionCode}
                    </p>
                    {webhook.targetUrl && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 truncate max-w-md flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        {webhook.targetUrl}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  className={`p-1.5 rounded-lg transition-colors ${
                    webhook.isActive
                      ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                      : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {webhook.isActive ? (
                    <ToggleRight className="h-5 w-5" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-4 mt-4 text-xs text-slate-500 dark:text-slate-400">
                {webhook.triggerEvents && webhook.triggerEvents.length > 0 && (
                  <span>
                    Events: {webhook.triggerEvents.join(', ')}
                  </span>
                )}
                {webhook.lastTriggeredAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last: {new Date(webhook.lastTriggeredAt).toLocaleString()}
                  </span>
                )}
                {webhook.successRate !== undefined && (
                  <span className={`flex items-center gap-1 ${
                    webhook.successRate >= 95 ? 'text-green-600' : 'text-amber-600'
                  }`}>
                    <Activity className="h-3 w-3" />
                    {webhook.successRate}% success
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg">
                  <RefreshCw className="h-4 w-4" />
                  Test
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  <Activity className="h-4 w-4" />
                  View Logs
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                  <Settings className="h-4 w-4" />
                  Configure
                </button>
                <button className="ml-auto p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
