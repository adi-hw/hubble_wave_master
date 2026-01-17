import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  User,
  Mail,
  MoreHorizontal,
  UserPlus,
  Shield,
  AlertCircle,
  Building,
  RefreshCw,
} from 'lucide-react';
import identityApi from '../../../services/identityApi';

// Status type matching backend UserStatus
type UserStatus = 'invited' | 'pending_activation' | 'active' | 'inactive' | 'suspended' | 'locked' | 'deleted';

interface UserData {
  id: string;
  displayName: string;
  workEmail: string;
  employeeId?: string;
  title?: string;
  department?: string;
  status: UserStatus;
  isAdmin: boolean;
  invitedAt?: string;
  activatedAt?: string;
  lastLoginAt?: string;
  avatarUrl?: string;
}

interface UsersListResult {
  data: UserData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const statusLabels: Record<UserStatus, string> = {
  invited: 'Invited',
  pending_activation: 'Pending',
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
  locked: 'Locked',
  deleted: 'Deleted',
};

// Theme-aware status styles using Tailwind classes
const statusStyles: Record<UserStatus, { bg: string; text: string; dot: string }> = {
  invited: { bg: 'bg-info-subtle', text: 'text-info-text', dot: 'bg-info' },
  pending_activation: { bg: 'bg-warning-subtle', text: 'text-warning-text', dot: 'bg-warning' },
  active: { bg: 'bg-success-subtle', text: 'text-success-text', dot: 'bg-success' },
  inactive: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  suspended: { bg: 'bg-danger-subtle', text: 'text-danger-text', dot: 'bg-danger' },
  locked: { bg: 'bg-warning-subtle', text: 'text-warning-text', dot: 'bg-warning' },
  deleted: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground/50' },
};

// Status counts type
type StatusCounts = Record<UserStatus, number>;

export const UsersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    invited: 0,
    pending_activation: 0,
    active: 0,
    inactive: 0,
    suspended: 0,
    locked: 0,
    deleted: 0,
  });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  // Fetch status counts (runs once on mount and after actions)
  const fetchStatusCounts = async () => {
    try {
      // Fetch a large page without filters to count statuses
      const response = await identityApi.get<UsersListResult>(`/users?pageSize=1000`);
      const allUsers = response.data.data;
      const counts: StatusCounts = {
        invited: 0,
        pending_activation: 0,
        active: 0,
        inactive: 0,
        suspended: 0,
        locked: 0,
        deleted: 0,
      };
      allUsers.forEach(u => {
        if (counts[u.status] !== undefined) {
          counts[u.status]++;
        }
      });
      setStatusCounts(counts);
    } catch (error) {
      console.error('Failed to fetch status counts:', error);
    }
  };

  // Fetch users from API
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('q', searchQuery);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (departmentFilter !== 'all') params.set('department', departmentFilter);
      params.set('page', pagination.page.toString());
      params.set('pageSize', pagination.pageSize.toString());

      const response = await identityApi.get<UsersListResult>(`/users?${params.toString()}`);
      setUsers(response.data.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.total,
        totalPages: response.data.totalPages,
      }));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch status counts on mount
  useEffect(() => {
    fetchStatusCounts();
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [searchQuery, statusFilter, departmentFilter, pagination.page]);

  // Handle user actions
  const handleAction = async (userId: string, action: string) => {
    setActionMenuOpen(null);
    try {
      switch (action) {
        case 'deactivate':
          await identityApi.post(`/users/${userId}/deactivate`);
          break;
        case 'reactivate':
          await identityApi.post(`/users/${userId}/reactivate`);
          break;
        case 'suspend':
          await identityApi.post(`/users/${userId}/suspend`, { reason: 'Suspended by admin' });
          break;
        case 'unsuspend':
          await identityApi.post(`/users/${userId}/unsuspend`);
          break;
        case 'unlock':
          await identityApi.post(`/users/${userId}/unlock`);
          break;
        case 'resend-invitation':
          await identityApi.post(`/users/${userId}/resend-invitation`);
          break;
        case 'delete':
          await identityApi.delete(`/users/${userId}`);
          break;
        default:
          return;
      }
      fetchUsers(); // Refresh list
      fetchStatusCounts(); // Refresh counts after status change
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
    }
  };

  // Get unique departments for filter
  const departments = Array.from(new Set(users.map(u => u.department).filter(Boolean)));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Users
          </h1>
          <p className="text-sm mt-1 text-muted-foreground">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchUsers()}
            className="btn-secondary flex items-center gap-2 px-3 py-2 rounded-lg"
            aria-label="Refresh users list"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
          <button
            onClick={() => navigate('/studio/users/invite')}
            className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg"
          >
            <UserPlus className="h-4 w-4" />
            Invite User
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {(['active', 'invited', 'inactive', 'suspended', 'locked'] as UserStatus[]).map((status) => {
          const count = statusCounts[status];
          const colors = statusStyles[status];
          const isSelected = statusFilter === status;
          return (
            <div
              key={status}
              className={`rounded-xl border p-3 cursor-pointer transition-all hover:shadow-md bg-card ${
                isSelected ? 'border-primary ring-1 ring-primary' : 'border-border'
              }`}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-foreground">
                    {count}
                  </div>
                  <div className="text-xs capitalize text-muted-foreground">
                    {statusLabels[status]}
                  </div>
                </div>
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center ${colors.bg}`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${colors.dot}`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, or employee ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as UserStatus | 'all')}
            className="px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Status</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          {departments.length > 0 && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted">
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                User
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Department
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Role
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Last Activity
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading users...</p>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No users found</p>
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const colors = statusStyles[user.status];
                return (
                  <tr
                    key={user.id}
                    className="cursor-pointer transition-colors border-b border-border/50 hover:bg-muted/50"
                    onClick={() => navigate(`/studio/users/${user.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full flex items-center justify-center overflow-hidden bg-muted">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-foreground">
                            {user.displayName}
                            {user.isAdmin && (
                              <span title="Administrator"><Shield className="inline-block h-3.5 w-3.5 ml-1.5 text-warning-text" /></span>
                            )}
                          </div>
                          <div className="text-sm flex items-center gap-1 text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            {user.workEmail}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.department ? (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Building className="h-3.5 w-3.5" />
                          {user.department}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${colors.dot}`}
                        />
                        {statusLabels[user.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {user.title || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleDateString()
                        : user.activatedAt
                        ? `Activated ${new Date(user.activatedAt).toLocaleDateString()}`
                        : user.invitedAt
                        ? `Invited ${new Date(user.invitedAt).toLocaleDateString()}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-right relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionMenuOpen(actionMenuOpen === user.id ? null : user.id);
                        }}
                        className="p-1.5 rounded transition-colors hover:bg-muted"
                        aria-label={`Actions for ${user.displayName}`}
                        aria-expanded={actionMenuOpen === user.id}
                        aria-haspopup="menu"
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      </button>

                      {actionMenuOpen === user.id && (
                        <div
                          className="absolute right-0 mt-1 w-48 rounded-lg border border-border z-10 bg-popover shadow-lg"
                          onClick={(e) => e.stopPropagation()}
                          role="menu"
                          aria-label={`Actions for ${user.displayName}`}
                        >
                          <div className="py-1">
                            {user.status === 'invited' && (
                              <button
                                onClick={() => handleAction(user.id, 'resend-invitation')}
                                className="w-full text-left px-4 py-2 text-sm transition-colors text-foreground hover:bg-muted"
                              >
                                Resend Invitation
                              </button>
                            )}
                            {user.status === 'active' && (
                              <>
                                <button
                                  onClick={() => handleAction(user.id, 'suspend')}
                                  className="w-full text-left px-4 py-2 text-sm transition-colors text-foreground hover:bg-muted"
                                >
                                  Suspend User
                                </button>
                                <button
                                  onClick={() => handleAction(user.id, 'deactivate')}
                                  className="w-full text-left px-4 py-2 text-sm transition-colors text-foreground hover:bg-muted"
                                >
                                  Deactivate User
                                </button>
                              </>
                            )}
                            {user.status === 'inactive' && (
                              <button
                                onClick={() => handleAction(user.id, 'reactivate')}
                                className="w-full text-left px-4 py-2 text-sm transition-colors text-foreground hover:bg-muted"
                              >
                                Reactivate User
                              </button>
                            )}
                            {user.status === 'suspended' && (
                              <button
                                onClick={() => handleAction(user.id, 'unsuspend')}
                                className="w-full text-left px-4 py-2 text-sm transition-colors text-foreground hover:bg-muted"
                              >
                                Unsuspend User
                              </button>
                            )}
                            {user.status === 'locked' && (
                              <button
                                onClick={() => handleAction(user.id, 'unlock')}
                                className="w-full text-left px-4 py-2 text-sm transition-colors text-foreground hover:bg-muted"
                              >
                                Unlock User
                              </button>
                            )}
                            <hr className="my-1 border-border" />
                            <button
                              onClick={() => handleAction(user.id, 'delete')}
                              className="w-full text-left px-4 py-2 text-sm transition-colors text-destructive hover:bg-destructive/10"
                            >
                              Delete User
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="text-sm text-muted-foreground">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} users
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="btn-secondary px-3 py-1.5 text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="btn-secondary px-3 py-1.5 text-sm rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersListPage;
