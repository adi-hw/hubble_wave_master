import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  Plus,
  Trash2,
  Users,
  Crown,
  Loader2,
  UserCheck,
  X,
} from 'lucide-react';
import identityApi from '../../../services/identityApi';

interface User {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  avatar?: string;
  // Fields from /users endpoint (UserDto)
  displayName?: string;
  workEmail?: string;
}

// Helper function to get display name from user
const getUserDisplayName = (user?: User): string => {
  if (!user) return '';
  if (user.displayName) return user.displayName;
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  return user.email || user.workEmail || '';
};

// Helper function to get email from user
const getUserEmail = (user?: User): string => {
  return user?.email || user?.workEmail || '';
};

// Helper function to get initials from user
const getUserInitials = (user?: User): string => {
  if (!user) return '?';
  if (user.firstName && user.lastName) {
    return `${user.firstName[0]}${user.lastName[0]}`;
  }
  if (user.displayName) {
    const parts = user.displayName.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`;
    }
    return user.displayName.substring(0, 2).toUpperCase();
  }
  const email = user.email || user.workEmail || '';
  return email.substring(0, 2).toUpperCase();
};

interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  isManager: boolean;
  validFrom: string;
  validUntil?: string | null;
  user?: User;
}

interface Group {
  id: string;
  code: string;
  name: string;
  type: string;
  directMemberCount?: number;
  totalMemberCount?: number;
}

export const GroupMembersPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');

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

  // Fetch members
  const fetchMembers = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await identityApi.get<{ data: GroupMember[]; total: number }>(
        `/admin/groups/${id}/members`,
        { params: { search: searchQuery || undefined } }
      );
      setMembers(response.data.data);
      setTotal(response.data.total);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  }, [id, searchQuery]);

  // Fetch available users for adding
  const fetchAvailableUsers = useCallback(async () => {
    try {
      const response = await identityApi.get<{ data: User[] }>('/users', {
        params: { q: userSearchQuery || undefined, pageSize: 50 },
      });
      // Filter out users that are already members
      const memberUserIds = new Set(members.map((m) => m.userId));
      const available = response.data.data.filter((u) => !memberUserIds.has(u.id));
      setAvailableUsers(available);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, [userSearchQuery, members]);

  useEffect(() => {
    fetchGroup();
    fetchMembers();
  }, [fetchGroup, fetchMembers]);

  useEffect(() => {
    if (showAddModal) {
      fetchAvailableUsers();
    }
  }, [showAddModal, fetchAvailableUsers]);

  // Handle remove member
  const handleRemoveMember = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;

    try {
      await identityApi.delete(`/admin/groups/${id}/members/${userId}`);
      fetchMembers();
      fetchGroup();
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  // Handle toggle manager
  const handleToggleManager = async (userId: string, currentIsManager: boolean) => {
    try {
      await identityApi.put(`/admin/groups/${id}/members/${userId}`, {
        isManager: !currentIsManager,
      });
      fetchMembers();
    } catch (err) {
      console.error('Failed to update member:', err);
    }
  };

  // Handle add members
  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return;

    setAddingMembers(true);
    try {
      await identityApi.post(`/admin/groups/${id}/members/bulk`, {
        userIds: selectedUsers,
      });
      setShowAddModal(false);
      setSelectedUsers([]);
      fetchMembers();
      fetchGroup();
    } catch (err) {
      console.error('Failed to add members:', err);
    } finally {
      setAddingMembers(false);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
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
              {group?.name} - Members
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Manage group membership
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <Users className="h-4 w-4" />
              <span>{total} members</span>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
          >
            <Plus className="h-4 w-4" />
            Add Members
          </button>
        </div>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Users className="h-8 w-8 mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {searchQuery ? 'No matching members' : 'No members yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 rounded-lg border"
                style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--bg-primary-subtle)' }}
                  >
                    <span className="text-sm font-medium" style={{ color: 'var(--text-brand)' }}>
                      {getUserInitials(member.user)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {getUserDisplayName(member.user)}
                      </span>
                      {member.isManager && (
                        <span
                          className="flex items-center gap-1 px-2 py-0.5 text-xs rounded"
                          style={{ backgroundColor: 'var(--bg-warning-subtle)', color: 'var(--text-warning)' }}
                        >
                          <Crown className="h-3 w-3" />
                          Manager
                        </span>
                      )}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {getUserEmail(member.user)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleManager(member.userId, member.isManager)}
                    className="p-2 rounded-lg transition-colors"
                    style={{
                      backgroundColor: member.isManager ? 'var(--bg-warning-subtle)' : 'transparent',
                      color: member.isManager ? 'var(--text-warning)' : 'var(--text-muted)',
                    }}
                    onMouseEnter={(e) => !member.isManager && (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => !member.isManager && (e.currentTarget.style.backgroundColor = 'transparent')}
                    title={member.isManager ? 'Remove manager role' : 'Make manager'}
                  >
                    <Crown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member.userId)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: 'var(--text-danger)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-danger-subtle)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    title="Remove member"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Members Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="w-full max-w-lg max-h-[80vh] rounded-xl overflow-hidden flex flex-col"
            style={{ backgroundColor: 'var(--bg-elevated)', boxShadow: 'var(--shadow-xl)' }}
          >
            {/* Modal Header */}
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-default)' }}>
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Add Members
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedUsers([]);
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
                  placeholder="Search users..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
              </div>
              {selectedUsers.length > 0 && (
                <div className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {selectedUsers.length} user(s) selected
                </div>
              )}
            </div>

            {/* User List */}
            <div className="flex-1 overflow-y-auto p-4">
              {availableUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    No users available
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {availableUsers.map((user) => {
                    const isSelected = selectedUsers.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        onClick={() => toggleUserSelection(user.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors"
                        style={{
                          borderColor: isSelected ? 'var(--border-brand)' : 'var(--border-default)',
                          backgroundColor: isSelected ? 'var(--bg-primary-subtle)' : 'var(--bg-surface)',
                        }}
                        onMouseEnter={(e) => !isSelected && (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                        onMouseLeave={(e) => !isSelected && (e.currentTarget.style.backgroundColor = isSelected ? 'var(--bg-primary-subtle)' : 'var(--bg-surface)')}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'var(--bg-primary-subtle)' }}
                        >
                          <span className="text-xs font-medium" style={{ color: 'var(--text-brand)' }}>
                            {getUserInitials(user)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {getUserDisplayName(user)}
                          </div>
                          <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            {getUserEmail(user)}
                          </div>
                        </div>
                        {isSelected && (
                          <UserCheck className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-brand)' }} />
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
                  setSelectedUsers([]);
                }}
                className="btn-secondary px-4 py-2 text-sm rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMembers}
                disabled={selectedUsers.length === 0 || addingMembers}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm rounded-lg disabled:opacity-50"
              >
                {addingMembers ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add {selectedUsers.length || ''} Member{selectedUsers.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupMembersPage;
