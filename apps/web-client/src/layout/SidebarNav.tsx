import React from 'react';
import { NavLink } from 'react-router-dom';
import { PermissionGate } from '../auth/PermissionGate';

const NavItem: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      [
        'block rounded-lg px-3 py-2 text-sm transition-colors',
        isActive
          ? 'bg-primary/10 text-foreground font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      ].join(' ')
    }
  >
    {label}
  </NavLink>
);

export const SidebarNav: React.FC = () => {
  return (
    <aside className="hidden w-60 flex-shrink-0 border-r border-border bg-card p-3 sm:flex sm:flex-col">
      <div className="mt-2 flex flex-col gap-1">
        <PermissionGate permissions="asset.read">
          <NavItem to="/assets" label="Assets" />
        </PermissionGate>

        <PermissionGate permissions="work_order.read">
          <NavItem to="/work-orders" label="Work Orders" />
        </PermissionGate>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <PermissionGate roles="admin">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Studio</div>
          <NavItem to="/collections.list" label="Collections" />
          <NavItem to="/studio/scripts" label="Scripts" />
          <NavItem to="/studio/process-flows" label="Process Flows" />
        </PermissionGate>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <PermissionGate roles="admin">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Administration</div>
          <NavItem to="/admin/users" label="Users & Roles" />
          <NavItem to="/admin/groups" label="Groups" />
        </PermissionGate>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <PermissionGate roles="admin">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Enterprise</div>
          <NavItem to="/admin/enterprise/sso" label="SSO Configuration" />
          <NavItem to="/admin/enterprise/ldap" label="LDAP / Active Directory" />
          <NavItem to="/admin/enterprise/audit" label="Audit Logs" />
        </PermissionGate>
      </div>
    </aside>
  );
};
