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
  displayName?: string;
  workEmail?: string;
}

const getUserDisplayName = (user?: User): string => {
  if (!user) return '';
  if (user.displayName) return user.displayName;
  if (user.firstName || user.lastName) {
    return `${user.firstName || ''} ${user.lastName || ''}`.trim();
  }
  return user.email || user.workEmail || '';
};

const getUserEmail = (user?: User): string => {
  return user?.email || user?.workEmail || '';
};

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

  const fetchGroup = useCallback(async () => {
    if (!id) return;
    try {
      const response = await identityApi.get<{ data: Group }>(`/admin/groups/${id}`);
      setGroup(response.data.data);
    } catch (err) {
      console.error('Failed to fetch group:', err);
    }
  }, [id]);

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

  const fetchAvailableUsers = useCallback(async () => {
    try {
      const response = await identityApi.get<{ data: User[] }>('/users', {
        params: { q: userSearchQuery || undefined, pageSize: 50 },
      });
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
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/studio/groups')}
            className="p-2 rounded-lg transition-colors bg-transparent hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {group?.name} - Members
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage group membership
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
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

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <Users className="h-8 w-8 mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'No matching members' : 'No members yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card border-border"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10">
                    <span className="text-sm font-medium text-primary">
                      {getUserInitials(member.user)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {getUserDisplayName(member.user)}
                      </span>
                      {member.isManager && (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-warning-subtle text-warning-text">
                          <Crown className="h-3 w-3" />
                          Manager
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {getUserEmail(member.user)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleManager(member.userId, member.isManager)}
                    className={`p-2 rounded-lg transition-colors ${
                      member.isManager
                        ? 'bg-warning-subtle text-warning-text'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                    title={member.isManager ? 'Remove manager role' : 'Make manager'}
                  >
                    <Crown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleRemoveMember(member.userId)}
                    className="p-2 rounded-lg transition-colors text-destructive hover:bg-destructive/10"
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

      {showAddModal && (
        <div className="fixed inset-0 bg-overlay/50 flex items-center justify-center z-50">
          <div className="w-full max-w-lg max-h-[80vh] rounded-xl overflow-hidden flex flex-col bg-card shadow-xl">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-foreground">
                Add Members
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedUsers([]);
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
                  placeholder="Search users..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {selectedUsers.length > 0 && (
                <div className="mt-2 text-sm text-muted-foreground">
                  {selectedUsers.length} user(s) selected
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {availableUsers.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
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
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-card hover:bg-muted'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10">
                          <span className="text-xs font-medium text-primary">
                            {getUserInitials(user)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-foreground">
                            {getUserDisplayName(user)}
                          </div>
                          <div className="text-xs truncate text-muted-foreground">
                            {getUserEmail(user)}
                          </div>
                        </div>
                        {isSelected && (
                          <UserCheck className="h-5 w-5 flex-shrink-0 text-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border flex items-center justify-end gap-3">
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
