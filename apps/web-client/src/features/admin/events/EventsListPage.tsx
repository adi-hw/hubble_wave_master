import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Zap, Clock, AlertCircle, Activity } from 'lucide-react';

interface EventDefinition {
  id: string;
  code: string;
  name: string;
  category: 'record' | 'workflow' | 'approval' | 'user' | 'system' | 'custom';
  sourceType: 'table' | 'workflow' | 'approval' | 'system' | 'custom';
  isPublished: boolean;
  subscriptionCount: number;
  lastTriggeredAt?: string;
  triggerCount: number;
  isSystem: boolean;
  isActive: boolean;
}

const mockEvents: EventDefinition[] = [
  {
    id: '1',
    code: 'record.created',
    name: 'Record Created',
    category: 'record',
    sourceType: 'table',
    isPublished: true,
    subscriptionCount: 5,
    lastTriggeredAt: '2024-01-15T14:45:00Z',
    triggerCount: 1250,
    isSystem: true,
    isActive: true,
  },
  {
    id: '2',
    code: 'record.updated',
    name: 'Record Updated',
    category: 'record',
    sourceType: 'table',
    isPublished: true,
    subscriptionCount: 8,
    lastTriggeredAt: '2024-01-15T14:50:00Z',
    triggerCount: 3420,
    isSystem: true,
    isActive: true,
  },
  {
    id: '3',
    code: 'approval.requested',
    name: 'Approval Requested',
    category: 'approval',
    sourceType: 'approval',
    isPublished: true,
    subscriptionCount: 3,
    lastTriggeredAt: '2024-01-15T12:30:00Z',
    triggerCount: 156,
    isSystem: true,
    isActive: true,
  },
  {
    id: '4',
    code: 'wo.priority_changed',
    name: 'Work Order Priority Changed',
    category: 'custom',
    sourceType: 'custom',
    isPublished: true,
    subscriptionCount: 2,
    lastTriggeredAt: '2024-01-14T16:00:00Z',
    triggerCount: 45,
    isSystem: false,
    isActive: true,
  },
];

const categoryLabels: Record<EventDefinition['category'], string> = {
  record: 'Record',
  workflow: 'Workflow',
  approval: 'Approval',
  user: 'User',
  system: 'System',
  custom: 'Custom',
};

const categoryBadgeColors: Record<EventDefinition['category'], string> = {
  record: 'bg-blue-100 text-blue-700',
  workflow: 'bg-purple-100 text-purple-700',
  approval: 'bg-amber-100 text-amber-700',
  user: 'bg-green-100 text-green-700',
  system: 'bg-slate-100 text-slate-700',
  custom: 'bg-pink-100 text-pink-700',
};

export const EventsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<EventDefinition['category'] | 'all'>('all');

  const filteredEvents = mockEvents.filter((event) => {
    const matchesSearch =
      event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || event.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Events</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage event definitions and subscriptions for real-time integrations
          </p>
        </div>
        <button
          onClick={() => navigate('/studio/events/new')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Event
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-slate-900">{mockEvents.length}</div>
          <div className="text-sm text-slate-500">Event Definitions</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-blue-600">
            {mockEvents.reduce((sum, e) => sum + e.subscriptionCount, 0)}
          </div>
          <div className="text-sm text-slate-500">Active Subscriptions</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-slate-900">
            {mockEvents.reduce((sum, e) => sum + e.triggerCount, 0).toLocaleString()}
          </div>
          <div className="text-sm text-slate-500">Total Triggers</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-2xl font-semibold text-slate-900">
            {mockEvents.filter((e) => !e.isSystem).length}
          </div>
          <div className="text-sm text-slate-500">Custom Events</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as EventDefinition['category'] | 'all')}
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Categories</option>
            <option value="record">Record</option>
            <option value="workflow">Workflow</option>
            <option value="approval">Approval</option>
            <option value="user">User</option>
            <option value="system">System</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Event
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Category
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Subscriptions
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Triggers
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Last Triggered
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Source
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredEvents.map((event) => (
              <tr
                key={event.id}
                className="hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/studio/events/${event.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{event.name}</div>
                      <div className="text-sm text-slate-500">{event.code}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      categoryBadgeColors[event.category]
                    }`}
                  >
                    {categoryLabels[event.category]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-600">{event.subscriptionCount}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Activity className="h-3.5 w-3.5 text-slate-400" />
                    {event.triggerCount.toLocaleString()}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {event.lastTriggeredAt ? (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(event.lastTriggeredAt).toLocaleString()}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-4 py-3">
                  {event.isSystem ? (
                    <span className="text-xs text-slate-400">System</span>
                  ) : (
                    <span className="text-xs text-primary-600">Custom</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredEvents.length === 0 && (
          <div className="px-4 py-12 text-center">
            <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No events found</p>
          </div>
        )}
      </div>
    </div>
  );
};
