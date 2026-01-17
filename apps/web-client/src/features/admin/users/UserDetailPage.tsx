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
import identityApi from '../../../services/identityApi';

type UserStatus = 'invited' | 'pending_activation' | 'active' | 'inactive' | 'suspended' | 'deleted';

interface UserData {
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
  status: UserStatus;
  isAdmin: boolean;
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
  description?: string;
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

const statusStyles: Record<UserStatus, { containerClass: string; textClass: string; dotClass: string }> = {
  invited: { containerClass: 'bg-info-subtle', textClass: 'text-info-text', dotClass: 'bg-info' },
  pending_activation: { containerClass: 'bg-warning-subtle', textClass: 'text-warning-text', dotClass: 'bg-warning' },
  active: { containerClass: 'bg-success-subtle', textClass: 'text-success-text', dotClass: 'bg-success' },
  inactive: { containerClass: 'bg-muted', textClass: 'text-muted-foreground', dotClass: 'bg-muted-foreground' },
  suspended: { containerClass: 'bg-danger-subtle', textClass: 'text-danger-text', dotClass: 'bg-danger' },
  deleted: { containerClass: 'bg-muted', textClass: 'text-muted-foreground', dotClass: 'bg-muted-foreground/50' },
};

const statusLabels: Record<UserStatus, string> = {
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
  const [user, setUser] = useState<UserData | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'roles' | 'audit'>('profile');

  const [editData, setEditData] = useState<Partial<UserData>>({});

  useEffect(() => {
    const fetchUser = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const [userRes, rolesRes, groupsRes, auditRes] = await Promise.all([
          identityApi.get<{ data: UserData } | UserData>(`/users/${id}`),
          identityApi.get<Role[] | { data: Role[] }>(`/users/${id}/roles`),
          identityApi.get<Group[] | { data: Group[] }>(`/users/${id}/groups`),
          identityApi.get<AuditLogEntry[] | { data: AuditLogEntry[] }>(`/users/${id}/audit?limit=20`),
        ]);

        const userData = userRes.data;
        const userObj = (userData && typeof userData === 'object' && 'data' in userData && (userData as { data: UserData }).data)
          ? (userData as { data: UserData }).data
          : (userData as UserData);
        setUser(userObj);
        setEditData(userObj);
        const rolesData = rolesRes.data;
        setRoles(Array.isArray(rolesData) ? rolesData : (rolesData?.data ?? []));
        const groupsData = groupsRes.data;
        setGroups(Array.isArray(groupsData) ? groupsData : (groupsData?.data ?? []));
        const auditData = auditRes.data;
        const auditEntries = Array.isArray(auditData) ? auditData : (auditData?.data ?? []);
        const uniqueEntries = auditEntries.filter(
          (entry: AuditLogEntry, index: number, self: AuditLogEntry[]) =>
            index === self.findIndex((e) => e.id === entry.id)
        );
        setAuditLog(uniqueEntries);
      } catch (err) {
        setError('Failed to load user data');
        setRoles([]);
        setGroups([]);
        setAuditLog([]);
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
      const response = await identityApi.patch<UserData>(`/users/${id}`, editData);
      setUser(response.data);
      setIsEditing(false);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to update user';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (action: string, payload?: Record<string, unknown>) => {
    if (!id) return;
    try {
      if (action === 'delete') {
        await identityApi.delete(`/users/${id}`);
        navigate('/studio/users');
      } else {
        await identityApi.post(`/users/${id}/${action}`, payload || {});
        const userRes = await identityApi.get<UserData>(`/users/${id}`);
        setUser(userRes.data);
      }
    } catch (err) {
      setError(`Failed to ${action} user`);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-muted-foreground">User not found</p>
      </div>
    );
  }

  const statusStyle = statusStyles[user.status];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/studio/users')}
            className="p-2 rounded-lg transition-colors hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full flex items-center justify-center overflow-hidden bg-muted">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-foreground">
                  {user.displayName}
                </h1>
                {user.isAdmin && (
                  <span title="Administrator"><Shield className="h-5 w-5 text-warning-text" /></span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.containerClass} ${statusStyle.textClass}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dotClass}`} />
                  {statusLabels[user.status]}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
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
                className="btn-secondary p-2 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center gap-2 px-4 py-2 rounded-lg disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="btn-secondary flex items-center gap-2 px-3 py-2 rounded-lg"
              >
                <Edit className="h-4 w-4" />
                Edit
              </button>
              {user.status === 'active' && (
                <button
                  onClick={() => handleAction('suspend', { reason: 'Suspended by admin' })}
                  className="flex items-center gap-2 px-3 py-2 border border-destructive text-destructive rounded-lg transition-colors hover:bg-danger-subtle"
                >
                  <Ban className="h-4 w-4" />
                  Suspend
                </button>
              )}
              {user.status === 'suspended' && (
                <button
                  onClick={() => handleAction('unsuspend')}
                  className="flex items-center gap-2 px-3 py-2 border border-success-border text-success-text rounded-lg transition-colors hover:bg-success-subtle"
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
        <div className="mb-6 p-4 rounded-lg border border-destructive bg-danger-subtle flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      <div className="border-b border-border mb-6">
        <nav className="flex gap-6">
          {(['profile', 'roles', 'audit'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border'
              }`}
            >
              {tab === 'profile' && 'Profile'}
              {tab === 'roles' && 'Roles & Groups'}
              {tab === 'audit' && 'Activity Log'}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-lg font-medium mb-4 text-foreground">
              Personal Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Display Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="displayName"
                    value={editData.displayName || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <p className="text-foreground">{user.displayName}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Job Title
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="title"
                    value={editData.title || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <p className="text-foreground">{user.title || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Department
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="department"
                    value={editData.department || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <p className="text-foreground">{user.department || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Location
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="location"
                    value={editData.location || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <p className="text-foreground">{user.location || '-'}</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-lg font-medium mb-4 text-foreground">
              Contact Information
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Email
                </label>
                <p className="text-foreground">{user.workEmail}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Work Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="workPhone"
                    value={editData.workPhone || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <p className="text-foreground">{user.workPhone || '-'}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Mobile Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="mobilePhone"
                    value={editData.mobilePhone || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <p className="text-foreground">{user.mobilePhone || '-'}</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
            <h3 className="text-lg font-medium mb-4 text-foreground">
              Account Status
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Status
                </label>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.containerClass} ${statusStyle.textClass}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dotClass}`} />
                  {statusLabels[user.status]}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Invited
                </label>
                <p className="text-sm text-foreground">
                  {user.invitedAt ? new Date(user.invitedAt).toLocaleString() : '-'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Activated
                </label>
                <p className="text-sm text-foreground">
                  {user.activatedAt ? new Date(user.activatedAt).toLocaleString() : '-'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-muted-foreground">
                  Last Login
                </label>
                <p className="text-sm text-foreground">
                  {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : '-'}
                </p>
              </div>
            </div>

            {user.status === 'suspended' && user.suspensionReason && (
              <div className="mt-4 p-3 rounded-lg bg-danger-subtle">
                <p className="text-sm text-destructive">
                  <strong>Suspension Reason:</strong> {user.suspensionReason}
                </p>
                {user.suspensionExpiresAt && (
                  <p className="text-sm mt-1 text-destructive">
                    Expires: {new Date(user.suspensionExpiresAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium flex items-center gap-2 text-foreground">
                <Shield className="h-5 w-5" />
                Roles
              </h3>
            </div>
            {roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles assigned</p>
            ) : (
              <div className="space-y-2">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div>
                      <div className="font-medium text-foreground">{role.name}</div>
                      <div className="text-xs text-muted-foreground">{role.slug}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium flex items-center gap-2 text-foreground">
                <Users className="h-5 w-5" />
                Groups
              </h3>
            </div>
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No group memberships</p>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div className="font-medium text-foreground">{group.name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {auditLog.length === 0 ? (
            <div className="p-8 text-center">
              <History className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No activity recorded</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {auditLog.map((entry) => (
                <div key={entry.id} className="flex items-start gap-4 p-4">
                  <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 bg-muted">
                    <History className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize text-foreground">
                        {entry.action.replace(/_/g, ' ')}
                      </span>
                      {entry.actorName && (
                        <>
                          <span className="text-muted-foreground">by</span>
                          <span className="text-muted-foreground">{entry.actorName}</span>
                        </>
                      )}
                    </div>
                    <div className="text-sm mt-1 text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-8">
        <div className="rounded-xl border border-destructive bg-card p-6">
          <h3 className="text-lg font-medium mb-2 text-destructive">Danger Zone</h3>
          <p className="text-sm mb-4 text-muted-foreground">
            These actions are destructive and cannot be undone.
          </p>
          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                handleAction('delete');
              }
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-destructive text-destructive-foreground hover:opacity-90"
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
