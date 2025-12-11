import React from 'react';
import { NavLink } from 'react-router-dom';
import { PermissionGate } from '../auth/PermissionGate';

const NavItem: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      ['block rounded px-3 py-2 text-sm', isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'].join(
        ' ',
      )
    }
  >
    {label}
  </NavLink>
);

export const SidebarNav: React.FC = () => {
  return (
    <aside className="hidden w-60 flex-shrink-0 border-r bg-white p-2 sm:flex sm:flex-col">
      <div className="mt-2 flex flex-col gap-1">
        <PermissionGate permissions="asset.read">
          <NavItem to="/assets" label="Assets" />
        </PermissionGate>

        <PermissionGate permissions="work_order.read">
          <NavItem to="/work-orders" label="Work Orders" />
        </PermissionGate>
      </div>

      <div className="mt-4 border-t pt-3">
        <PermissionGate roles="tenant_admin">
          <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Studio</div>
          <NavItem to="/studio/tables" label="Tables" />
          <NavItem to="/studio/scripts" label="Scripts" />
          <NavItem to="/studio/workflows" label="Workflows" />
        </PermissionGate>
      </div>

      <div className="mt-4 border-t pt-3">
        <PermissionGate roles="tenant_admin">
          <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Administration</div>
          <NavItem to="/admin/users" label="Users & Roles" />
          <NavItem to="/admin/groups" label="Groups" />
        </PermissionGate>
      </div>

      <div className="mt-4 border-t pt-3">
        <PermissionGate roles="platform_admin">
          <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Platform</div>
          <NavItem to="/admin/platform/tenants" label="Tenants" />
        </PermissionGate>
      </div>
    </aside>
  );
};
