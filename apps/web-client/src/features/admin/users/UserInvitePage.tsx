import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  User,
  Building,
  Briefcase,
  MapPin,
  Phone,
  Globe,
  Shield,
  Users,
  Send,
  AlertCircle,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import identityApi from '../../../services/identityApi';

interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

interface Group {
  id: string;
  name: string;
  description?: string;
}

interface InviteFormData {
  email: string;
  displayName: string;
  employeeId: string;
  title: string;
  department: string;
  location: string;
  workPhone: string;
  mobilePhone: string;
  locale: string;
  timeZone: string;
  isAdmin: boolean;
  roleIds: string[];
  groupIds: string[];
  sendInvitation: boolean;
  personalMessage: string;
}

export const UserInvitePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    displayName: '',
    employeeId: '',
    title: '',
    department: '',
    location: '',
    workPhone: '',
    mobilePhone: '',
    locale: 'en',
    timeZone: 'UTC',
    isAdmin: false,
    roleIds: [],
    groupIds: [],
    sendInvitation: true,
    personalMessage: '',
  });

  // Fetch available roles and groups
  useEffect(() => {
    const fetchRolesAndGroups = async () => {
      try {
        const [rolesRes, groupsRes] = await Promise.all([
          identityApi.get<{ data?: Role[] } | Role[]>('/rbac/roles'),
          identityApi.get<{ data?: Group[] } | Group[]>('/rbac/groups'),
        ]);
        const rolesData = rolesRes.data;
        const groupsData = groupsRes.data;
        setRoles(Array.isArray(rolesData) ? rolesData : (rolesData as { data?: Role[] }).data || []);
        setGroups(Array.isArray(groupsData) ? groupsData : (groupsData as { data?: Group[] }).data || []);
      } catch (err) {
        console.error('Failed to fetch roles/groups:', err);
      }
    };
    fetchRolesAndGroups();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleRoleToggle = (roleId: string) => {
    setFormData(prev => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter(id => id !== roleId)
        : [...prev.roleIds, roleId],
    }));
  };

  const handleGroupToggle = (groupId: string) => {
    setFormData(prev => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter(id => id !== groupId)
        : [...prev.groupIds, groupId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await identityApi.post('/users', formData);
      setSuccess(true);
      setTimeout(() => navigate('/studio/users'), 2000);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      const message = axiosError?.response?.data?.message || 'Failed to invite user. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div
          className="rounded-xl border p-8 text-center"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
        >
          <div
            className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--bg-success-subtle)' }}
          >
            <CheckCircle className="h-8 w-8" style={{ color: 'var(--text-success)' }} />
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Invitation Sent!
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {formData.sendInvitation
              ? `An invitation email has been sent to ${formData.email}`
              : `User has been created. They can be invited later.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/studio/users')}
          className="p-2 rounded-lg transition-colors"
          style={{ backgroundColor: 'transparent' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <ArrowLeft className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
        </button>
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Invite New User
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Add a new user to your organization
          </p>
        </div>
      </div>

      {error && (
        <div
          className="mb-6 p-4 rounded-lg border flex items-start gap-3"
          style={{ backgroundColor: 'var(--bg-danger-subtle)', borderColor: 'var(--border-danger)' }}
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--text-danger)' }} />
          <p className="text-sm" style={{ color: 'var(--text-danger)' }}>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Basic Info */}
          <div
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
          >
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
              Basic Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Email Address <span style={{ color: 'var(--text-danger)' }}>*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="john.doe@example.com"
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Display Name <span style={{ color: 'var(--text-danger)' }}>*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleChange}
                    required
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Employee ID
                </label>
                <input
                  type="text"
                  name="employeeId"
                  value={formData.employeeId}
                  onChange={handleChange}
                  placeholder="EMP-12345"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Job Title
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Software Engineer"
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Department
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    placeholder="Engineering"
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    placeholder="San Francisco, CA"
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
          >
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
              Contact Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Work Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="tel"
                    name="workPhone"
                    value={formData.workPhone}
                    onChange={handleChange}
                    placeholder="+1 (555) 123-4567"
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Mobile Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="tel"
                    name="mobilePhone"
                    value={formData.mobilePhone}
                    onChange={handleChange}
                    placeholder="+1 (555) 987-6543"
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Locale
                </label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} />
                  <select
                    name="locale"
                    value={formData.locale}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="zh">Chinese</option>
                    <option value="ja">Japanese</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Time Zone
                </label>
                <select
                  name="timeZone"
                  value={formData.timeZone}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Roles & Groups */}
          <div
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
          >
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
              Roles & Groups
            </h3>

            {/* Administrator Toggle */}
            <div
              className="flex items-center gap-3 p-4 rounded-lg border mb-4"
              style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface-secondary)' }}
            >
              <Shield className="h-5 w-5" style={{ color: 'var(--text-warning)' }} />
              <div className="flex-1">
                <div className="font-medium" style={{ color: 'var(--text-primary)' }}>Administrator</div>
                <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Grant full administrative access to this organization
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="isAdmin"
                  checked={formData.isAdmin}
                  onChange={handleChange}
                  className="sr-only peer"
                />
                <div
                  className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:rounded-full after:h-5 after:w-5 after:transition-all"
                  style={{
                    backgroundColor: formData.isAdmin ? 'var(--bg-brand)' : 'var(--bg-surface-tertiary)',
                  }}
                >
                  <span
                    className="absolute top-[2px] left-[2px] h-5 w-5 rounded-full transition-transform"
                    style={{
                      backgroundColor: 'white',
                      transform: formData.isAdmin ? 'translateX(20px)' : 'translateX(0)',
                    }}
                  />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Roles */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Shield className="h-4 w-4" />
                  Roles
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {roles.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No roles available</p>
                  ) : (
                    roles.map((role) => (
                      <label
                        key={role.id}
                        className="flex items-center gap-3 p-2 rounded cursor-pointer transition-colors"
                        style={{ backgroundColor: 'transparent' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <input
                          type="checkbox"
                          checked={formData.roleIds.includes(role.id)}
                          onChange={() => handleRoleToggle(role.id)}
                          className="rounded"
                          style={{ borderColor: 'var(--border-default)' }}
                        />
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {role.name}
                          </div>
                          {role.description && (
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {role.description}
                            </div>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Groups */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Users className="h-4 w-4" />
                  Groups
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {groups.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No groups available</p>
                  ) : (
                    groups.map((group) => (
                      <label
                        key={group.id}
                        className="flex items-center gap-3 p-2 rounded cursor-pointer transition-colors"
                        style={{ backgroundColor: 'transparent' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <input
                          type="checkbox"
                          checked={formData.groupIds.includes(group.id)}
                          onChange={() => handleGroupToggle(group.id)}
                          className="rounded"
                          style={{ borderColor: 'var(--border-default)' }}
                        />
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {group.name}
                          </div>
                          {group.description && (
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {group.description}
                            </div>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Invitation Options */}
          <div
            className="rounded-xl border p-6"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-default)' }}
          >
            <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
              Invitation
            </h3>

            <div className="flex items-center gap-3 mb-4">
              <input
                type="checkbox"
                id="sendInvitation"
                name="sendInvitation"
                checked={formData.sendInvitation}
                onChange={handleChange}
                className="rounded"
                style={{ borderColor: 'var(--border-default)' }}
              />
              <label htmlFor="sendInvitation" className="text-sm" style={{ color: 'var(--text-primary)' }}>
                Send invitation email immediately
              </label>
            </div>

            {formData.sendInvitation && (
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  Personal Message (optional)
                </label>
                <textarea
                  name="personalMessage"
                  value={formData.personalMessage}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Add a personal message to include in the invitation email..."
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  style={{ borderColor: 'var(--border-default)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/studio/users')}
              className="btn-secondary px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center gap-2 px-6 py-2 rounded-lg disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {formData.sendInvitation ? 'Send Invitation' : 'Create User'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default UserInvitePage;
