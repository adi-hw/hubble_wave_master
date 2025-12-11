import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  className?: string;
}

const pathLabels: Record<string, string> = {
  admin: 'Admin',
  tables: 'Tables',
  scripts: 'Scripts',
  workflows: 'Workflows',
  approvals: 'Approvals',
  events: 'Events',
  notifications: 'Notifications',
  customizations: 'Customizations',
  settings: 'Settings',
  history: 'Change History',
  security: 'Security',
  fields: 'Fields',
  layouts: 'Layouts',
  access: 'Access Control',
  usage: 'Usage',
  new: 'New',
  edit: 'Edit',
};

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, className = '' }) => {
  const location = useLocation();

  const breadcrumbItems: BreadcrumbItem[] = items || React.useMemo(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const result: BreadcrumbItem[] = [];
    let currentPath = '';

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      currentPath += `/${part}`;

      // Skip numeric IDs and UUIDs in breadcrumb labels
      const isId = /^[0-9a-f-]+$/i.test(part) && part.length > 8;

      result.push({
        label: isId ? '...' : pathLabels[part] || part.charAt(0).toUpperCase() + part.slice(1),
        path: i < pathParts.length - 1 ? currentPath : undefined,
      });
    }

    return result;
  }, [location.pathname]);

  if (breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav className={`flex items-center text-sm ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center gap-1">
        <li>
          <Link
            to="/"
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded hover:bg-slate-100"
          >
            <Home className="h-4 w-4" />
          </Link>
        </li>

        {breadcrumbItems.map((item, index) => (
          <li key={index} className="flex items-center">
            <ChevronRight className="h-4 w-4 text-slate-300 mx-1" />
            {item.path ? (
              <Link
                to={item.path}
                className="text-slate-500 hover:text-slate-700 transition-colors px-1.5 py-0.5 rounded hover:bg-slate-100"
              >
                {item.icon}
                {item.label}
              </Link>
            ) : (
              <span className="text-slate-700 font-medium px-1.5 py-0.5">
                {item.icon}
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  breadcrumbItems?: BreadcrumbItem[];
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  description,
  icon,
  actions,
  breadcrumbs,
  breadcrumbItems,
  className = '',
}) => {
  // Convert breadcrumbs to breadcrumbItems if provided
  const items = breadcrumbItems || breadcrumbs?.map((b) => ({
    label: b.label,
    path: b.href,
  }));

  return (
    <div className={`mb-6 ${className}`}>
      <Breadcrumb items={items} className="mb-4" />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {icon && (
            <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
            {(subtitle || description) && (
              <p className="text-sm text-slate-500 mt-1">{subtitle || description}</p>
            )}
          </div>
        </div>

        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default Breadcrumb;
