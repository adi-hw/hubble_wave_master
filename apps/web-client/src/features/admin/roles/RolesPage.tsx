import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Users,
  Key,
  Settings,
  Edit,
  Trash2,
  Loader2,
  X,
  CheckCircle,
  XCircle,
  GitBranch,
  Lock,
  Sparkles,
  Check,
  List,
} from 'lucide-react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/api';

// =============================================================================
// Types
// =============================================================================

interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  isDangerous?: boolean;
  isSystem?: boolean;
}

interface Role {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string | null;
  parent?: Role | null;
  children?: Role[];
  color: string;
  isSystem: boolean;
  isDefault: boolean;
  isActive: boolean;
  weight: number;
  userCount?: number;
  permissionCount?: number;
  rolePermissions?: Array<{ permission: Permission }>;
  createdAt?: string;
}

interface User {
  id: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
}

interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  source: string;
  scopeType: string;
  scopeValue?: string;
  expiresAt?: string;
  createdAt: string;
  user?: User;
  role?: Role;
}

interface PermissionCheckResult {
  allowed: boolean;
  permission: string;
  reason: string;
  requiresMfa?: boolean;
}

// =============================================================================
// Main Component
// =============================================================================

export const RolesPage: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'list' | 'hierarchy'>('list');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch roles (initial load with loading state)
  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiGet<{ data: Role[] }>('/admin/roles');
      setRoles(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh roles without showing loading spinner (for background updates)
  const refreshRoles = useCallback(async () => {
    try {
      const response = await apiGet<{ data: Role[] }>('/admin/roles');
      setRoles(response.data || []);
    } catch (err) {
      console.error('Failed to refresh roles:', err);
    }
  }, []);

  // Fetch permissions
  const fetchPermissions = useCallback(async () => {
    try {
      setPermissionsError(null);
      const response = await apiGet<{ data: Permission[] }>('/admin/permissions');
      setPermissions(response.data || []);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to load permissions';
      setPermissionsError(errMsg);
      console.error('Failed to load permissions:', err);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, [fetchRoles, fetchPermissions]);

  // Filter roles
  const filteredRoles = useMemo(() => {
    if (!searchQuery) return roles;
    const lower = searchQuery.toLowerCase();
    return roles.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        r.code.toLowerCase().includes(lower) ||
        r.description?.toLowerCase().includes(lower)
    );
  }, [roles, searchQuery]);

  // Build hierarchy
  const roleHierarchy = useMemo(() => {
    const roleMap = new Map(roles.map((r) => [r.id, { ...r, children: [] as Role[] }]));
    const roots: Role[] = [];

    roles.forEach((role) => {
      const mappedRole = roleMap.get(role.id)!;
      if (role.parentId && roleMap.has(role.parentId)) {
        const parent = roleMap.get(role.parentId)!;
        parent.children = parent.children || [];
        parent.children.push(mappedRole);
      } else {
        roots.push(mappedRole);
      }
    });

    return roots;
  }, [roles]);

  // Stats
  const stats = useMemo(
    () => ({
      total: roles.length,
      system: roles.filter((r) => r.isSystem).length,
      custom: roles.filter((r) => !r.isSystem).length,
      permissions: permissions.length,
    }),
    [roles, permissions]
  );

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;
    try {
      await apiDelete(`/admin/roles/${roleId}`);
      fetchRoles();
      if (selectedRole?.id === roleId) {
        setSelectedRole(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-brand)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full">
      {/* Main Content */}
      <div
        className={`flex-1 p-6 transition-all ${
          selectedRole ? 'mr-[600px]' : ''
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-[var(--gradient-brand)] flex items-center justify-center" style={{ background: 'var(--gradient-brand)' }}>
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                Roles & Permissions
              </h1>
              <p className="text-sm text-[var(--text-secondary)]">
                Manage access control across your organization
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="flex items-center bg-[var(--bg-surface-secondary)] rounded-lg p-1">
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  view === 'list'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <List className="h-4 w-4" />
                List
              </button>
              <button
                onClick={() => setView('hierarchy')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  view === 'hierarchy'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <GitBranch className="h-4 w-4" />
                Hierarchy
              </button>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg"
            >
              <Plus className="h-4 w-4" />
              Create Role
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-[var(--bg-danger-subtle)] rounded-xl p-4 flex items-start gap-3 border border-[var(--border-danger)]">
            <XCircle className="h-5 w-5 text-[var(--text-danger)] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-[var(--text-danger)]">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-[var(--text-danger)] hover:opacity-80">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Roles', value: stats.total, icon: Shield, bgColor: 'var(--bg-primary-subtle)', iconColor: 'var(--text-brand)' },
            { label: 'System Roles', value: stats.system, icon: Lock, bgColor: 'var(--bg-warning-subtle)', iconColor: 'var(--text-warning)' },
            { label: 'Custom Roles', value: stats.custom, icon: Edit, bgColor: 'var(--bg-success-subtle)', iconColor: 'var(--text-success)' },
            { label: 'Permissions', value: stats.permissions, icon: Key, bgColor: 'var(--bg-accent-subtle)', iconColor: 'var(--text-accent)' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] p-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: stat.bgColor }}
                >
                  <stat.icon className="h-4 w-4" style={{ color: stat.iconColor }} />
                </div>
                <div>
                  <div className="text-lg font-bold text-[var(--text-primary)]">
                    {stat.value}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">{stat.label}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="mb-6 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search roles..."
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl text-[var(--text-primary)] placeholder-[var(--text-placeholder)]"
            />
          </div>
        </div>

        {/* Role List / Hierarchy */}
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] p-4">
          {view === 'list' ? (
            <div className="space-y-3">
              {filteredRoles.map((role) => (
                <RoleListItem
                  key={role.id}
                  role={role}
                  roles={roles}
                  selected={selectedRole?.id === role.id}
                  onSelect={() => setSelectedRole(role)}
                  onDelete={() => handleDeleteRole(role.id)}
                />
              ))}
              {filteredRoles.length === 0 && (
                <div className="text-center py-8 text-[var(--text-secondary)]">
                  {searchQuery ? `No roles matching "${searchQuery}"` : 'No roles found'}
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-4">
                Roles displayed in hierarchy. Child roles inherit permissions from parents.
              </p>
              {roleHierarchy.map((role) => (
                <RoleTreeItem
                  key={role.id}
                  role={role}
                  level={0}
                  selected={selectedRole?.id === role.id}
                  onSelect={() => setSelectedRole(role)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Permission Tester */}
        <PermissionTester roles={roles} />
      </div>

      {/* Detail Panel */}
      {selectedRole && (
        <RoleDetailPanel
          role={selectedRole}
          roles={roles}
          permissions={permissions}
          permissionsError={permissionsError}
          onClose={() => setSelectedRole(null)}
          onUpdate={() => refreshRoles()}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateRoleModal
          roles={roles}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchRoles();
          }}
        />
      )}
    </div>
  );
};

// =============================================================================
// Role List Item
// =============================================================================

const RoleListItem: React.FC<{
  role: Role;
  roles: Role[];
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}> = ({ role, roles, selected, onSelect, onDelete }) => {
  const parent = role.parentId ? roles.find((r) => r.id === role.parentId) : null;

  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all ${
        selected
          ? 'bg-[var(--bg-selected)] border border-[var(--border-primary)]'
          : 'bg-[var(--bg-surface-secondary)] border border-transparent hover:bg-[var(--bg-hover)]'
      }`}
    >
      <div
        className="w-3.5 h-3.5 rounded"
        style={{ backgroundColor: role.color }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[var(--text-primary)]">{role.name}</span>
          {role.isSystem && (
            <span className="px-1.5 py-0.5 bg-[var(--bg-surface-tertiary)] text-[var(--text-secondary)] text-xs rounded">
              System
            </span>
          )}
          {role.isDefault && (
            <span className="px-1.5 py-0.5 bg-[var(--bg-success-subtle)] text-[var(--text-success)] text-xs rounded">
              Default
            </span>
          )}
          {parent && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-[var(--bg-accent-subtle)] text-[var(--text-accent)] text-xs rounded">
              <GitBranch className="h-3 w-3" />
              {parent.name}
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--text-secondary)] truncate">
          {role.description}
        </p>
      </div>

      <div className="flex items-center gap-6 text-[var(--text-secondary)]">
        <div className="text-center">
          <div className="text-base font-semibold text-[var(--text-primary)]">
            {role.userCount ?? 0}
          </div>
          <div className="text-xs">Users</div>
        </div>
        <div className="text-center">
          <div className="text-base font-semibold text-[var(--text-primary)]">
            {role.permissionCount ?? 0}
          </div>
          <div className="text-xs">Perms</div>
        </div>
        {!role.isSystem && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 hover:text-[var(--text-danger)] transition-colors"
            title="Delete role"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        )}
        <ChevronRight className="h-5 w-5" />
      </div>
    </div>
  );
};

// =============================================================================
// Role Tree Item (Hierarchy View)
// =============================================================================

const RoleTreeItem: React.FC<{
  role: Role;
  level: number;
  selected: boolean;
  onSelect: () => void;
}> = ({ role, level, selected, onSelect }) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = role.children && role.children.length > 0;

  return (
    <div>
      <div
        onClick={onSelect}
        className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all ${
          selected
            ? 'bg-[var(--bg-selected)] border border-[var(--border-primary)]'
            : 'hover:bg-[var(--bg-hover)] border border-transparent'
        }`}
        style={{ marginLeft: level * 24 }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-0.5 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <div className="w-5" />
        )}

        <div
          className="w-2.5 h-2.5 rounded"
          style={{ backgroundColor: role.color }}
        />

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {role.name}
            </span>
            {role.isSystem && (
              <span className="px-1.5 py-0.5 bg-[var(--bg-surface-tertiary)] text-[var(--text-secondary)] text-[10px] rounded">
                System
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            {role.userCount ?? 0} users • {role.permissionCount ?? 0} permissions
          </p>
        </div>
      </div>

      {expanded &&
        hasChildren &&
        role.children!.map((child) => (
          <RoleTreeItem
            key={child.id}
            role={child}
            level={level + 1}
            selected={selected}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
};

// =============================================================================
// Role Detail Panel
// =============================================================================

const RoleDetailPanel: React.FC<{
  role: Role;
  roles: Role[];
  permissions: Permission[];
  permissionsError?: string | null;
  onClose: () => void;
  onUpdate: () => void;
}> = ({ role, roles, permissions, permissionsError, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'permissions' | 'users' | 'settings'>('permissions');
  const [rolePermissions, setRolePermissions] = useState<{
    direct: Permission[];
    inherited: Permission[];
  }>({ direct: [], inherited: [] });

  useEffect(() => {
    loadRolePermissions();
  }, [role.id]);

  const loadRolePermissions = async () => {
    try {
      const response = await apiGet<{ data: { direct: Permission[]; inherited: Permission[] } }>(
        `/admin/roles/${role.id}/permissions`
      );
      setRolePermissions(response.data);
    } catch (err) {
      console.error('Failed to load permissions:', err);
    }
  };

  const permissionsByCategory = useMemo(() => {
    const result: Record<string, Permission[]> = {};
    permissions.forEach((perm) => {
      const cat = perm.category || 'general';
      if (!result[cat]) result[cat] = [];
      result[cat].push(perm);
    });
    return result;
  }, [permissions]);

  const directPermCodes = new Set(rolePermissions.direct.map((p) => p.code));
  const inheritedPermCodes = new Set(rolePermissions.inherited.map((p) => p.code));

  const [permissionError, setPermissionError] = useState<string | null>(null);

  const togglePermission = async (permCode: string) => {
    const isAssigned = directPermCodes.has(permCode);
    try {
      setPermissionError(null);
      if (isAssigned) {
        await apiDelete(`/admin/roles/${role.id}/permissions`, {
          data: { permissions: [permCode] },
        });
      } else {
        await apiPost(`/admin/roles/${role.id}/permissions`, {
          permissions: [permCode],
        });
      }
      loadRolePermissions();
      onUpdate();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to update permission';
      setPermissionError(errMsg);
      console.error('Failed to update permission:', err);
    }
  };

  return (
    <div className="fixed top-0 right-0 w-[600px] h-full bg-[var(--bg-surface)] border-l border-[var(--border-default)] flex flex-col z-50">
      {/* Header */}
      <div className="p-5 border-b border-[var(--border-default)] flex items-center gap-4">
        <button
          onClick={onClose}
          className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] rounded-lg"
        >
          <X className="h-5 w-5" />
        </button>

        <div
          className="w-4 h-4 rounded"
          style={{ backgroundColor: role.color }}
        />

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {role.name}
            </h2>
            {role.isSystem && (
              <span className="px-1.5 py-0.5 bg-[var(--bg-surface-tertiary)] text-[var(--text-secondary)] text-xs rounded">
                System
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{role.description}</p>
        </div>

        {!role.isSystem && (
          <button className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] rounded-lg">
            <Edit className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="px-5 py-3 border-b border-[var(--border-default)]">
        <div className="flex gap-1 bg-[var(--bg-surface-secondary)] rounded-lg p-1">
          {[
            { id: 'permissions', label: 'Permissions', icon: Key },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)]'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {activeTab === 'permissions' && (
          <div className="space-y-6">
            {permissionsError && (
              <div className="p-4 bg-[var(--bg-danger-subtle)] border border-[var(--border-danger)] rounded-lg mb-4">
                <p className="text-sm font-medium text-[var(--text-danger)]">Failed to load permissions</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{permissionsError}</p>
              </div>
            )}
            {permissionError && (
              <div className="p-3 bg-[var(--bg-danger-subtle)] border border-[var(--border-danger)] rounded-lg mb-4 flex items-center justify-between">
                <p className="text-sm text-[var(--text-danger)]">{permissionError}</p>
                <button onClick={() => setPermissionError(null)} className="text-[var(--text-danger)] hover:opacity-80">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {!permissionsError && Object.keys(permissionsByCategory).length === 0 && (
              <div className="text-center py-8 text-[var(--text-secondary)]">
                <Key className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>No permissions available.</p>
                <p className="text-sm text-[var(--text-muted)] mt-1">Permissions may not be seeded in the database.</p>
              </div>
            )}
            {Object.entries(permissionsByCategory).map(([category, perms]) => (
              <div key={category}>
                <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3 capitalize border-b border-[var(--border-default)] pb-2">
                  {category.replace('-', ' ')}
                </h4>
                <div className="space-y-2">
                  {perms.map((perm) => {
                    const isDirect = directPermCodes.has(perm.code);
                    const isInherited = inheritedPermCodes.has(perm.code);
                    const isActive = isDirect || isInherited;

                    return (
                      <div
                        key={perm.id}
                        onClick={() => !isInherited && togglePermission(perm.code)}
                        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-[var(--bg-selected)] border border-[var(--border-primary)]'
                            : 'bg-[var(--bg-surface-secondary)] border border-transparent hover:bg-[var(--bg-hover)]'
                        } ${isInherited ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isActive
                              ? 'bg-[var(--bg-primary)] border-[var(--border-primary)]'
                              : 'border-[var(--border-default)]'
                          }`}
                        >
                          {isActive && <Check className="h-3 w-3 text-white" />}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[var(--text-primary)]">
                              {perm.name}
                            </span>
                            {isInherited && (
                              <span className="flex items-center gap-1 px-1.5 py-0.5 bg-[var(--bg-accent-subtle)] text-[var(--text-accent)] text-[10px] rounded">
                                <GitBranch className="h-2.5 w-2.5" />
                                Inherited
                              </span>
                            )}
                            {perm.isDangerous && (
                              <span className="px-1.5 py-0.5 bg-[var(--bg-warning-subtle)] text-[var(--text-warning)] text-[10px] rounded">
                                Dangerous
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--text-secondary)]">{perm.description}</p>
                        </div>

                        <code className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-surface-secondary)] px-2 py-1 rounded">
                          {perm.code}
                        </code>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'users' && <RoleUsersTab roleId={role.id} />}

        {activeTab === 'settings' && (
          <RoleSettingsTab role={role} roles={roles} onUpdate={onUpdate} />
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border-default)] flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] rounded-lg"
        >
          Close
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// Role Users Tab
// =============================================================================

const RoleUsersTab: React.FC<{ roleId: string }> = ({ roleId }) => {
  const [users, setUsers] = useState<UserRoleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiGet<{ data: UserRoleAssignment[] }>(
        `/admin/roles/${roleId}/users`
      );
      setUsers(response.data || []);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to load users';
      setError(errMsg);
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const removeUser = async (userId: string) => {
    try {
      setRemoveError(null);
      await apiDelete(`/admin/roles/${roleId}/users/${userId}`);
      loadUsers();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Failed to remove user';
      setRemoveError(errMsg);
      console.error('Failed to remove user:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-brand)]" />
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="p-4 bg-[var(--bg-danger-subtle)] border border-[var(--border-danger)] rounded-lg mb-4">
          <p className="text-sm font-medium text-[var(--text-danger)]">Failed to load users</p>
          <p className="text-xs text-[var(--text-secondary)] mt-1">{error}</p>
          <button
            onClick={loadUsers}
            className="mt-2 text-xs text-[var(--text-primary)] underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}

      {removeError && (
        <div className="p-3 bg-[var(--bg-danger-subtle)] border border-[var(--border-danger)] rounded-lg mb-4 flex items-center justify-between">
          <p className="text-sm text-[var(--text-danger)]">{removeError}</p>
          <button onClick={() => setRemoveError(null)} className="text-[var(--text-danger)] hover:opacity-80">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
        Users with this role ({users.length})
      </h4>

      {!error && users.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)] italic py-4">No users assigned to this role</p>
      ) : (
        <div className="space-y-2">
          {users.map((assignment) => (
            <div
              key={assignment.id}
              className="flex items-center gap-3 p-3 bg-[var(--bg-surface-secondary)] rounded-lg"
            >
              <div className="h-9 w-9 rounded-full bg-[var(--bg-primary)] flex items-center justify-center text-[var(--text-on-primary)] font-medium text-sm">
                {(assignment.user?.displayName ||
                  assignment.user?.email ||
                  'U')[0].toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {assignment.user?.displayName || assignment.user?.email}
                </div>
                <div className="text-xs text-[var(--text-secondary)]">
                  {assignment.user?.email}
                </div>
              </div>
              <button
                onClick={() => removeUser(assignment.userId)}
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-danger)] hover:bg-[var(--bg-danger-subtle)] rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Role Settings Tab
// =============================================================================

const RoleSettingsTab: React.FC<{
  role: Role;
  roles: Role[];
  onUpdate: () => void;
}> = ({ role, roles, onUpdate }) => {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description || '');
  const [parentId, setParentId] = useState(role.parentId || '');
  const [color, setColor] = useState(role.color);
  const [isDefault, setIsDefault] = useState(role.isDefault);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiPut(`/admin/roles/${role.id}`, {
        name,
        description,
        parentId: parentId || null,
        color,
        isDefault,
      });
      onUpdate();
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const availableParents = roles.filter((r) => r.id !== role.id);

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
          Role Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={role.isSystem}
          className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] disabled:opacity-50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
          Parent Role (Inheritance)
        </label>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          disabled={role.isSystem}
          className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] disabled:opacity-50"
        >
          <option value="">None (Top-level role)</option>
          {availableParents.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          This role will inherit all permissions from the parent role
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
          Color
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-12 h-10 rounded-lg cursor-pointer border-0"
          />
          <div className="flex gap-2">
            {['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#8b5cf6'].map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-lg ${color === c ? 'ring-2 ring-[var(--ring-color)] ring-offset-2' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-[var(--text-primary)]">
            Default Role
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Auto-assigned to new users
          </p>
        </div>
        <button
          onClick={() => setIsDefault(!isDefault)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            isDefault ? 'bg-[var(--bg-primary)]' : 'bg-[var(--bg-surface-tertiary)]'
          }`}
        >
          <div
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              isDefault ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Changes
      </button>

      {/* Danger Zone */}
      {!role.isSystem && (
        <div className="pt-6 border-t border-[var(--border-default)]">
          <h4 className="text-sm font-medium text-[var(--text-danger)] mb-3">Danger Zone</h4>
          <div className="p-4 bg-[var(--bg-danger-subtle)] border border-[var(--border-danger)] rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  Delete this role
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Remove this role and unassign all users
                </p>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-danger)] text-[var(--text-on-danger)] text-sm rounded-lg hover:opacity-90">
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Permission Tester
// =============================================================================

const PermissionTester: React.FC<{ roles: Role[] }> = () => {
  const [userId, setUserId] = useState('');
  const [permission, setPermission] = useState('');
  const [result, setResult] = useState<PermissionCheckResult | null>(null);
  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    if (!userId || !permission) return;
    try {
      setTesting(true);
      const response = await apiPost<{ data: PermissionCheckResult }>(
        `/admin/roles/user/${userId}/check-permission`,
        { permission }
      );
      setResult(response.data);
    } catch (err) {
      setResult({
        allowed: false,
        permission,
        reason: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-6 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-default)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-[var(--text-accent)]" />
        <h3 className="font-medium text-[var(--text-primary)]">Permission Tester</h3>
        <span className="px-1.5 py-0.5 bg-[var(--bg-accent-subtle)] text-[var(--text-accent)] text-xs rounded">
          AVA
        </span>
      </div>

      <p className="text-sm text-[var(--text-secondary)] mb-4">
        Test if a user has a specific permission.
      </p>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">User ID</label>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter user ID..."
            className="w-full px-3 py-2 bg-[var(--bg-surface-secondary)] border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-primary)]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Permission</label>
          <input
            type="text"
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
            placeholder="e.g., assets.view"
            className="w-full px-3 py-2 bg-[var(--bg-surface-secondary)] border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-primary)]"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={runTest}
            disabled={testing || !userId || !permission}
            className="btn-primary w-full px-4 py-2 rounded-lg disabled:opacity-50 text-sm"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
        </div>
      </div>

      {result && (
        <div
          className={`mt-4 p-4 rounded-lg ${
            result.allowed
              ? 'bg-[var(--bg-success-subtle)] border border-[var(--border-success)]'
              : 'bg-[var(--bg-danger-subtle)] border border-[var(--border-danger)]'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            {result.allowed ? (
              <CheckCircle className="h-5 w-5 text-[var(--text-success)]" />
            ) : (
              <XCircle className="h-5 w-5 text-[var(--text-danger)]" />
            )}
            <span
              className={`font-medium ${
                result.allowed ? 'text-[var(--text-success)]' : 'text-[var(--text-danger)]'
              }`}
            >
              {result.allowed ? 'Permission Granted' : 'Permission Denied'}
            </span>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{result.reason}</p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Create Role Modal
// =============================================================================

const CreateRoleModal: React.FC<{
  roles: Role[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ roles, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name || !code) return;
    try {
      setSaving(true);
      setError(null);
      await apiPost('/admin/roles', {
        code,
        name,
        description,
        parentId: parentId || undefined,
        color,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--bg-overlay)]">
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b border-[var(--border-default)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            Create New Role
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-[var(--bg-danger-subtle)] border border-[var(--border-danger)] rounded-lg text-[var(--text-danger)] text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Role Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!code) {
                  setCode(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                }
              }}
              placeholder="e.g., Department Manager"
              className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Code *
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="e.g., department-manager"
              className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this role is for..."
              rows={2}
              className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Parent Role (Inheritance)
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-lg text-[var(--text-primary)]"
            >
              <option value="">None (Top-level role)</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border-0"
              />
              <div className="flex gap-2">
                {['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#8b5cf6'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-lg ${color === c ? 'ring-2 ring-[var(--ring-color)]' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-[var(--border-default)] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="btn-secondary px-4 py-2 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving || !name || !code}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Create Role
          </button>
        </div>
      </div>
    </div>
  );
};

export default RolesPage;
