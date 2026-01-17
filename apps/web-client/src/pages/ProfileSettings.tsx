import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  User,
  Mail,
  Phone,
  Building2,
  Briefcase,
  Globe,
  Clock,
  Save,
  Loader2,
  Check,
  AlertTriangle,
  Camera,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useProfile } from '../auth/useProfile';
import { createApiClient } from '../services/api';

// Use identity service for IAM endpoints
const IDENTITY_API_URL = import.meta.env.VITE_IDENTITY_API_URL ?? '/api/identity';
const identityApi = createApiClient(IDENTITY_API_URL);

interface FormData {
  displayName: string;
  email: string;
  phoneNumber: string;
  title: string;
  department: string;
  locale: string;
  timeZone: string;
}

export function ProfileSettingsPage() {
  const { auth } = useAuth();
  const { profile, loading: profileLoading } = useProfile();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState<FormData>({
    displayName: '',
    email: '',
    phoneNumber: '',
    title: '',
    department: '',
    locale: 'en-US',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  // Initialize form with profile data
  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        email: profile.email || '',
        phoneNumber: profile.phoneNumber || '',
        title: profile.title || '',
        department: profile.department || '',
        locale: profile.locale || 'en-US',
        timeZone: profile.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }
  }, [profile]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);
      await identityApi.patch('/iam/profile', formData);
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || 'Failed to update profile';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  // Get user initials for avatar
  const getInitials = () => {
    const name = formData.displayName || auth.user?.displayName || 'U';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Common timezones
  const timezones = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Central European (CET)' },
    { value: 'Europe/Berlin', label: 'Berlin (CET)' },
    { value: 'Asia/Tokyo', label: 'Japan (JST)' },
    { value: 'Asia/Shanghai', label: 'China (CST)' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
    { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
    { value: 'UTC', label: 'UTC' },
  ];

  const locales = [
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'es-ES', label: 'Spanish (Spain)' },
    { value: 'es-MX', label: 'Spanish (Mexico)' },
    { value: 'fr-FR', label: 'French (France)' },
    { value: 'de-DE', label: 'German (Germany)' },
    { value: 'pt-BR', label: 'Portuguese (Brazil)' },
    { value: 'zh-CN', label: 'Chinese (Simplified)' },
    { value: 'ja-JP', label: 'Japanese' },
  ];

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 size={32} className="mx-auto mb-3 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Your Profile
        </h1>
        <p className="text-sm mt-1 text-muted-foreground">
          Manage your personal information and preferences.
        </p>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-success-subtle text-success-text'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {message.type === 'success' ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-auto text-sm opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Profile Picture */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
          <Camera className="h-5 w-5 text-muted-foreground" />
          Profile Picture
        </h2>
        <Card className="p-5 border border-border">
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold bg-gradient-to-br from-primary to-accent text-primary-foreground"
            >
              {getInitials()}
            </div>
            <div className="flex-1">
              <p className="text-sm mb-3 text-muted-foreground">
                Your profile picture is generated from your initials. Avatar upload coming soon.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" disabled>
                  <Camera className="h-4 w-4 mr-2" />
                  Upload Photo
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Personal Information */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
          <User className="h-5 w-5 text-muted-foreground" />
          Personal Information
        </h2>
        <Card className="p-5 space-y-4 border border-border">
          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">
              Display Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Your display name"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="your.email@example.com"
              />
            </div>
            <p className="text-xs mt-1 text-muted-foreground/60">
              Used for notifications and account recovery
            </p>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <input
                type="tel"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>
        </Card>
      </section>

      {/* Work Information */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          Work Information
        </h2>
        <Card className="p-5 space-y-4 border border-border">
          {/* Job Title */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">
              Job Title
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Your job title"
              />
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">
              Department
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <input
                type="text"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Your department"
              />
            </div>
          </div>
        </Card>
      </section>

      {/* Regional Settings */}
      <section>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
          <Globe className="h-5 w-5 text-muted-foreground" />
          Regional Settings
        </h2>
        <Card className="p-5 space-y-4 border border-border">
          {/* Locale */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">
              Language & Region
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <select
                value={formData.locale}
                onChange={(e) => handleInputChange('locale', e.target.value)}
                className="settings-select w-full pl-10 pr-8 py-2.5 rounded-lg text-sm appearance-none cursor-pointer bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {locales.map((locale) => (
                  <option
                    key={locale.value}
                    value={locale.value}
                    className="bg-card text-foreground"
                  >
                    {locale.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-foreground">
              Time Zone
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
              <select
                value={formData.timeZone}
                onChange={(e) => handleInputChange('timeZone', e.target.value)}
                className="settings-select w-full pl-10 pr-8 py-2.5 rounded-lg text-sm appearance-none cursor-pointer bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {timezones.map((tz) => (
                  <option
                    key={tz.value}
                    value={tz.value}
                    className="bg-card text-foreground"
                  >
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs mt-1 text-muted-foreground/60">
              Used for displaying dates and times throughout the application
            </p>
          </div>
        </Card>
      </section>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
