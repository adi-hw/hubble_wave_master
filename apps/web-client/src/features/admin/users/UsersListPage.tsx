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

// Status type matching backend TenantUserStatus
type TenantUserStatus = 'invited' | 'pending_activation' | 'active' | 'inactive' | 'suspended' | 'deleted';

interface TenantUser {
  id: string;
  displayName: string;
  workEmail: string;
  employeeId?: string;
  title?: string;
  department?: string;
  status: TenantUserStatus;
  isTenantAdmin: boolean;
  invitedAt?: string;
  activatedAt?: string;
  lastLoginAt?: string;
  avatarUrl?: string;
}

interface UsersListResult {
  data: TenantUser[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const statusLabels: Record<TenantUserStatus, string> = {
  invited: 'Invited',
  pending_activation: 'Pending',
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
  deleted: 'Deleted',
};

const statusColors: Record<TenantUserStatus, { bg: string; text: string; dot: string }> = {
  invited: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  pending_activation: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
  inactive: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
  suspended: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  deleted: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-500', dot: 'bg-slate-300' },
};

export const UsersListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TenantUserStatus | 'all'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

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

      const response = await identityApi.get<UsersListResult>(`/tenant-users?${params.toString()}`);
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

  useEffect(() => {
    fetchUsers();
  }, [searchQuery, statusFilter, departmentFilter, pagination.page]);

  // Handle user actions
  const handleAction = async (userId: string, action: string) => {
    setActionMenuOpen(null);
    try {
      switch (action) {
        case 'deactivate':
          await identityApi.post(`/tenant-users/${userId}/deactivate`);
          break;
        case 'reactivate':
          await identityApi.post(`/tenant-users/${userId}/reactivate`);
          break;
        case 'suspend':
          await identityApi.post(`/tenant-users/${userId}/suspend`, { reason: 'Suspended by admin' });
          break;
        case 'unsuspend':
          await identityApi.post(`/tenant-users/${userId}/unsuspend`);
          break;
        case 'resend-invitation':
          await identityApi.post(`/tenant-users/${userId}/resend-invitation`);
          break;
        case 'delete':
          await identityApi.delete(`/tenant-users/${userId}`);
          break;
        default:
          return;
      }
      fetchUsers(); // Refresh list
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
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--hw-text)' }}>
            Users
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchUsers()}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
            style={{ borderColor: 'var(--hw-border)' }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/studio/users/invite')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <UserPlus className="h-4 w-4" />
            Invite User
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {(['active', 'invited', 'inactive', 'suspended'] as TenantUserStatus[]).map((status) => {
          const count = users.filter(u => u.status === status).length;
          const colors = statusColors[status];
          return (
            <div
              key={status}
              className="rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md"
              style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-semibold" style={{ color: 'var(--hw-text)' }}>
                    {count}
                  </div>
                  <div className="text-sm capitalize" style={{ color: 'var(--hw-text-muted)' }}>
                    {statusLabels[status]}
                  </div>
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colors.bg}`}>
                  <span className={`h-3 w-3 rounded-full ${colors.dot}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or employee ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-surface)' }}
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TenantUserStatus | 'all')}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-surface)' }}
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
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-surface)' }}
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
      <div
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
      >
        <table className="w-full">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-bg-subtle)' }}>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--hw-text-muted)' }}>
                User
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--hw-text-muted)' }}>
                Department
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--hw-text-muted)' }}>
                Status
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--hw-text-muted)' }}>
                Role
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--hw-text-muted)' }}>
                Last Activity
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--hw-text-muted)' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--hw-border)' }}>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" style={{ color: 'var(--hw-text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>Loading users...</p>
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <AlertCircle className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--hw-text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>No users found</p>
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const colors = statusColors[user.status];
                return (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/studio/users/${user.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                          {user.avatarUrl ? (
                            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <User className="h-5 w-5" style={{ color: 'var(--hw-text-muted)' }} />
                          )}
                        </div>
                        <div>
                          <div className="font-medium" style={{ color: 'var(--hw-text)' }}>
                            {user.displayName}
                            {user.isTenantAdmin && (
                              <span title="Administrator"><Shield className="inline-block h-3.5 w-3.5 ml-1.5 text-amber-500" /></span>
                            )}
                          </div>
                          <div className="text-sm flex items-center gap-1" style={{ color: 'var(--hw-text-muted)' }}>
                            <Mail className="h-3 w-3" />
                            {user.workEmail}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {user.department ? (
                        <div className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--hw-text-secondary)' }}>
                          <Building className="h-3.5 w-3.5" />
                          {user.department}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--hw-text-muted)' }}>-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                        {statusLabels[user.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--hw-text-secondary)' }}>
                      {user.title || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--hw-text-muted)' }}>
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
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                      >
                        <MoreHorizontal className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
                      </button>

                      {actionMenuOpen === user.id && (
                        <div
                          className="absolute right-0 mt-1 w-48 rounded-lg border shadow-lg z-10"
                          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="py-1">
                            {user.status === 'invited' && (
                              <button
                                onClick={() => handleAction(user.id, 'resend-invitation')}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                                style={{ color: 'var(--hw-text)' }}
                              >
                                Resend Invitation
                              </button>
                            )}
                            {user.status === 'active' && (
                              <>
                                <button
                                  onClick={() => handleAction(user.id, 'suspend')}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                                  style={{ color: 'var(--hw-text)' }}
                                >
                                  Suspend User
                                </button>
                                <button
                                  onClick={() => handleAction(user.id, 'deactivate')}
                                  className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                                  style={{ color: 'var(--hw-text)' }}
                                >
                                  Deactivate User
                                </button>
                              </>
                            )}
                            {user.status === 'inactive' && (
                              <button
                                onClick={() => handleAction(user.id, 'reactivate')}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                                style={{ color: 'var(--hw-text)' }}
                              >
                                Reactivate User
                              </button>
                            )}
                            {user.status === 'suspended' && (
                              <button
                                onClick={() => handleAction(user.id, 'unsuspend')}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                                style={{ color: 'var(--hw-text)' }}
                              >
                                Unsuspend User
                              </button>
                            )}
                            <hr className="my-1" style={{ borderColor: 'var(--hw-border)' }} />
                            <button
                              onClick={() => handleAction(user.id, 'delete')}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
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
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--hw-border)' }}>
            <div className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>
              Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} users
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 text-sm border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
                style={{ borderColor: 'var(--hw-border)' }}
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1.5 text-sm border rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800"
                style={{ borderColor: 'var(--hw-border)' }}
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
