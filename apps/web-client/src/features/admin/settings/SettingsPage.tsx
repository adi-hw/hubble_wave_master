import React, { useState } from 'react';
import { Settings, Save, RotateCcw, Check } from 'lucide-react';

interface SettingCategory {
  id: string;
  name: string;
  description: string;
  settings: Setting[];
}

interface Setting {
  key: string;
  label: string;
  description: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
  value: any;
  options?: { value: string; label: string }[];
  isModified?: boolean;
}

const mockCategories: SettingCategory[] = [
  {
    id: 'general',
    name: 'General',
    description: 'Basic platform settings',
    settings: [
      {
        key: 'app.name',
        label: 'Application Name',
        description: 'The name displayed in the header and browser title',
        type: 'text',
        value: 'EAM Platform',
      },
      {
        key: 'app.timezone',
        label: 'Default Timezone',
        description: 'Default timezone for date/time display',
        type: 'select',
        value: 'UTC',
        options: [
          { value: 'UTC', label: 'UTC' },
          { value: 'America/New_York', label: 'Eastern Time' },
          { value: 'America/Chicago', label: 'Central Time' },
          { value: 'America/Los_Angeles', label: 'Pacific Time' },
          { value: 'Europe/London', label: 'London' },
        ],
      },
      {
        key: 'app.date_format',
        label: 'Date Format',
        description: 'Format for displaying dates',
        type: 'select',
        value: 'MM/DD/YYYY',
        options: [
          { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
          { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
          { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
        ],
      },
    ],
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Authentication and authorization settings',
    settings: [
      {
        key: 'security.session_timeout',
        label: 'Session Timeout (minutes)',
        description: 'Time before inactive sessions expire',
        type: 'number',
        value: 60,
      },
      {
        key: 'security.password_min_length',
        label: 'Minimum Password Length',
        description: 'Minimum required password length',
        type: 'number',
        value: 8,
      },
      {
        key: 'security.mfa_required',
        label: 'Require MFA',
        description: 'Require multi-factor authentication for all users',
        type: 'boolean',
        value: false,
      },
    ],
  },
  {
    id: 'notifications',
    name: 'Notifications',
    description: 'Email and notification settings',
    settings: [
      {
        key: 'email.from_address',
        label: 'From Email Address',
        description: 'Default sender email address',
        type: 'text',
        value: 'noreply@eam-platform.com',
      },
      {
        key: 'email.from_name',
        label: 'From Name',
        description: 'Default sender name',
        type: 'text',
        value: 'EAM Platform',
      },
      {
        key: 'notifications.digest_enabled',
        label: 'Enable Digest Emails',
        description: 'Allow users to receive digest emails instead of individual notifications',
        type: 'boolean',
        value: true,
      },
    ],
  },
];

export const SettingsPage: React.FC = () => {
  const [categories, setCategories] = useState(mockCategories);
  const [activeCategory, setActiveCategory] = useState('general');
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSettingChange = (categoryId: string, settingKey: string, newValue: any) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              settings: cat.settings.map((s) =>
                s.key === settingKey ? { ...s, value: newValue, isModified: true } : s
              ),
            }
          : cat
      )
    );
    setHasChanges(true);
    setSaveSuccess(false);
  };

  const handleSave = () => {
    // TODO: Implement save
    console.log('Saving settings...');
    setHasChanges(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleReset = () => {
    setCategories(mockCategories);
    setHasChanges(false);
  };

  const currentCategory = categories.find((c) => c.id === activeCategory);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500 mt-1">
            Configure platform-wide settings and preferences
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-sm text-green-600">
              <Check className="h-4 w-4" />
              Saved successfully
            </span>
          )}
          <button
            onClick={handleReset}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                  activeCategory === category.id
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="font-medium">{category.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{category.description}</div>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1">
          {currentCategory && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Settings className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{currentCategory.name}</h2>
                  <p className="text-sm text-slate-500">{currentCategory.description}</p>
                </div>
              </div>

              <div className="space-y-6">
                {currentCategory.settings.map((setting) => (
                  <div key={setting.key} className="border-b border-slate-100 pb-6 last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <label className="block font-medium text-slate-900 mb-1">
                          {setting.label}
                          {setting.isModified && (
                            <span className="ml-2 text-xs text-amber-600">Modified</span>
                          )}
                        </label>
                        <p className="text-sm text-slate-500 mb-3">{setting.description}</p>
                      </div>
                    </div>

                    {setting.type === 'text' && (
                      <input
                        type="text"
                        value={setting.value}
                        onChange={(e) =>
                          handleSettingChange(currentCategory.id, setting.key, e.target.value)
                        }
                        className="w-full max-w-md px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    )}

                    {setting.type === 'number' && (
                      <input
                        type="number"
                        value={setting.value}
                        onChange={(e) =>
                          handleSettingChange(
                            currentCategory.id,
                            setting.key,
                            parseInt(e.target.value, 10)
                          )
                        }
                        className="w-32 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    )}

                    {setting.type === 'boolean' && (
                      <button
                        onClick={() =>
                          handleSettingChange(currentCategory.id, setting.key, !setting.value)
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          setting.value ? 'bg-primary-600' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            setting.value ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    )}

                    {setting.type === 'select' && (
                      <select
                        value={setting.value}
                        onChange={(e) =>
                          handleSettingChange(currentCategory.id, setting.key, e.target.value)
                        }
                        className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        {setting.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {setting.type === 'textarea' && (
                      <textarea
                        value={setting.value}
                        onChange={(e) =>
                          handleSettingChange(currentCategory.id, setting.key, e.target.value)
                        }
                        rows={4}
                        className="w-full max-w-md px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
