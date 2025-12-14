import { useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';

type IntegrationType = 'webhooks' | 'api_connections' | 'notification_channels';

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  createdAt: string;
}

interface ApiConnection {
  id: string;
  name: string;
  baseUrl: string;
  authType: string;
  isActive: boolean;
  lastUsedAt?: string;
}

interface NotificationChannelConfig {
  id: string;
  name: string;
  channelType: string;
  isActive: boolean;
  isDefault: boolean;
  lastTestAt?: string;
  lastTestStatus?: string;
}

export function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState<IntegrationType>('webhooks');
  const [search, setSearch] = useState('');

  // Sample data - would be fetched from API
  const [webhooks] = useState<WebhookConfig[]>([
    {
      id: '1',
      name: 'GitHub Webhook',
      url: '/api/webhooks/github',
      events: ['push', 'pull_request'],
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ]);

  const [apiConnections] = useState<ApiConnection[]>([
    {
      id: '1',
      name: 'ServiceNow',
      baseUrl: 'https://instance.service-now.com',
      authType: 'oauth2',
      isActive: true,
    },
  ]);

  const [notificationChannels] = useState<NotificationChannelConfig[]>([
    {
      id: '1',
      name: 'SendGrid Email',
      channelType: 'email',
      isActive: true,
      isDefault: true,
      lastTestStatus: 'success',
    },
    {
      id: '2',
      name: 'Twilio SMS',
      channelType: 'sms',
      isActive: true,
      isDefault: false,
    },
  ]);

  const tabs = [
    { key: 'webhooks' as IntegrationType, label: 'Webhooks', count: webhooks.length },
    { key: 'api_connections' as IntegrationType, label: 'API Connections', count: apiConnections.length },
    { key: 'notification_channels' as IntegrationType, label: 'Notification Channels', count: notificationChannels.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Integrations
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage webhooks, API connections, and notification channels
          </p>
        </div>
        <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Integration
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
              <span className={`ml-2 py-0.5 px-2 text-xs rounded-full ${
                activeTab === tab.key
                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Search */}
      <Card>
        <div className="p-4">
          <Input
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md"
          />
        </div>
      </Card>

      {/* Content */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className="hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 p-2.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{webhook.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{webhook.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      webhook.isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {webhook.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex items-center space-x-4 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Events:</span>
                  <div className="flex flex-wrap gap-2">
                    {webhook.events.map((event) => (
                      <span key={event} className="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {event}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'api_connections' && (
        <div className="space-y-4">
          {apiConnections.map((conn) => (
            <Card key={conn.id} className="hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0 p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">{conn.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{conn.baseUrl}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      conn.isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {conn.isActive ? 'Connected' : 'Disconnected'}
                    </span>
                    <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {conn.authType}
                    </span>
                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'notification_channels' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {notificationChannels.map((channel) => (
            <Card key={channel.id} className="hover:shadow-md transition-shadow">
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2.5 rounded-lg ${
                    channel.channelType === 'email'
                      ? 'bg-amber-100 dark:bg-amber-900/30'
                      : channel.channelType === 'sms'
                      ? 'bg-green-100 dark:bg-green-900/30'
                      : 'bg-purple-100 dark:bg-purple-900/30'
                  }`}>
                    {channel.channelType === 'email' ? (
                      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    ) : channel.channelType === 'sms' ? (
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    )}
                  </div>
                  {channel.isDefault && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400">
                      Default
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-gray-900 dark:text-white">{channel.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{channel.channelType}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    channel.isActive
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {channel.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {channel.lastTestStatus && (
                    <span className={`text-xs ${
                      channel.lastTestStatus === 'success'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      Test: {channel.lastTestStatus}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
