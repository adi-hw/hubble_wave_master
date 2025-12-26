import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Shield,
  Loader2,
  Link2,
  X,
  Check,
} from 'lucide-react';
import identityApi from '../../../services/identityApi';

interface Role {
  id: string;
  code: string;
  name: string;
  description?: string;
  color?: string;
  isSystem: boolean;
}

interface GroupRoleAssignment {
  id: string;
  groupId: string;
  roleId: string;
  role?: Role;
}

interface InheritedGroupRole {
  role: Role;
  fromGroupId: string;
  fromGroupName: string;
  depth: number;
}

interface Group {
  id: string;
  code: string;
  name: string;
  type: string;
  roleCount?: number;
}

export const GroupRolesPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [directRoles, setDirectRoles] = useState<GroupRoleAssignment[]>([]);
  const [inheritedRoles, setInheritedRoles] = useState<InheritedGroupRole[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [addingRoles, setAddingRoles] = useState(false);
  const [roleSearchQuery, setRoleSearchQuery] = useState('');

  // Fetch group details
  const fetchGroup = useCallback(async () => {
    if (!id) return;
    try {
      const response = await identityApi.get<{ data: Group }>(`/admin/groups/${id}`);
      setGroup(response.data.data);
    } catch (err) {
      console.error('Failed to fetch group:', err);
    }
  }, [id]);

  // Fetch group roles
  const fetchRoles = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await identityApi.get<{
        data: {
          direct: GroupRoleAssignment[];
          inherited: InheritedGroupRole[];
        };
      }>(`/admin/groups/${id}/roles`);
      setDirectRoles(response.data.data.direct);
      setInheritedRoles(response.data.data.inherited);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Fetch available roles for adding
  const fetchAvailableRoles = useCallback(async () => {
    try {
      const response = await identityApi.get<{ data: Role[] }>('/admin/roles', {
        params: { search: roleSearchQuery || undefined },
      });
      // Filter out roles that are already assigned
      const assignedRoleIds = new Set(directRoles.map((r) => r.roleId));
      const available = response.data.data.filter(
        (r) => !assignedRoleIds.has(r.id) && r.isSystem !== true
      );
      setAvailableRoles(available);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    }
  }, [roleSearchQuery, directRoles]);

  useEffect(() => {
    fetchGroup();
    fetchRoles();
  }, [fetchGroup, fetchRoles]);

  useEffect(() => {
    if (showAddModal) {
      fetchAvailableRoles();
    }
  }, [showAddModal, fetchAvailableRoles]);

  // Handle remove role
  const handleRemoveRole = async (roleId: string) => {
    if (!window.confirm('Are you sure you want to remove this role?')) return;

    try {
      await identityApi.delete(`/admin/groups/${id}/roles/${roleId}`);
      fetchRoles();
      fetchGroup();
    } catch (err) {
      console.error('Failed to remove role:', err);
    }
  };

  // Handle add roles
  const handleAddRoles = async () => {
    if (selectedRoles.length === 0) return;

    setAddingRoles(true);
    try {
      await identityApi.post(`/admin/groups/${id}/roles/bulk`, {
        roleIds: selectedRoles,
      });
      setShowAddModal(false);
      setSelectedRoles([]);
      fetchRoles();
      fetchGroup();
    } catch (err) {
      console.error('Failed to add roles:', err);
    } finally {
      setAddingRoles(false);
    }
  };

  const toggleRoleSelection = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b" style={{ borderColor: 'var(--border-default)' }}>
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/studio/groups')}
            className="p-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'transparent' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {group?.name} - Roles
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Manage role assignments for this group
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              {directRoles.length} direct, {inheritedRoles.length} inherited
            </span>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
          >
            <Plus className="h-4 w-4" />
            Assign Role
          </button>
        </div>
      </div>

      {/* Roles List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Direct Roles */}
            <div>
              <h3 className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                Direct Roles
              </h3>
              {directRoles.length === 0 ? (
                <div
                  className="p-4 rounded-lg border text-center"
                  style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
                >
                  <Shield className="h-6 w-6 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No roles assigned directly
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {directRoles.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: assignment.role?.color || 'var(--bg-primary)' }}
                        >
                          <Shield className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {assignment.role?.name}
                          </div>
                          <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                            {assignment.role?.code}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveRole(assignment.roleId)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: 'var(--text-danger)' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-danger-subtle)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Remove role"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Inherited Roles */}
            {inheritedRoles.length > 0 && (
              <div>
                <h3 className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                  Inherited Roles
                </h3>
                <div className="space-y-2">
                  {inheritedRoles.map((inherited, idx) => (
                    <div
                      key={`${inherited.role.id}-${idx}`}
                      className="flex items-center justify-between p-4 rounded-lg border opacity-75"
                      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: inherited.role.color || 'var(--bg-primary)' }}
                        >
                          <Shield className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                              {inherited.role.name}
                            </span>
                            <span
                              className="flex items-center gap-1 px-2 py-0.5 text-xs rounded"
                              style={{ backgroundColor: 'var(--bg-surface-secondary)', color: 'var(--text-muted)' }}
                            >
                              <Link2 className="h-3 w-3" />
                              Inherited
                            </span>
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            from {inherited.fromGroupName}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Roles Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="w-full max-w-lg max-h-[80vh] rounded-xl overflow-hidden flex flex-col"
            style={{ backgroundColor: 'var(--bg-elevated)', boxShadow: 'var(--shadow-xl)' }}
          >
            {/* Modal Header */}
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Assign Roles
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedRoles([]);
                }}
                className="p-1 rounded transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <X className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b" style={{ borderColor: 'var(--border-default)' }}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={roleSearchQuery}
                  onChange={(e) => setRoleSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
              </div>
              {selectedRoles.length > 0 && (
                <div className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {selectedRoles.length} role(s) selected
                </div>
              )}
            </div>

            {/* Role List */}
            <div className="flex-1 overflow-y-auto p-4">
              {availableRoles.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No roles available
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableRoles.map((role) => {
                    const isSelected = selectedRoles.includes(role.id);
                    return (
                      <button
                        key={role.id}
                        onClick={() => toggleRoleSelection(role.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors"
                        style={{
                          borderColor: isSelected ? 'var(--border-brand)' : 'var(--border-default)',
                          backgroundColor: isSelected ? 'var(--bg-primary-subtle)' : 'var(--bg-surface)',
                        }}
                        onMouseEnter={(e) => !isSelected && (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                        onMouseLeave={(e) => !isSelected && (e.currentTarget.style.backgroundColor = isSelected ? 'var(--bg-primary-subtle)' : 'var(--bg-surface)')}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: role.color || 'var(--bg-primary)' }}
                        >
                          <Shield className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {role.name}
                          </div>
                          <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            {role.code}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-brand)' }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t flex items-center justify-end gap-3" style={{ borderColor: 'var(--border-default)' }}>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedRoles([]);
                }}
                className="btn-secondary px-4 py-2 text-sm rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRoles}
                disabled={selectedRoles.length === 0 || addingRoles}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm rounded-lg disabled:opacity-50"
              >
                {addingRoles ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Assign {selectedRoles.length || ''} Role{selectedRoles.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupRolesPage;
