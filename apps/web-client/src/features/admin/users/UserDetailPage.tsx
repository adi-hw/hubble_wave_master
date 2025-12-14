import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  Users,
  Edit,
  Save,
  X,
  AlertCircle,
  History,
  Key,
  Ban,
  UserCheck,
  RefreshCw,
  Trash2,
} from 'lucide-react';

type TenantUserStatus = 'invited' | 'pending_activation' | 'active' | 'inactive' | 'suspended' | 'deleted';

interface TenantUser {
  id: string;
  userAccountId?: string;
  displayName: string;
  workEmail: string;
  employeeId?: string;
  title?: string;
  department?: string;
  location?: string;
  costCenter?: string;
  workPhone?: string;
  mobilePhone?: string;
  avatarUrl?: string;
  locale: string;
  timeZone: string;
  status: TenantUserStatus;
  isTenantAdmin: boolean;
  invitedAt?: string;
  invitedBy?: string;
  activatedAt?: string;
  lastLoginAt?: string;
  deactivatedAt?: string;
  deactivationReason?: string;
  suspendedAt?: string;
  suspensionReason?: string;
  suspensionExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Role {
  id: string;
  name: string;
  slug: string;
}

interface Group {
  id: string;
  name: string;
}

interface AuditLogEntry {
  id: string;
  action: string;
  actorId?: string;
  actorName?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  createdAt: string;
}

const statusColors: Record<TenantUserStatus, { bg: string; text: string; dot: string }> = {
  invited: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  pending_activation: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  active: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
  inactive: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-600 dark:text-slate-400', dot: 'bg-slate-400' },
  suspended: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  deleted: { bg: 'bg-slate-100 dark:bg-slate-700', text: 'text-slate-500 dark:text-slate-500', dot: 'bg-slate-300' },
};

const statusLabels: Record<TenantUserStatus, string> = {
  invited: 'Invited',
  pending_activation: 'Pending',
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
  deleted: 'Deleted',
};

export const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<TenantUser | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'roles' | 'audit'>('profile');

  const [editData, setEditData] = useState<Partial<TenantUser>>({});

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [userRes, rolesRes, groupsRes, auditRes] = await Promise.all([
          fetch(`/api/tenant-users/${id}`, { credentials: 'include' }),
          fetch(`/api/tenant-users/${id}/roles`, { credentials: 'include' }),
          fetch(`/api/tenant-users/${id}/groups`, { credentials: 'include' }),
          fetch(`/api/tenant-users/${id}/audit?limit=20`, { credentials: 'include' }),
        ]);

        if (userRes.ok) {
          const userData = await userRes.json();
          setUser(userData);
          setEditData(userData);
        }
        if (rolesRes.ok) {
          setRoles(await rolesRes.json());
        }
        if (groupsRes.ok) {
          setGroups(await groupsRes.json());
        }
        if (auditRes.ok) {
          setAuditLog(await auditRes.json());
        }
      } catch (err) {
        setError('Failed to load user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/tenant-users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editData),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUser(updatedUser);
        setIsEditing(false);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to update user');
      }
    } catch (err) {
      setError('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: string, payload?: Record<string, unknown>) => {
    if (!id) return;
    try {
      let endpoint = `/api/tenant-users/${id}/${action}`;
      let method = 'POST';

      if (action === 'delete') {
        endpoint = `/api/tenant-users/${id}`;
        method = 'DELETE';
      }

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: payload ? JSON.stringify(payload) : undefined,
      });

      if (response.ok) {
        if (action === 'delete') {
          navigate('/studio/users');
        } else {
          // Refresh user data
          const userRes = await fetch(`/api/tenant-users/${id}`, { credentials: 'include' });
          if (userRes.ok) {
            setUser(await userRes.json());
          }
        }
      }
    } catch (err) {
      setError(`Failed to ${action} user`);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin" style={{ color: 'var(--hw-text-muted)' }} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--hw-text-muted)' }} />
        <p style={{ color: 'var(--hw-text-muted)' }}>User not found</p>
      </div>
    );
  }

  const colors = statusColors[user.status];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/studio/users')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" style={{ color: 'var(--hw-text-muted)' }} />
          </button>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-8 w-8" style={{ color: 'var(--hw-text-muted)' }} />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold" style={{ color: 'var(--hw-text)' }}>
                  {user.displayName}
                </h1>
                {user.isTenantAdmin && (
                  <span title="Administrator"><Shield className="h-5 w-5 text-amber-500" /></span>
                )}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                  {statusLabels[user.status]}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm" style={{ color: 'var(--hw-text-muted)' }}>
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  {user.workEmail}
                </span>
                {user.employeeId && (
                  <span className="flex items-center gap-1">
                    <Key className="h-3.5 w-3.5" />
                    {user.employeeId}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditData(user);
                }}
                className="px-3 py-2 border rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                style={{ borderColor: 'var(--hw-border)' }}
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                style={{ borderColor: 'var(--hw-border)' }}
              >
                <Edit className="h-4 w-4" />
                Edit
              </button>
              {user.status === 'active' && (
                <button
                  onClick={() => handleAction('suspend', { reason: 'Suspended by admin' })}
                  className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-600 rounded-lg transition-colors hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Ban className="h-4 w-4" />
                  Suspend
                </button>
              )}
              {user.status === 'suspended' && (
                <button
                  onClick={() => handleAction('unsuspend')}
                  className="flex items-center gap-2 px-3 py-2 border border-green-200 text-green-600 rounded-lg transition-colors hover:bg-green-50 dark:hover:bg-green-900/20"
                >
                  <UserCheck className="h-4 w-4" />
                  Unsuspend
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b mb-6" style={{ borderColor: 'var(--hw-border)' }}>
        <nav className="flex gap-6">
          {(['profile', 'roles', 'audit'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent hover:border-slate-300'
              }`}
              style={{ color: activeTab === tab ? undefined : 'var(--hw-text-muted)' }}
            >
              {tab === 'profile' && 'Profile'}
              {tab === 'roles' && 'Roles & Groups'}
              {tab === 'audit' && 'Activity Log'}
            </button>
          ))}
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Personal Info */}
          <div
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
          >
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--hw-text)' }}>
              Personal Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Display Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="displayName"
                    value={editData.displayName || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
                    style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-bg)' }}
                  />
                ) : (
                  <p style={{ color: 'var(--hw-text)' }}>{user.displayName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Job Title
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="title"
                    value={editData.title || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
                    style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-bg)' }}
                  />
                ) : (
                  <p style={{ color: 'var(--hw-text)' }}>{user.title || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Department
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="department"
                    value={editData.department || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
                    style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-bg)' }}
                  />
                ) : (
                  <p style={{ color: 'var(--hw-text)' }}>{user.department || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Location
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="location"
                    value={editData.location || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
                    style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-bg)' }}
                  />
                ) : (
                  <p style={{ color: 'var(--hw-text)' }}>{user.location || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
          >
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--hw-text)' }}>
              Contact Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Email
                </label>
                <p style={{ color: 'var(--hw-text)' }}>{user.workEmail}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Work Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="workPhone"
                    value={editData.workPhone || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
                    style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-bg)' }}
                  />
                ) : (
                  <p style={{ color: 'var(--hw-text)' }}>{user.workPhone || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Mobile Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="mobilePhone"
                    value={editData.mobilePhone || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg"
                    style={{ borderColor: 'var(--hw-border)', backgroundColor: 'var(--hw-bg)' }}
                  />
                ) : (
                  <p style={{ color: 'var(--hw-text)' }}>{user.mobilePhone || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Status Info */}
          <div
            className="rounded-xl border p-6 lg:col-span-2"
            style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
          >
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--hw-text)' }}>
              Account Status
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Status
                </label>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
                  {statusLabels[user.status]}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Invited
                </label>
                <p className="text-sm" style={{ color: 'var(--hw-text)' }}>
                  {user.invitedAt ? new Date(user.invitedAt).toLocaleString() : '-'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Activated
                </label>
                <p className="text-sm" style={{ color: 'var(--hw-text)' }}>
                  {user.activatedAt ? new Date(user.activatedAt).toLocaleString() : '-'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--hw-text-muted)' }}>
                  Last Login
                </label>
                <p className="text-sm" style={{ color: 'var(--hw-text)' }}>
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '-'}
                </p>
              </div>
            </div>

            {user.status === 'suspended' && user.suspensionReason && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-300">
                  <strong>Suspension Reason:</strong> {user.suspensionReason}
                </p>
                {user.suspensionExpiresAt && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    Expires: {new Date(user.suspensionExpiresAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium flex items-center gap-2" style={{ color: 'var(--hw-text)' }}>
                <Shield className="h-5 w-5" />
                Roles
              </h3>
            </div>
            {roles.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>No roles assigned</p>
            ) : (
              <div className="space-y-2">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    style={{ borderColor: 'var(--hw-border)' }}
                  >
                    <div>
                      <div className="font-medium" style={{ color: 'var(--hw-text)' }}>{role.name}</div>
                      <div className="text-xs" style={{ color: 'var(--hw-text-muted)' }}>{role.slug}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium flex items-center gap-2" style={{ color: 'var(--hw-text)' }}>
                <Users className="h-5 w-5" />
                Groups
              </h3>
            </div>
            {groups.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>No group memberships</p>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                    style={{ borderColor: 'var(--hw-border)' }}
                  >
                    <div className="font-medium" style={{ color: 'var(--hw-text)' }}>{group.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit Tab */}
      {activeTab === 'audit' && (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ backgroundColor: 'var(--hw-surface)', borderColor: 'var(--hw-border)' }}
        >
          {auditLog.length === 0 ? (
            <div className="p-8 text-center">
              <History className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--hw-text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--hw-text-muted)' }}>No activity recorded</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--hw-border)' }}>
              {auditLog.map((entry) => (
                <div key={entry.id} className="flex items-start gap-4 p-4">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--hw-bg-subtle)' }}
                  >
                    <History className="h-4 w-4" style={{ color: 'var(--hw-text-muted)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize" style={{ color: 'var(--hw-text)' }}>
                        {entry.action.replace(/_/g, ' ')}
                      </span>
                      {entry.actorName && (
                        <>
                          <span style={{ color: 'var(--hw-text-muted)' }}>by</span>
                          <span style={{ color: 'var(--hw-text-secondary)' }}>{entry.actorName}</span>
                        </>
                      )}
                    </div>
                    <div className="text-sm mt-1" style={{ color: 'var(--hw-text-muted)' }}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Danger Zone */}
      <div className="mt-8">
        <div
          className="rounded-xl border border-red-200 dark:border-red-800 p-6"
          style={{ backgroundColor: 'var(--hw-surface)' }}
        >
          <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">Danger Zone</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--hw-text-muted)' }}>
            These actions are destructive and cannot be undone.
          </p>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                handleAction('delete');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete User
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailPage;
