import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileCode,
  Shield,
  GitBranch,
  CheckCircle,
  Zap,
  Bell,
  History,
  Layers,
  Settings,
  Database,
  ArrowUpCircle,
  TrendingUp,
  Clock,
  AlertTriangle,
  Users,
  UserPlus,
} from 'lucide-react';
import { useCustomizationList, useBusinessRulesList, useConfigHistoryList } from '../hooks';

interface AdminSection {
  title: string;
  description: string;
  items: AdminItem[];
}

interface AdminItem {
  name: string;
  description: string;
  href: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  darkColor: string;
}

const adminSections: AdminSection[] = [
  {
    title: 'User Administration',
    description: 'Manage users, roles, and access permissions',
    items: [
      {
        name: 'Users',
        description: 'Manage user accounts and profiles',
        href: '/studio/users',
        icon: Users,
        color: 'text-violet-600 bg-violet-100',
        darkColor: 'dark:text-violet-400 dark:bg-violet-900/30',
      },
      {
        name: 'Invite User',
        description: 'Send invitations to new users',
        href: '/studio/users/invite',
        icon: UserPlus,
        color: 'text-emerald-600 bg-emerald-100',
        darkColor: 'dark:text-emerald-400 dark:bg-emerald-900/30',
      },
    ],
  },
  {
    title: 'Automation',
    description: 'Configure scripts, business rules, and automated processes',
    items: [
      {
        name: 'Scripts',
        description: 'Server-side scripts for custom logic',
        href: '/studio/scripts',
        icon: FileCode,
        color: 'text-blue-600 bg-blue-100',
        darkColor: 'dark:text-blue-400 dark:bg-blue-900/30',
      },
      {
        name: 'Business Rules',
        description: 'Validation, defaults, and data policies',
        href: '/studio/business-rules',
        icon: Shield,
        color: 'text-red-600 bg-red-100',
        darkColor: 'dark:text-red-400 dark:bg-red-900/30',
      },
      {
        name: 'Workflows',
        description: 'Visual workflow automation',
        href: '/studio/workflows',
        icon: GitBranch,
        color: 'text-purple-600 bg-purple-100',
        darkColor: 'dark:text-purple-400 dark:bg-purple-900/30',
      },
      {
        name: 'Approvals',
        description: 'Approval processes and routing',
        href: '/studio/approvals',
        icon: CheckCircle,
        color: 'text-green-600 bg-green-100',
        darkColor: 'dark:text-green-400 dark:bg-green-900/30',
      },
    ],
  },
  {
    title: 'Integration',
    description: 'Events, notifications, and external integrations',
    items: [
      {
        name: 'Events',
        description: 'Event definitions and subscriptions',
        href: '/studio/events',
        icon: Zap,
        color: 'text-amber-600 bg-amber-100',
        darkColor: 'dark:text-amber-400 dark:bg-amber-900/30',
      },
      {
        name: 'Notifications',
        description: 'Email, SMS, and push notification templates',
        href: '/studio/notifications',
        icon: Bell,
        color: 'text-pink-600 bg-pink-100',
        darkColor: 'dark:text-pink-400 dark:bg-pink-900/30',
      },
    ],
  },
  {
    title: 'Configuration',
    description: 'Platform configuration and customizations',
    items: [
      {
        name: 'Platform Config',
        description: 'Browse platform default configurations',
        href: '/studio/platform-config',
        icon: Database,
        color: 'text-slate-600 bg-slate-100',
        darkColor: 'dark:text-slate-400 dark:bg-slate-800',
      },
      {
        name: 'Customizations',
        description: 'View and manage tenant customizations',
        href: '/studio/customizations',
        icon: Layers,
        color: 'text-indigo-600 bg-indigo-100',
        darkColor: 'dark:text-indigo-400 dark:bg-indigo-900/30',
      },
      {
        name: 'Tables',
        description: 'Manage table definitions and fields',
        href: '/studio/tables',
        icon: Database,
        color: 'text-teal-600 bg-teal-100',
        darkColor: 'dark:text-teal-400 dark:bg-teal-900/30',
      },
    ],
  },
  {
    title: 'System',
    description: 'System settings, upgrades, and audit logs',
    items: [
      {
        name: 'Upgrade Center',
        description: 'Platform upgrades and impact analysis',
        href: '/studio/upgrade',
        icon: ArrowUpCircle,
        color: 'text-blue-600 bg-blue-100',
        darkColor: 'dark:text-blue-400 dark:bg-blue-900/30',
      },
      {
        name: 'Change History',
        description: 'Audit log of configuration changes',
        href: '/studio/history',
        icon: History,
        color: 'text-cyan-600 bg-cyan-100',
        darkColor: 'dark:text-cyan-400 dark:bg-cyan-900/30',
      },
      {
        name: 'Settings',
        description: 'Platform and tenant configuration',
        href: '/studio/settings',
        icon: Settings,
        color: 'text-slate-600 bg-slate-100',
        darkColor: 'dark:text-slate-400 dark:bg-slate-800',
      },
    ],
  },
];

export const AdminDashboardPage: React.FC = () => {
  // Fetch real stats
  const { customizations, loading: customizationsLoading } = useCustomizationList({ active: true });
  const { rules, loading: rulesLoading } = useBusinessRulesList({ active: true });
  const { history, loading: historyLoading } = useConfigHistoryList({ limit: 5 });

  // Calculate stats
  const stats = {
    customizations: customizations.length,
    overrides: customizations.filter(c => c.customizationType === 'override').length,
    businessRules: rules.length,
    recentChanges: history.length,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--hw-text)' }}>
          Studio
        </h1>
        <p className="mt-1" style={{ color: 'var(--hw-text-muted)' }}>
          Configure tables, scripts, workflows, and automations
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/30"
            >
              <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <div className="text-2xl font-semibold" style={{ color: 'var(--hw-text)' }}>
                {customizationsLoading ? '-' : stats.customizations}
              </div>
              <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                Customizations
              </div>
            </div>
          </div>
          {stats.overrides > 0 && !customizationsLoading && (
            <div className="mt-3 flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              {stats.overrides} override{stats.overrides !== 1 ? 's' : ''} to review
            </div>
          )}
        </div>

        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center bg-red-100 dark:bg-red-900/30"
            >
              <Shield className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-semibold" style={{ color: 'var(--hw-text)' }}>
                {rulesLoading ? '-' : stats.businessRules}
              </div>
              <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                Business Rules
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            All active
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center bg-cyan-100 dark:bg-cyan-900/30"
            >
              <History className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-semibold" style={{ color: 'var(--hw-text)' }}>
                {historyLoading ? '-' : stats.recentChanges}
              </div>
              <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                Recent Changes
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-sm" style={{ color: 'var(--hw-text-muted)' }}>
            <Clock className="h-4 w-4" />
            Last 7 days
          </div>
        </div>

        <div
          className="rounded-xl border p-4"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center bg-green-100 dark:bg-green-900/30"
            >
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-semibold" style={{ color: 'var(--hw-text)' }}>
                v1.0.0
              </div>
              <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                Platform Version
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            Up to date
          </div>
        </div>
      </div>

      {/* Admin Sections */}
      <div className="space-y-8">
        {adminSections.map((section) => (
          <div key={section.title}>
            <div className="mb-4">
              <h2 className="text-lg font-medium" style={{ color: 'var(--hw-text)' }}>
                {section.title}
              </h2>
              <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                {section.description}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="block p-4 rounded-xl border transition-all group hover:shadow-md"
                    style={{
                      backgroundColor: 'var(--hw-surface)',
                      borderColor: 'var(--hw-border)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--hw-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--hw-border)';
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${item.color} ${item.darkColor}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3
                          className="font-medium transition-colors"
                          style={{ color: 'var(--hw-text)' }}
                        >
                          {item.name}
                        </h3>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--hw-text-muted)' }}>
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      {!historyLoading && history.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium" style={{ color: 'var(--hw-text)' }}>
              Recent Activity
            </h2>
            <Link
              to="/studio/history"
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              View all
            </Link>
          </div>

          <div
            className="rounded-xl border overflow-hidden"
            style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
          >
            {history.slice(0, 5).map((entry, index) => (
              <div
                key={entry.id}
                className={`flex items-center gap-4 px-4 py-3 ${
                  index !== Math.min(history.length, 5) - 1 ? 'border-b' : ''
                }`}
                style={{ borderColor: 'var(--hw-border)' }}
              >
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
                >
                  <History className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium" style={{ color: 'var(--hw-text)' }}>
                      {entry.changeType}
                    </span>
                    <span style={{ color: 'var(--hw-text-muted)' }}>-</span>
                    <span style={{ color: 'var(--hw-text-secondary)' }}>
                      {entry.configType}:{entry.resourceKey}
                    </span>
                  </div>
                  <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                    {entry.changedBy || 'System'} • {new Date(entry.changedAt).toLocaleString()}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs rounded-full ${
                    entry.changeType === 'create'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : entry.changeType === 'update'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : entry.changeType === 'delete'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                  }`}
                >
                  {entry.changeType}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
