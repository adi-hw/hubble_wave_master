import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Bell, Mail, Smartphone, MessageSquare, AlertCircle } from 'lucide-react';

interface NotificationTemplate {
  id: string;
  code: string;
  name: string;
  supportedChannels: ('email' | 'in_app' | 'sms' | 'push')[];
  source: 'platform' | 'tenant';
  isSystem: boolean;
  isActive: boolean;
  usageCount: number;
  updatedAt: string;
}

const mockTemplates: NotificationTemplate[] = [
  {
    id: '1',
    code: 'approval_request',
    name: 'Approval Request',
    supportedChannels: ['email', 'in_app', 'push'],
    source: 'platform',
    isSystem: true,
    isActive: true,
    usageCount: 156,
    updatedAt: '2024-01-10T09:00:00Z',
  },
  {
    id: '2',
    code: 'approval_response',
    name: 'Approval Response',
    supportedChannels: ['email', 'in_app'],
    source: 'platform',
    isSystem: true,
    isActive: true,
    usageCount: 148,
    updatedAt: '2024-01-10T09:00:00Z',
  },
  {
    id: '3',
    code: 'wo_assigned',
    name: 'Work Order Assigned',
    supportedChannels: ['email', 'in_app', 'push'],
    source: 'tenant',
    isSystem: false,
    isActive: true,
    usageCount: 89,
    updatedAt: '2024-01-12T14:30:00Z',
  },
  {
    id: '4',
    code: 'maintenance_due',
    name: 'Maintenance Due Reminder',
    supportedChannels: ['email', 'sms'],
    source: 'tenant',
    isSystem: false,
    isActive: true,
    usageCount: 45,
    updatedAt: '2024-01-08T11:00:00Z',
  },
];

const channelIcons: Record<string, React.FC<{ className?: string }>> = {
  email: Mail,
  in_app: Bell,
  sms: Smartphone,
  push: MessageSquare,
};

export const NotificationsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'platform' | 'tenant'>('all');

  const filteredTemplates = mockTemplates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = filterSource === 'all' || template.source === filterSource;
    return matchesSearch && matchesSource;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage notification templates for email, in-app, SMS, and push notifications
          </p>
        </div>
        <button
          onClick={() => navigate('/studio/notifications/new')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-slate-900">{mockTemplates.length}</div>
          <div className="text-sm text-slate-500">Templates</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-blue-600">
            {mockTemplates.filter((t) => t.supportedChannels.includes('email')).length}
          </div>
          <div className="text-sm text-slate-500">Email Templates</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-green-600">
            {mockTemplates.reduce((sum, t) => sum + t.usageCount, 0)}
          </div>
          <div className="text-sm text-slate-500">Total Sent</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-slate-900">
            {mockTemplates.filter((t) => !t.isSystem).length}
          </div>
          <div className="text-sm text-slate-500">Custom Templates</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value as 'all' | 'platform' | 'tenant')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Sources</option>
            <option value="platform">Platform</option>
            <option value="tenant">Custom</option>
          </select>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            onClick={() => navigate(`/studio/notifications/${template.id}`)}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:border-primary-300 hover:shadow-md cursor-pointer transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium text-slate-900">{template.name}</h3>
                  <p className="text-sm text-slate-500">{template.code}</p>
                </div>
              </div>
              {template.isSystem ? (
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  System
                </span>
              ) : (
                <span className="text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded">
                  Custom
                </span>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                {template.supportedChannels.map((channel) => {
                  const Icon = channelIcons[channel];
                  return (
                    <div
                      key={channel}
                      className="h-7 w-7 rounded-md bg-slate-100 flex items-center justify-center"
                      title={channel}
                    >
                      <Icon className="h-3.5 w-3.5 text-slate-500" />
                    </div>
                  );
                })}
              </div>
              <span className="text-xs text-slate-400">
                {template.usageCount} sent
              </span>
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-12 text-center">
          <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No templates found</p>
        </div>
      )}
    </div>
  );
};
