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
  Package,
  Workflow,
  Zap,
  Plug,
  Webhook,
  FileUp,
  Blocks,
  Search,
  LayoutDashboard,
  Languages,
} from 'lucide-react';
import { AvaAssistPanel } from '../../ava';

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
  iconBgClass: string;
  iconColorClass: string;
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
        iconBgClass: 'bg-primary/10',
        iconColorClass: 'text-primary',
      },
      {
        name: 'Groups',
        description: 'Manage user groups and membership',
        href: '/studio/groups',
        icon: Layers,
        iconBgClass: 'bg-info-subtle',
        iconColorClass: 'text-info-text',
      },
      {
        name: 'Roles',
        description: 'Define roles and permission sets',
        href: '/studio/roles',
        icon: Shield,
        iconBgClass: 'bg-success-subtle',
        iconColorClass: 'text-success-text',
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
        href: '/collections.list',
        icon: Database,
        iconBgClass: 'bg-violet-500/10',
        iconColorClass: 'text-violet-500',
      },
      {
        name: 'Packs',
        description: 'Install and manage platform packs',
        href: '/studio/packs',
        icon: Package,
        iconBgClass: 'bg-primary/10',
        iconColorClass: 'text-primary',
      },
      {
        name: 'Search',
        description: 'Configure experiences, sources, and indexing',
        href: '/studio/search',
        icon: Search,
        iconBgClass: 'bg-info-subtle',
        iconColorClass: 'text-info-text',
      },
      {
        name: 'Dashboards',
        description: 'Build insights dashboards and widgets',
        href: '/studio/dashboards',
        icon: LayoutDashboard,
        iconBgClass: 'bg-success-subtle',
        iconColorClass: 'text-success-text',
      },
      {
        name: 'Localization',
        description: 'Review and publish translations by locale',
        href: '/studio/localization',
        icon: Languages,
        iconBgClass: 'bg-warning-subtle',
        iconColorClass: 'text-warning-text',
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
        iconBgClass: 'bg-destructive/10',
        iconColorClass: 'text-destructive',
      },
    ],
  },
  {
    title: 'Automation & Workflow',
    description: 'Build automation rules and process flows',
    items: [
      {
        name: 'Automations',
        description: 'Create and manage automation rules',
        href: '/automation',
        icon: Zap,
        iconBgClass: 'bg-warning-subtle',
        iconColorClass: 'text-warning-text',
      },
      {
        name: 'Process Flows',
        description: 'Design workflows and approvals',
        href: '/process-flows',
        icon: Workflow,
        iconBgClass: 'bg-info-subtle',
        iconColorClass: 'text-info-text',
      },
    ],
  },
  {
    title: 'Integrations',
    description: 'Connect external systems and APIs',
    items: [
      {
        name: 'Connector Manager',
        description: 'Configure connector connections and sync schedules',
        href: '/studio/connectors',
        icon: Plug,
        iconBgClass: 'bg-primary/10',
        iconColorClass: 'text-primary',
      },
      {
        name: 'API Explorer',
        description: 'Browse and test platform APIs',
        href: '/integrations/api',
        icon: Plug,
        iconBgClass: 'bg-success-subtle',
        iconColorClass: 'text-success-text',
      },
      {
        name: 'Webhooks',
        description: 'Manage outbound webhooks',
        href: '/integrations/webhooks',
        icon: Webhook,
        iconBgClass: 'bg-info-subtle',
        iconColorClass: 'text-info-text',
      },
      {
        name: 'Import / Export',
        description: 'Bulk data ingest and export',
        href: '/integrations/import-export',
        icon: FileUp,
        iconBgClass: 'bg-primary/10',
        iconColorClass: 'text-primary',
      },
      {
        name: 'Marketplace',
        description: 'Browse integration templates',
        href: '/integrations/marketplace',
        icon: Blocks,
        iconBgClass: 'bg-muted',
        iconColorClass: 'text-muted-foreground',
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
        iconBgClass: 'bg-warning-subtle',
        iconColorClass: 'text-warning-text',
      },
      {
        name: 'LDAP / Directory',
        description: 'Configure LDAP and Active Directory sync',
        href: '/studio/ldap',
        icon: Globe,
        iconBgClass: 'bg-info-subtle',
        iconColorClass: 'text-info-text',
      },
      {
        name: 'Audit Logs',
        description: 'View system audit trails',
        href: '/studio/audit',
        icon: FileText,
        iconBgClass: 'bg-muted',
        iconColorClass: 'text-muted-foreground',
      },
    ],
  },
];

export const AdminDashboardPage: React.FC = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground">
          Studio
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage your HubbleWave platform instance
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="space-y-8">
          {adminSections.map((section) => (
            <div key={section.title}>
              <div className="mb-4">
                <h2 className="text-lg font-medium text-foreground">
                  {section.title}
                </h2>
                <p className="text-sm text-muted-foreground">
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
                      className="block p-4 rounded-xl border border-border bg-card transition-all group hover:shadow-md hover:border-primary"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${item.iconBgClass}`}>
                          <Icon className={`h-4 w-4 ${item.iconColorClass}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium transition-colors text-foreground">
                            {item.name}
                          </h3>
                          <p className="text-xs mt-0.5 text-muted-foreground">
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

        <AvaAssistPanel
          title="Studio Copilot"
          subtitle="Ask AVA to configure, audit, or navigate"
          context={{ page: 'Studio Dashboard' }}
        />
      </div>
    </div>
  );
};

export default AdminDashboardPage;
