import React from 'react';
import { Link } from 'react-router-dom';
import {
  Users,

  Shield,
  Menu,
  Database,
  Lock,
  Globe,
  FileText,
  Layers,
} from 'lucide-react';

interface AdminSection {
  title: string;
  description: string;
  items: AdminItem[];
}

interface AdminItem {
  name: string;
  description: string;
  href: string;
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  iconBg: string;
  iconColor: string;
}

const adminSections: AdminSection[] = [
  {
    title: 'Identity & Access',
    description: 'Manage users, groups, and access control',
    items: [
      {
        name: 'Users',
        description: 'Manage user accounts and profiles',
        href: '/studio/users',
        icon: Users,
        iconBg: 'var(--bg-primary-subtle)',
        iconColor: 'var(--text-brand)',
      },
      {
        name: 'Groups',
        description: 'Manage user groups and membership',
        href: '/studio/groups',
        icon: Layers,
        iconBg: 'var(--bg-info-subtle)',
        iconColor: 'var(--text-info)',
      },
      {
        name: 'Roles',
        description: 'Define roles and permission sets',
        href: '/studio/roles',
        icon: Shield,
        iconBg: 'var(--bg-success-subtle)',
        iconColor: 'var(--text-success)',
      },
    ],
  },
  {
    title: 'Data Platform',
    description: 'Manage data models and schemas',
    items: [
      {
        name: 'Collections',
        description: 'Manage collection definitions and schema',
        href: '/studio/collections',
        icon: Database,
        iconBg: 'var(--bg-accent-subtle)',
        iconColor: 'var(--text-accent)',
      },
    ],
  },
  {
    title: 'Interface & Experience',
    description: 'Customize application navigation and branding',
    items: [
      {
        name: 'Navigation',
        description: 'Customize sidebar menus and structure',
        href: '/studio/navigation',
        icon: Menu,
        iconBg: 'var(--bg-danger-subtle)',
        iconColor: 'var(--text-danger)',
      },
    ],
  },
  {
    title: 'Enterprise Security',
    description: 'Configure security and compliance settings',
    items: [
      {
        name: 'SSO Configuration',
        description: 'Configure Single Sign-On (SAML/OIDC)',
        href: '/studio/sso',
        icon: Lock,
        iconBg: 'var(--bg-warning-subtle)',
        iconColor: 'var(--text-warning)',
      },
      {
        name: 'LDAP / Directory',
        description: 'Configure LDAP and Active Directory sync',
        href: '/studio/ldap',
        icon: Globe,
        iconBg: 'var(--bg-info-subtle)',
        iconColor: 'var(--text-info)',
      },
      {
        name: 'Audit Logs',
        description: 'View system audit trails',
        href: '/studio/audit',
        icon: FileText,
        iconBg: 'var(--bg-surface-secondary)',
        iconColor: 'var(--text-tertiary)',
      },
    ],
  },
];

export const AdminDashboardPage: React.FC = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Studio
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
          Manage your HubbleWave platform instance
        </p>
      </div>

      {/* Admin Sections */}
      <div className="space-y-8">
        {adminSections.map((section) => (
          <div key={section.title}>
            <div className="mb-4">
              <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                {section.title}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
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
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-default)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-default)';
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: item.iconBg }}
                      >
                        <Icon className="h-4 w-4" style={{ color: item.iconColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3
                          className="text-sm font-medium transition-colors"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {item.name}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
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
    </div>
  );
};

export default AdminDashboardPage;
