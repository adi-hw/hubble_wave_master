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

  const fetchGroup = useCallback(async () => {
    if (!id) return;
    try {
      const response = await identityApi.get<{ data: Group }>(`/admin/groups/${id}`);
      setGroup(response.data.data);
    } catch (err) {
      console.error('Failed to fetch group:', err);
    }
  }, [id]);

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

  const fetchAvailableRoles = useCallback(async () => {
    try {
      const response = await identityApi.get<{ data: Role[] }>('/admin/roles', {
        params: { search: roleSearchQuery || undefined },
      });
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
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/studio/groups')}
            className="p-2 rounded-lg transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {group?.name} - Roles
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage role assignments for this group
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
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

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-3 text-foreground">
                Direct Roles
              </h3>
              {directRoles.length === 0 ? (
                <div className="p-4 rounded-lg border text-center bg-card border-border">
                  <Shield className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No roles assigned directly
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {directRoles.map((assignment) => (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary"
                          style={assignment.role?.color ? { backgroundColor: assignment.role.color } : undefined}
                        >
                          <Shield className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {assignment.role?.name}
                          </div>
                          <div className="text-xs font-mono text-muted-foreground">
                            {assignment.role?.code}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleRemoveRole(assignment.roleId)}
                        className="p-2 rounded-lg transition-colors text-destructive hover:bg-destructive/10"
                        title="Remove role"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {inheritedRoles.length > 0 && (
              <div>
                <h3 className="font-medium mb-3 text-foreground">
                  Inherited Roles
                </h3>
                <div className="space-y-2">
                  {inheritedRoles.map((inherited, idx) => (
                    <div
                      key={`${inherited.role.id}-${idx}`}
                      className="flex items-center justify-between p-4 rounded-lg border opacity-75 bg-card border-border"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary"
                          style={inherited.role.color ? { backgroundColor: inherited.role.color } : undefined}
                        >
                          <Shield className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {inherited.role.name}
                            </span>
                            <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground">
                              <Link2 className="h-3 w-3" />
                              Inherited
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
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

      {showAddModal && (
        <div className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50">
          <div className="w-full max-w-lg max-h-[80vh] rounded-xl overflow-hidden flex flex-col bg-card shadow-xl">
            <div className="p-4 border-b flex items-center justify-between border-border">
              <h2 className="font-semibold text-foreground">
                Assign Roles
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedRoles([]);
                }}
                className="p-1 rounded transition-colors hover:bg-muted"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={roleSearchQuery}
                  onChange={(e) => setRoleSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary border-border bg-card text-foreground"
                />
              </div>
              {selectedRoles.length > 0 && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {selectedRoles.length} role(s) selected
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {availableRoles.length === 0 ? (
                <div className="text-center py-8">
                  <Shield className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
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
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-card hover:bg-muted'
                        }`}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary"
                          style={role.color ? { backgroundColor: role.color } : undefined}
                        >
                          <Shield className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-foreground">
                            {role.name}
                          </div>
                          <div className="text-xs truncate text-muted-foreground">
                            {role.code}
                          </div>
                        </div>
                        {isSelected && (
                          <Check className="h-5 w-5 flex-shrink-0 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t flex items-center justify-end gap-3 border-border">
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
